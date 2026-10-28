import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  cacheDirectory,
  retrieveFilings,
  selectFilings,
  validateCache,
} from '../src/sec/retrieval.ts';

const request = { cik: '0000000001', accessions: ['0000000001-23-000001', '0000000001-24-000001'] };
const metadata = {
  cik: 1,
  filings: {
    recent: {
      accessionNumber: request.accessions,
      form: ['10-K', '10-K'],
      reportDate: ['2023-06-30', '2024-06-30'],
      filingDate: ['2023-08-01', '2024-08-01'],
      primaryDocument: ['annual23.htm', 'annual24.htm'],
    },
  },
};
const html = '<html><body>Synthetic filing fixture. Not SEC data.</body></html>';
const jsonResponse = () =>
  new Response(JSON.stringify(metadata), { headers: { 'content-type': 'application/json' } });
const htmlResponse = () => new Response(html, { headers: { 'content-type': 'text/html' } });
const options = {
  userAgent: 'SyntheticTest test@example.invalid',
  now: () => new Date('2025-01-01T00:00:00.000Z'),
  sleep: () => Promise.resolve(),
};

/** Promise-returning transport stubs model fetch without fake async functions. */
function stubFetch(
  responder: (...args: Parameters<typeof fetch>) => Response | Promise<Response>,
): typeof fetch {
  return (...args) => Promise.resolve().then(() => responder(...args));
}
function successfulFetch(): typeof fetch {
  let count = 0;
  return stubFetch(() => (++count === 1 ? jsonResponse() : htmlResponse()));
}
function forbiddenFetch(): typeof fetch {
  return stubFetch(() => {
    throw new Error('network forbidden');
  });
}
function outputFlag(stdout: string, key: string): unknown {
  const value: unknown = JSON.parse(stdout);
  assert.ok(value !== null && typeof value === 'object');
  return (value as Record<string, unknown>)[key];
}
async function temporary(t: TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sec-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

await test('download pair, verify provenance, offline CLI and zero-network cache hit', async (t) => {
  const root = await temporary(t);
  const urls: string[] = [];
  const fetcher = stubFetch((url, init) => {
    assert.equal(typeof url, 'string');
    if (typeof url !== 'string') {
      throw new Error('expected string URL');
    }
    urls.push(url);
    assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).get('User-Agent'), options.userAgent);
    assert.ok(init?.signal);
    return urls.length === 1 ? jsonResponse() : htmlResponse();
  });
  const first = await retrieveFilings(request, root, { ...options, fetch: fetcher });
  assert.equal(first.cacheHit, false);
  assert.equal(urls.length, 3);
  assert.equal(first.manifest.filings[1].periodEnd, '2024-06-30');
  assert.equal(
    urls[2],
    'https://www.sec.gov/Archives/edgar/data/1/000000000124000001/annual24.htm',
  );
  const second = await retrieveFilings(request, root, { fetch: forbiddenFetch() });
  assert.equal(second.cacheHit, true);
  assert.deepEqual(second.manifest, first.manifest);
  const result = spawnSync(process.execPath, ['src/cli.ts', 'sec-validate', first.directory], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(outputFlag(result.stdout, 'valid'), true);
  await writeFile(join(root, 'request.json'), JSON.stringify(request));
  const cached = spawnSync(
    process.execPath,
    ['src/cli.ts', 'sec-fetch', join(root, 'request.json'), root],
    { encoding: 'utf8', env: { ...process.env, SEC_USER_AGENT: '' } },
  );
  assert.equal(cached.status, 0, cached.stderr);
  assert.equal(outputFlag(cached.stdout, 'cacheHit'), true);
});

await test('cache corruption fails closed without a request', async (t) => {
  const root = await temporary(t);
  const first = await retrieveFilings(request, root, { ...options, fetch: successfulFetch() });
  await writeFile(join(first.directory, `${first.manifest.filings[0].sha256}.blob`), 'tampered');
  await assert.rejects(retrieveFilings(request, root, { fetch: forbiddenFetch() }), /integrity/);
});

