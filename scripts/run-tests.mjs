import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files = readdirSync(new URL('../tests/', import.meta.url)).filter(name => name.endsWith('.test.ts')).sort();
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['node_modules/jiti/lib/jiti-cli.mjs', `tests/${file}`], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
