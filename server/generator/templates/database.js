// Template koneksi database, model Mongo, migration SQL
import fs from 'fs';
import { DB_LABEL, moduleSyntax, toPascal, toTable } from '../syntax.js';

// Kode runner migration disimpan sebagai file biasa (bukan string) supaya mudah dibaca & di-lint
const readStatic = (name) => fs.readFileSync(new URL(`./static/${name}`, import.meta.url), 'utf8');

// Terjemahkan error koneksi yang paling sering muncul jadi langkah perbaikan yang jelas
const explainHelper = (label) => [
  'const CONNECTION_HINTS = {',
  "  ECONNREFUSED: 'server database tidak bisa dihubungi. Pastikan service-nya sedang jalan dan host/port di DATABASE_URL benar. Kalau error menyebut ::1 dan database hanya listen di IPv4, ganti localhost dengan 127.0.0.1.',",
  "  ENOTFOUND: 'host di DATABASE_URL tidak ditemukan.',",
  "  ETIMEDOUT: 'koneksi timeout. Cek host, port, dan firewall.',",
  "  ER_ACCESS_DENIED_ERROR: 'username/password di DATABASE_URL salah.',",
  "  ER_BAD_DB_ERROR: 'database belum ada. Buat dulu dengan CREATE DATABASE <nama>;',",
  "  '28P01': 'username/password di DATABASE_URL salah.',",
  "  '3D000': 'database belum ada. Buat dulu dengan: createdb <nama>',",
  '};',
  '',
  'function explainConnectionError(err) {',
  '  const code = err.code ?? err.cause?.code ?? Object.keys(CONNECTION_HINTS).find((c) => String(err.message).includes(c));',
  `  const hint = CONNECTION_HINTS[code] ?? err.message;`,
  `  return new Error(\`Gagal terhubung ke ${label}: \${hint}\`, { cause: err });`,
  '}',
  '',
];

export function dbConfigJs(s) {
  const m = moduleSyntax(s.moduleSystem);
  const guard = [
    '  if (!process.env.DATABASE_URL) {',
    "    throw new Error('DATABASE_URL belum di-set. Salin .env.example ke .env lalu isi connection string.');",
    '  }',
  ];
  if (s.database === 'mongodb') {
    return [
      m.def('mongoose', 'mongoose'),
      '',
      ...explainHelper('MongoDB'),
      'async function connectDB() {',
      ...guard,
      '  try {',
      '    // Gagal dalam 5 detik, bukan default 30 detik, supaya salah konfigurasi cepat ketahuan',
      '    await mongoose.connect(process.env.DATABASE_URL, { serverSelectionTimeoutMS: 5000 });',
      '  } catch (err) {',
      '    throw explainConnectionError(err);',
      '  }',
      "  console.log('MongoDB terhubung');",
      '}',
      '',
      m.exportNamed(['connectDB']),
      '',
    ].join('\n');
  }
  const isPg = s.database === 'postgresql';
  return [
    isPg ? m.def('pg', 'pg') : m.def('mysql', 'mysql2/promise'),
    '',
    'let pool;',
    '',
    ...explainHelper(DB_LABEL[s.database]),
    'async function connectDB() {',
    ...guard,
    isPg
      ? '  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });'
      : '  pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 10, connectTimeout: 5000 });',
    '  try {',
    "    await pool.query('SELECT 1');",
    '  } catch (err) {',
    '    await pool.end().catch(() => {});',
    '    pool = undefined;',
    '    throw explainConnectionError(err);',
    '  }',
    `  console.log('${DB_LABEL[s.database]} terhubung');`,
    '}',
    '',
    'async function query(sql, params = []) {',
    "  if (!pool) throw new Error('Database belum terhubung. Panggil connectDB() dulu.');",
    isPg ? '  const { rows } = await pool.query(sql, params);' : '  const [rows] = await pool.query(sql, params);',
    '  return rows;',
    '}',
    '',
    m.exportNamed(['connectDB', 'query']),
    '',
  ].join('\n');
}

export function mongoModelJs(s, resource) {
  const m = moduleSyntax(s.moduleSystem);
  const Model = toPascal(resource);
  return [
    m.def('mongoose', 'mongoose'),
    '',
    '// Skema longgar (strict: false) supaya langsung bisa dipakai; definisikan field sesuai kebutuhan.',
    'const schema = new mongoose.Schema({}, { strict: false, timestamps: true });',
    '',
    `const ${Model} = mongoose.models.${Model} || mongoose.model('${Model}', schema, '${resource}');`,
    '',
    m.exportDefault(Model),
    '',
  ].join('\n');
}

// Migration pertama: tabel untuk setiap resource yang terhubung ke database
export function initMigrationSql(s, dbResources) {
  const ddl = (r) =>
    s.database === 'postgresql'
      ? `CREATE TABLE IF NOT EXISTS ${toTable(r)} (\n  id SERIAL PRIMARY KEY,\n  data JSONB NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);`
      : `CREATE TABLE IF NOT EXISTS ${toTable(r)} (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  data JSON NOT NULL,\n  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP\n);`;
  return `-- 001_init: tabel awal dari Node.js Visual Builder\n-- Jangan edit file ini setelah diterapkan; buat migration baru dengan npm run db:new -- nama\n\n${dbResources.map(ddl).join('\n\n')}\n`;
}

export function migrateJs(s) {
  const m = moduleSyntax(s.moduleSystem);
  const isPg = s.database === 'postgresql';
  const header = [
    ...(s.middleware.dotenv ? [m.sideEffect('dotenv/config')] : []),
    m.def('crypto', 'crypto'),
    m.def('fs', 'fs'),
    m.def('path', 'path'),
    isPg ? m.def('pg', 'pg') : m.def('mysql', 'mysql2/promise'),
    ...(s.moduleSystem === 'esm' ? [m.named(['fileURLToPath'], 'url')] : []),
    '',
    s.moduleSystem === 'esm'
      ? 'const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));'
      : 'const SCRIPT_DIR = __dirname;',
    '',
  ].join('\n');
  const adapter = readStatic(`migrate-adapter-${s.database}.tpl.js`).trimEnd();
  return header + readStatic('migrate-common.tpl.js').replace('/*__ADAPTER__*/', adapter);
}
