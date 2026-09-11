/**
 * CI gate: validates manifest + all story packages via the jest suite.
 * Usage: npm run content:validate
 */
import { spawnSync } from 'node:child_process';

const res = spawnSync('npx', ['jest', '__tests__/content.test.ts', '--coverage=false'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(res.status ?? 1);