await test('manifest metadata is corroborated against saved submissions', async (t) => {
  const root = await temporary(t);
  const first = await retrieveFilings(request, root, { ...options, fetch: successfulFetch() });
  first.manifest.filings[0].filedAt = '2023-08-02';
  await writeFile(join(first.directory, 'manifest.json'), JSON.stringify(first.manifest));
  await assert.rejects(validateCache(first.directory), /disagrees/);
});

await test('429 and 503 retry with bounded exponential backoff and Retry-After', async (t) => {
  const root = await temporary(t);
  let count = 0;
  const sleeps: number[] = [];
  await retrieveFilings(request, root, {
    ...options,
    sleep: (milliseconds) => {
      sleeps.push(milliseconds);
      return Promise.resolve();
    },
    fetch: stubFetch(() => {
      count++;
      if (count === 1) {
        return new Response('', { status: 429, headers: { 'retry-after': '3' } });
      }
      if (count === 2) {
        return new Response('', { status: 503 });
      }
      return count === 3 ? jsonResponse() : htmlResponse();
    }),
  });
  assert.equal(count, 5);
  assert.deepEqual(sleeps, [250, 3000, 250, 2000, 250, 250, 250]);
});

for (const status of [403, 404, 429]) {
  await test(`HTTP ${status} bounded failure leaves no valid manifest`, async (t) => {
    const root = await temporary(t);
    let count = 0;
    await assert.rejects(
      retrieveFilings(request, root, {
        ...options,
        fetch: stubFetch(() => {
          count++;
          return new Response('', { status });
        }),
      }),
      /SEC HTTP/,
    );
    assert.equal(count, status === 429 ? 3 : 1);
    await assert.rejects(access(join(cacheDirectory(root, request), 'manifest.json')));
    await assert.rejects(access(join(cacheDirectory(root, request), '.lock')));
  });
}

await test('long Retry-After stops without retrying early', async (t) => {
  const root = await temporary(t);
  let count = 0;
  await assert.rejects(
    retrieveFilings(request, root, {
      ...options,
      fetch: stubFetch(() => {
        count++;
        return new Response('', { status: 429, headers: { 'retry-after': '120' } });
      }),
    }),
    /later manual retry/,
  );
  assert.equal(count, 1);
});

for (const [label, response] of [
  ['wrong type', () => new Response('oops', { headers: { 'content-type': 'text/plain' } })],
  [
    'declared oversize',
    () =>
      new Response('{}', {
        headers: { 'content-type': 'application/json', 'content-length': '25000001' },
      }),
  ],
  [
    'stream oversize',
    () =>
      new Response(new Uint8Array(25_000_001), { headers: { 'content-type': 'application/json' } }),
  ],
  ['empty', () => new Response('', { headers: { 'content-type': 'application/json' } })],
  ['malformed JSON', () => new Response('{', { headers: { 'content-type': 'application/json' } })],
] as const) {
  await test(`rejects ${label}`, async (t) => {
    const root = await temporary(t);
    await assert.rejects(
      retrieveFilings(request, root, { ...options, fetch: stubFetch(response) }),
    );
  });
}

await test('rejects error page and allows retry after partial failure', async (t) => {
  const root = await temporary(t);
  let count = 0;
  await assert.rejects(
    retrieveFilings(request, root, {
      ...options,
      fetch: stubFetch(() => {
        count++;
        return count === 1
          ? jsonResponse()
          : count === 2
            ? htmlResponse()
            : new Response('<html><title>Access Denied</title></html>', {
                headers: { 'content-type': 'text/html' },
              });
      }),
    }),
    /not a filing/,
  );
  await assert.rejects(access(join(cacheDirectory(root, request), 'manifest.json')));
  const result = await retrieveFilings(request, root, { ...options, fetch: successfulFetch() });
  assert.equal(result.cacheHit, false);
  await validateCache(result.directory);
});

await test('network exceptions and timeout propagate, with lock cleanup', async (t) => {
  const root = await temporary(t);
  await assert.rejects(
    retrieveFilings(request, root, {
      ...options,
      fetch: stubFetch(() => {
        throw new Error('timeout');
      }),
    }),
    /timeout/,
  );
  await assert.rejects(access(join(cacheDirectory(root, request), '.lock')));
});

