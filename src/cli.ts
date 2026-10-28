import { runCommand, usage } from './cli/commands.ts';

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(usage);
  } else {
    console.log(JSON.stringify(await runCommand(args, process.env), null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}
