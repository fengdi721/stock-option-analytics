export default {
  forbidden: [
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
    { name: 'no-unresolved-imports', severity: 'error', from: {}, to: { couldNotResolve: true } },
    {
      name: 'pure-core',
      severity: 'error',
      from: { path: '^src/(domain/|shared/|sec/contracts\\.ts$)' },
      to: { pathNot: '^src/(domain/|shared/|sec/contracts\\.ts$)' },
    },
    {
      name: 'shared-independent-of-features',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(domain/|adapters/|sec/|cli)' },
    },
    {
      name: 'no-feature-to-cli',
      severity: 'error',
      from: { path: '^src/(domain/|shared/|adapters/|sec/)' },
      to: { path: '^src/cli' },
    },
    {
      name: 'no-payoff-to-sec',
      severity: 'error',
      from: { path: '^src/(domain/|adapters/)' },
      to: { path: '^src/sec/' },
    },
    {
      name: 'no-sec-to-payoff',
      severity: 'error',
      from: { path: '^src/sec/' },
      to: { path: '^src/(domain/|adapters/)' },
    },
  ],
  options: { doNotFollow: { path: 'node_modules' }, tsConfig: { fileName: 'tsconfig.json' } },
};
