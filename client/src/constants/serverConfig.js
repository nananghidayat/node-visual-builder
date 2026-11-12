// Konfigurasi node Server & Database. Dikirim ke backend sebagai `settings`.
// Aturan validasi HARUS sama dengan server/generator/settings.js.

export const DEFAULT_SERVER_CONFIG = {
  port: 3000,
  apiPrefix: '/api',
  corsOrigin: '*',
  bodyLimit: '1mb',
  moduleSystem: 'commonjs',
  nodeVersion: '20',
  version: '1.0.0',
  description: '',
  author: '',
  license: 'MIT',
  middleware: { cors: true, helmet: true, morgan: true, dotenv: true },
  tooling: { nodemon: true, readme: true, gitignore: true, dockerfile: false, compose: false, postman: true },
};

export const DEFAULT_DATABASE_CONFIG = { driver: 'none', name: '' }; // name kosong = turunan nama proyek

// Aman untuk PostgreSQL (maks 63), MySQL (64), dan MongoDB; sama dengan server/generator/settings.js
const DB_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

// Default nama database = slug nama proyek (sama dengan slugOf di backend)
export const defaultDatabaseName = (projectName) =>
  String(projectName || '').replace(/^@[^/]+\//, '').replace(/[^a-z0-9_]/g, '_');

export function validateDatabaseConfig(c) {
  const errors = {};
  if (c.name && !DB_NAME_RE.test(c.name)) errors.name = 'Huruf, angka, _; diawali huruf/_; maks 63 karakter';
  return errors;
}

export const MODULE_OPTIONS = [
  { value: 'commonjs', label: 'CommonJS (require)' },
  { value: 'esm', label: 'ES Modules (import)' },
];
export const NODE_VERSION_OPTIONS = [
  { value: '18', label: 'Node 18 LTS' },
  { value: '20', label: 'Node 20 LTS' },
  { value: '22', label: 'Node 22 LTS' },
];
export const LICENSE_OPTIONS = [
  { value: 'MIT', label: 'MIT' },
  { value: 'ISC', label: 'ISC' },
  { value: 'Apache-2.0', label: 'Apache-2.0' },
  { value: 'UNLICENSED', label: 'UNLICENSED (privat)' },
];
export const DATABASE_OPTIONS = [
  { value: 'none', label: 'Belum dipilih', hint: 'Endpoint memakai data contoh in-memory.' },
  { value: 'mongodb', label: 'MongoDB', hint: 'Driver mongoose. ID berupa ObjectId.' },
  { value: 'postgresql', label: 'PostgreSQL', hint: 'Driver pg. Tabel dibuat dari db/schema.sql.' },
  { value: 'mysql', label: 'MySQL', hint: 'Driver mysql2. Tabel dibuat dari db/schema.sql.' },
];
export const DATABASE_LABEL = Object.fromEntries(DATABASE_OPTIONS.map((o) => [o.value, o.label]));

export const MIDDLEWARE_OPTIONS = [
  { key: 'cors', label: 'CORS', hint: 'Izinkan request dari origin lain' },
  { key: 'helmet', label: 'Helmet', hint: 'Header keamanan HTTP' },
  { key: 'morgan', label: 'Morgan', hint: 'Log setiap request' },
  { key: 'dotenv', label: 'dotenv', hint: 'Baca konfigurasi dari .env' },
];
export const TOOLING_OPTIONS = [
  { key: 'nodemon', label: 'nodemon', hint: 'npm run dev dengan auto-reload' },
  { key: 'readme', label: 'README.md', hint: 'Dokumentasi endpoint & cara jalan' },
  { key: 'gitignore', label: '.gitignore' },
  { key: 'dockerfile', label: 'Dockerfile', hint: 'Image production non-root' },
  { key: 'compose', label: 'docker-compose.yml', hint: 'App + database + migration, satu perintah' },
  { key: 'postman', label: 'Postman collection', hint: 'Semua endpoint + auth + contoh body + test' },
];

// Port yang dipakai builder & Vite; kalau sama, server hasil generate bentrok saat dijalankan bersamaan
export const RESERVED_PORTS = { 5000: 'backend builder', 5173: 'Vite dev server' };

const API_PREFIX_RE = /^\/[A-Za-z0-9\-_/]*$/;
const ORIGIN_RE = /^https?:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?$/;
const BODY_LIMIT_RE = /^(\d{1,5})(kb|mb)$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

// Node lama / tanpa config tetap terbaca dengan default (nested object di-merge per key)
export const getServerConfig = (data) => {
  const c = data?.config ?? {};
  return {
    ...DEFAULT_SERVER_CONFIG,
    ...c,
    middleware: { ...DEFAULT_SERVER_CONFIG.middleware, ...c.middleware },
    tooling: { ...DEFAULT_SERVER_CONFIG.tooling, ...c.tooling },
  };
};
export const getDatabaseConfig = (data) => ({ ...DEFAULT_DATABASE_CONFIG, ...data?.config });

/** Mengembalikan { [field]: pesan } — kosong berarti valid. */
export function validateServerConfig(c) {
  const errors = {};
  const port = Number(c.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.port = 'Bilangan bulat 1–65535';
  if (!API_PREFIX_RE.test(c.apiPrefix) || (c.apiPrefix.length > 1 && c.apiPrefix.endsWith('/'))) {
    errors.apiPrefix = "Diawali '/', tanpa '/' di akhir, mis. /api";
  }
  if (c.middleware.cors && c.corsOrigin !== '*') {
    const origins = c.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
    if (origins.length === 0 || !origins.every((o) => ORIGIN_RE.test(o))) {
      errors.corsOrigin = '"*" atau URL http(s) dipisah koma';
    }
  }
  const limit = BODY_LIMIT_RE.exec(String(c.bodyLimit).toLowerCase());
  if (!limit || Number(limit[1]) === 0 || Number(limit[1]) * (limit[2] === 'mb' ? 1024 : 1) > 10 * 1024) {
    errors.bodyLimit = 'Format 100kb / 1mb, maks 10mb';
  }
  if (!SEMVER_RE.test(c.version)) errors.version = 'Format semver, mis. 1.0.0';
  return errors;
}

/**
 * Rakit payload `settings` untuk backend dari node di kanvas.
 * Server/Database pertama yang dipakai; backend memberi peringatan kalau ada lebih dari satu.
 */
export function buildSettings(projectName, nodes) {
  const server = nodes.find((n) => n.data?.kind === 'server');
  const database = nodes.find((n) => n.data?.kind === 'database');
  const { port, ...rest } = getServerConfig(server?.data);
  return {
    name: projectName,
    ...rest,
    port: Number(port),
    database: database ? getDatabaseConfig(database.data).driver : 'none',
    databaseName: database ? getDatabaseConfig(database.data).name : '',
  };
}
