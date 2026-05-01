const { spawn } = require('node:child_process');
const path = require('node:path');

async function main() {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: path.resolve(__dirname, '../vite.config.mjs'),
  });

  await server.listen(5173);
  server.printUrls();

  const urls = server.resolvedUrls;
  const localUrl = urls && urls.local.length > 0 ? urls.local[0] : 'http://127.0.0.1:5173/';
  const electronPath = require('electron');
  const child = spawn(electronPath, ['.'], {
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: localUrl,
    },
    stdio: 'inherit',
  });

  child.on('exit', async (code) => {
    await server.close();
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
