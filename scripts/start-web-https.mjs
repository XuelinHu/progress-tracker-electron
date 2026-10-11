import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '4093'], {
  env: { ...process.env, DEV_HTTPS: '1' },
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Could not start HTTPS web process: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
