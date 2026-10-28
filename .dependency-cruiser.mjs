const pureModules =
  '^src/(domain/|shared/|financial/|sec/(contracts|content|submissions|companyfacts-contracts)\\.ts$)';

export default {
  forbidden: [
    {
      name: 'financial-dependencies',
      severity: 'error',
      from: { path: '^src/financial/' },
      to: { pathNot: '^src/(financial/|shared/|sec/contracts\\.ts$)' },
    },
    {
      name: 'financial-independent-of-existing-features',
      severity: 'error',
      from: { path: '^src/(domain/|adapters/|sec/)' },
      to: { path: '^src/financial/' },
    },
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
    { name: 'no-unresolved-imports', severity: 'error', from: {}, to: { couldNotResolve: true } },
    {
      name: 'pure-core',
      severity: 'error',
      from: { path: pureModules },
      to: { pathNot: pureModules },
    },
    {
      name: 'shared-independent-of-features',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(domain/|adapters/|financial/|sec/|cli)' },
    },
    {
      name: 'no-feature-to-cli',
      severity: 'error',
      from: { path: '^src/(domain/|shared/|adapters/|financial/|sec/)' },
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
