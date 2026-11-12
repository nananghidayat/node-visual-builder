// Pengaturan proyek: default + normalisasi + validasi (jangan percaya input klien)
import { ValidationError } from './errors.js';

export const DEFAULT_SETTINGS = {
  name: 'my-generated-app',
  description: '',
  version: '1.0.0',
  author: '',
  license: 'MIT',
  port: 3000,
  apiPrefix: '/api',
  corsOrigin: '*',
  bodyLimit: '1mb',
  moduleSystem: 'commonjs',
  nodeVersion: '20',
  database: 'none',
  databaseName: '', // kosong = turunan nama proyek
  middleware: { cors: true, helmet: true, morgan: true, dotenv: true },
  tooling: { nodemon: true, readme: true, gitignore: true, dockerfile: false, compose: false, postman: true },
};

const NPM_NAME_RE = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const API_PREFIX_RE = /^\/[A-Za-z0-9\-_/]*$/;
const ORIGIN_RE = /^https?:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?$/;
const BODY_LIMIT_RE = /^(\d{1,5})(kb|mb)$/;
const BODY_LIMIT_MAX_KB = 10 * 1024;
// Aman untuk PostgreSQL (maks 63), MySQL (64), dan MongoDB; tanpa karakter yang perlu di-quote
const DB_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const ENUMS = {
  license: ['MIT', 'ISC', 'Apache-2.0', 'UNLICENSED'],
  moduleSystem: ['commonjs', 'esm'],
  nodeVersion: ['18', '20', '22'],
  database: ['none', 'mongodb', 'postgresql', 'mysql'],
};

export function normalizeSettings(raw = {}, legacyProjectName) {
  const pickBools = (defaults, input = {}) =>
    Object.fromEntries(Object.keys(defaults).map((k) => [k, typeof input[k] === 'boolean' ? input[k] : defaults[k]]));

  const s = {
    ...DEFAULT_SETTINGS,
    ...raw,
    name: String(raw.name ?? legacyProjectName ?? DEFAULT_SETTINGS.name).trim(),
    description: String(raw.description ?? '').trim(),
    author: String(raw.author ?? '').trim(),
    version: String(raw.version ?? DEFAULT_SETTINGS.version).trim(),
    apiPrefix: String(raw.apiPrefix ?? DEFAULT_SETTINGS.apiPrefix).trim(),
    corsOrigin: String(raw.corsOrigin ?? DEFAULT_SETTINGS.corsOrigin).trim(),
    bodyLimit: String(raw.bodyLimit ?? DEFAULT_SETTINGS.bodyLimit).trim().toLowerCase(),
    databaseName: String(raw.databaseName ?? '').trim(),
    nodeVersion: String(raw.nodeVersion ?? DEFAULT_SETTINGS.nodeVersion),
    port: Number(raw.port ?? DEFAULT_SETTINGS.port),
    middleware: pickBools(DEFAULT_SETTINGS.middleware, raw.middleware),
    tooling: pickBools(DEFAULT_SETTINGS.tooling, raw.tooling),
  };

  const errors = {};
  if (!NPM_NAME_RE.test(s.name) || s.name.length > 214) errors.name = 'Nama proyek tidak valid untuk npm.';
  if (!SEMVER_RE.test(s.version)) errors.version = 'Versi harus semver (mis. 1.0.0).';
  if (!Number.isInteger(s.port) || s.port < 1 || s.port > 65535) errors.port = 'Port harus 1–65535.';
  if (!API_PREFIX_RE.test(s.apiPrefix) || (s.apiPrefix.length > 1 && s.apiPrefix.endsWith('/'))) {
    errors.apiPrefix = "Prefix API harus diawali '/' dan tanpa '/' di akhir.";
  }
  // CORS: "*" atau daftar origin dipisah koma, mis. "http://localhost:5173, https://app.example.com"
  const origins = s.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  if (s.corsOrigin !== '*' && (origins.length === 0 || !origins.every((o) => ORIGIN_RE.test(o)))) {
    errors.corsOrigin = 'CORS origin harus "*" atau daftar URL http(s) dipisah koma.';
  } else if (s.corsOrigin !== '*') {
    s.corsOrigin = origins.join(',');
  }
  if (s.databaseName && !DB_NAME_RE.test(s.databaseName)) {
    errors.databaseName = 'Nama database: huruf, angka, _; diawali huruf/_; maks 63 karakter.';
  }
  const limit = BODY_LIMIT_RE.exec(s.bodyLimit);
  if (!limit || Number(limit[1]) * (limit[2] === 'mb' ? 1024 : 1) > BODY_LIMIT_MAX_KB || Number(limit[1]) === 0) {
    errors.bodyLimit = 'Batas body harus format seperti 100kb atau 1mb (maks 10mb).';
  }
  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (!allowed.includes(s[key])) errors[key] = `${key} harus salah satu dari: ${allowed.join(', ')}.`;
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  // docker-compose.yml butuh Dockerfile untuk membangun image app
  if (s.tooling.compose) s.tooling.dockerfile = true;
  return s;
}