await test('missing identity prevents any network request', async (t) => {
  const root = await temporary(t);
  await assert.rejects(
    retrieveFilings(request, root, { fetch: forbiddenFetch() }),
    /SEC_USER_AGENT/,
  );
});

await test('submissions validation rejects wrong company, missing and duplicate accessions', () => {
  for (const mutate of [
    (m: typeof metadata) => {
      m.cik = 2;
    },
    (m: typeof metadata) => {
      m.filings.recent.accessionNumber[0] = 'missing';
    },
    (m: typeof metadata) => {
      m.filings.recent.accessionNumber[1] = request.accessions[0];
    },
    (m: typeof metadata) => {
      m.filings.recent.form.pop();
    },
  ]) {
    const m = structuredClone(metadata);
    mutate(m);
    assert.throws(() =>
      selectFilings(Buffer.from(JSON.stringify(m)), {
        ...request,
        accessions: [request.accessions[0], request.accessions[1]],
      }),
    );
  }
});

await test('reversed request order reuses the verified pair without network', async (t) => {
  const root = await temporary(t);
  const first = await retrieveFilings(request, root, { ...options, fetch: successfulFetch() });
  const reversed = { ...request, accessions: [...request.accessions].reverse() };
  const second = await retrieveFilings(reversed, root, { fetch: forbiddenFetch() });
  assert.equal(second.cacheHit, true);
  assert.deepEqual(second.manifest, first.manifest);
});

await test('a contending writer does not remove the active writer lock', async (t) => {
  const root = await temporary(t);
  let notifyStarted = () => {};
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve;
  });
  let resume = () => {};
  const blocked = new Promise<void>((resolve) => {
    resume = resolve;
  });
  let count = 0;
  const active = retrieveFilings(request, root, {
    ...options,
    fetch: stubFetch(() => {
      count++;
      if (count !== 1) {
        return htmlResponse();
      }
      notifyStarted();
      return blocked.then(() => jsonResponse());
    }),
  });
  await started;
  try {
    await assert.rejects(
      retrieveFilings(request, root, { ...options, fetch: forbiddenFetch() }),
      /EEXIST/,
    );
    await access(join(cacheDirectory(root, request), '.lock'));
  } finally {
    resume();
  }
  await active;
});

await test('HTTP redirects are rejected without following their location', async (t) => {
  const root = await temporary(t);
  let count = 0;
  await assert.rejects(
    retrieveFilings(request, root, {
      ...options,
      fetch: stubFetch((_url, init) => {
        count++;
        assert.equal(init?.redirect, 'error');
        return new Response('', { status: 302, headers: { location: 'https://example.invalid/' } });
      }),
    }),
    /SEC HTTP 302/,
  );
  assert.equal(count, 1);
});

for (const [label, mutate] of [
  [
    'invalid calendar date',
    (m: typeof metadata) => {
      m.filings.recent.reportDate[0] = '2023-02-29';
    },
  ],
  [
    'inverted chronology',
    (m: typeof metadata) => {
      m.filings.recent.filingDate[0] = '2023-06-01';
    },
  ],
  [
    'mixed forms',
    (m: typeof metadata) => {
      m.filings.recent.form[1] = '10-Q';
    },
  ],
  [
    'duplicate periods',
    (m: typeof metadata) => {
      m.filings.recent.reportDate[1] = m.filings.recent.reportDate[0];
    },
  ],
] as const) {
  await test(`invalid SEC metadata (${label}) stops before any document download`, async (t) => {
    const root = await temporary(t);
    const invalid = structuredClone(metadata);
    mutate(invalid);
    let calls = 0;
    await assert.rejects(
      retrieveFilings(request, root, {
        ...options,
        fetch: stubFetch(() => {
          calls++;
          assert.equal(calls, 1, 'invalid metadata must not trigger a document request');
          return new Response(JSON.stringify(invalid), {
            headers: { 'content-type': 'application/json' },
          });
        }),
      }),
    );
    assert.equal(calls, 1);
    await assert.rejects(access(join(cacheDirectory(root, request), 'manifest.json')));
    await assert.rejects(access(join(cacheDirectory(root, request), '.lock')));
  });
}
