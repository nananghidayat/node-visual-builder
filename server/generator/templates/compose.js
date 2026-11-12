// Template docker-compose.yml + kredensial database yang dipakai bersama oleh .env & compose
import crypto from 'crypto';
import { dbNameOf, slugOf } from '../syntax.js';

const DB_SERVICE = {
  postgresql: {
    image: 'postgres:16-alpine',
    port: 5432,
    volumePath: '/var/lib/postgresql/data',
    env: { POSTGRES_USER: '${DB_USER}', POSTGRES_PASSWORD: '${DB_PASSWORD}', POSTGRES_DB: '${DB_NAME}' },
    healthcheck: '["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]',
    startPeriod: '10s',
  },
  mysql: {
    image: 'mysql:8.4',
    port: 3306,
    volumePath: '/var/lib/mysql',
    env: {
      MYSQL_DATABASE: '${DB_NAME}',
      MYSQL_USER: '${DB_USER}',
      MYSQL_PASSWORD: '${DB_PASSWORD}',
      MYSQL_ROOT_PASSWORD: '${DB_ROOT_PASSWORD}',
    },
    healthcheck: '["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -u root -p$$MYSQL_ROOT_PASSWORD --silent"]',
    startPeriod: '30s', // inisialisasi pertama MySQL cukup lama
  },
  mongodb: {
    image: 'mongo:7',
    port: 27017,
    volumePath: '/data/db',
    env: {
      MONGO_INITDB_ROOT_USERNAME: '${DB_USER}',
      MONGO_INITDB_ROOT_PASSWORD: '${DB_PASSWORD}',
      MONGO_INITDB_DATABASE: '${DB_NAME}',
    },
    healthcheck: `["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]`,
    startPeriod: '10s',
  },
};

export const usesCompose = (s) => Boolean(s.tooling.compose);

export function databaseUrl(s, { user, password, name, host }) {
  const { port } = DB_SERVICE[s.database];
  if (s.database === 'mongodb') return `mongodb://${user}:${password}@${host}:${port}/${name}?authSource=admin`;
  const scheme = s.database === 'postgresql' ? 'postgres' : 'mysql';
  return `${scheme}://${user}:${password}@${host}:${port}/${name}`;
}

/**
 * Baris .env untuk database saat compose aktif.
 * Password acak (hex, aman di URL) hanya di .env; .env.example berisi placeholder.
 * DATABASE_URL di .env menunjuk localhost (untuk npm run dev di host);
 * di dalam compose, nilainya ditimpa supaya menunjuk service "db".
 */
export function composeDbEnv(s, { example }) {
  const creds = {
    user: 'app',
    password: example ? 'ganti-password' : crypto.randomBytes(18).toString('hex'),
    name: dbNameOf(s),
  };
  const L = [`DB_USER=${creds.user}`, `DB_PASSWORD=${creds.password}`, `DB_NAME=${creds.name}`];
  if (s.database === 'mysql') {
    L.push(`DB_ROOT_PASSWORD=${example ? 'ganti-password-root' : crypto.randomBytes(18).toString('hex')}`);
  }
  L.push(`DATABASE_URL=${databaseUrl(s, { ...creds, host: 'localhost' })}`);
  return L;
}

export function composeYml(s) {
  const db = s.database !== 'none' ? DB_SERVICE[s.database] : null;
  const isSql = s.database === 'postgresql' || s.database === 'mysql';
  const image = `${slugOf(s)}:latest`;
  const innerUrl = db ? databaseUrl(s, { user: '${DB_USER}', password: '${DB_PASSWORD}', name: '${DB_NAME}', host: 'db' }) : null;

  const L = [
    '# Semua service:        docker compose up --build',
    ...(db ? ['# Database saja (dev):  docker compose up -d db   lalu   npm run dev'] : []),
    '# Hentikan:             docker compose down        (tambah -v untuk hapus data)',
    '',
    'services:',
  ];

  if (db) {
    L.push(
      '  db:',
      `    image: ${db.image}`,
      '    restart: unless-stopped',
      '    environment:',
      ...Object.entries(db.env).map(([k, v]) => `      ${k}: ${v}`),
      '    ports:',
      `      - "${db.port}:${db.port}"`,
      '    volumes:',
      `      - db-data:${db.volumePath}`,
      '    healthcheck:',
      `      test: ${db.healthcheck}`,
      '      interval: 5s',
      '      timeout: 5s',
      '      retries: 20',
      `      start_period: ${db.startPeriod}`,
      ''
    );
  }

  if (isSql) {
    L.push(
      '  # Terapkan migration sekali lalu selesai; app baru start kalau ini sukses',
      '  migrate:',
      '    build: .',
      `    image: ${image}`,
      '    command: ["npm", "run", "db:migrate"]',
      '    env_file: .env',
      '    environment:',
      `      DATABASE_URL: ${innerUrl}`,
      '    depends_on:',
      '      db:',
      '        condition: service_healthy',
      '    restart: "no"',
      ''
    );
  }

  L.push(
    '  app:',
    '    build: .',
    `    image: ${image}`,
    '    restart: unless-stopped',
    '    env_file: .env',
    '    environment:',
    '      NODE_ENV: production',
    ...(innerUrl ? [`      DATABASE_URL: ${innerUrl}`] : []),
    '    ports:',
    `      - "${s.port}:${s.port}"`,
    '    healthcheck:',
    `      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:${s.port}/health || exit 1"]`,
    '      interval: 10s',
    '      timeout: 3s',
    '      retries: 5'
  );
  if (db) {
    L.push('    depends_on:', '      db:', '        condition: service_healthy');
    if (isSql) L.push('      migrate:', '        condition: service_completed_successfully');
  }
  if (db) L.push('', 'volumes:', '  db-data:');
  return L.join('\n') + '\n';
}
