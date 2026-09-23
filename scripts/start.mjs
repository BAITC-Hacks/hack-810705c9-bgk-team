import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(root);
// Root .env was loaded by `bun --env-file=.env`; children inherit shared credentials.
for (const app of ['presentation-layer', 'ai-logic-layer', 'workers']) {
  const env = path.join(root, 'apps', app, '.env');
  if (!fs.existsSync(env)) fs.copyFileSync(`${env}.example`, env);
}
const env = { ...process.env };
const user = encodeURIComponent(env.POSTGRES_USER || 'postgres');
const password = encodeURIComponent(env.POSTGRES_PASSWORD || 'postgres');
const port = env.POSTGRES_PORT || '5432';
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Invalid POSTGRES_PORT');
for (const [key, name] of [['DATABASE_URL_NEXTJS', env.DB_NAME_NEXTJS || 'nextjs_db'], ['DATABASE_URL_MASTRA', env.DB_NAME_MASTRA || 'mastra_db']]) {
  env[key] ||= `postgresql://${user}:${password}@localhost:${port}/${encodeURIComponent(name)}`;
}
env.RUSTFS_ENDPOINT ||= 'http://localhost:9000';
env.MASTRA_API_URL ||= 'http://localhost:4111';
// Placeholder is not an API key. Remove it so an app-specific real key can be used.
if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === 'sk-...') {
  delete env.OPENAI_API_KEY;
  console.log('AI key is not configured in root .env. UI/DB can run; AI calls need a real key.');
}
const child = Bun.spawn(['bash', 'scripts/dev.sh'], { cwd: root, env, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { try { child.kill(signal); } catch {} });
process.exit(await child.exited);
