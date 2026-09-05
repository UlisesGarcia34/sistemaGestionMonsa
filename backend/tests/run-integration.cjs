// Base efímera exclusiva: nunca migra ni borra la base de la aplicación.
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
async function main() {
  const source = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1'].includes(source.hostname)) throw new Error('Las pruebas requieren MySQL local.');
  const nombre = `mgc_test_${Date.now()}_${process.pid}`;
  if (!/^mgc_test_\d+_\d+$/.test(nombre)) throw new Error('Nombre de base no seguro');
  const admin = new PrismaClient();
  let creada = false;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE \`${nombre}\` CHARACTER SET utf8mb4`);
    creada = true;
    source.pathname = `/${nombre}`;
    const env = { ...process.env, DATABASE_URL: source.toString(), NODE_ENV: 'test', MGC_TEST_DB: nombre };
    const run = args => {
      const r = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
      if (r.error) throw r.error;
      if (r.status !== 0) throw new Error(`Pruebas/migraciones fallaron (${r.status}).`);
    };
    run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
    run(['--import', 'tsx', '--test', 'tests/integration.ts']);
  } finally {
    if (creada) await admin.$executeRawUnsafe(`DROP DATABASE \`${nombre}\``);
    await admin.$disconnect();
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
