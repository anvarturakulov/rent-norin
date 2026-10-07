/**
 * Выполняет *.sql из backend/migrations по имени (лексикографически).
 * Каждый файл применяется один раз — учёт в schema_migrations.
 * Переменные БД: POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_PORT
 * из .${NODE_ENV}.env (как в Nest: .development.env, .production.env), затем .env.
 * Прод: NODE_ENV=production npm run migration:run  или  npm run migration:run:prod
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const nodeEnv = process.env.NODE_ENV || 'development';
require('dotenv').config({
  path: path.join(__dirname, `../../.${nodeEnv}.env`),
});
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const migrationsDir = path.join(__dirname, '../../migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
}

async function isApplied(client, filename) {
  const res = await client.query(
    'SELECT 1 FROM schema_migrations WHERE filename = $1',
    [filename],
  );
  return res.rowCount > 0;
}

async function markApplied(client, filename) {
  await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [
    filename,
  ]);
}

async function main() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('Нет .sql файлов в', migrationsDir);
    return;
  }

  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  });

  if (!process.env.POSTGRES_PASSWORD && !process.env.PGPASSWORD) {
    console.error(`Укажите POSTGRES_PASSWORD в .${nodeEnv}.env или .env`);
    process.exit(1);
  }

  await client.connect();
  console.log('Подключено к БД:', process.env.POSTGRES_DB);

  await ensureMigrationsTable(client);

  let applied = 0;
  let skipped = 0;

  for (const file of files) {
    if (await isApplied(client, file)) {
      console.log('⊘', file, '(уже применена)');
      skipped++;
      continue;
    }

    const full = path.join(migrationsDir, file);
    const sql = fs.readFileSync(full, 'utf8');
    console.log('→', file);

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await markApplied(client, file);
      await client.query('COMMIT');
      applied++;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  }

  await client.end();
  console.log(
    'Готово:',
    applied,
    'новых,',
    skipped,
    'пропущено,',
    files.length,
    'всего.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
