// Template file level proyek: package.json, index.js, .env, README, Docker, .gitignore
import crypto from 'crypto';
import { composeDbEnv, usesCompose } from './compose.js';
import {
  AUTH_LABEL,
  DB_LABEL,
  DB_PACKAGE,
  DEP_VERSIONS,
  apiBase,
  dbNameOf,
  slugOf,
  fullPath,
  moduleSyntax,
  toIdentifier,
} from '../syntax.js';

export function packageJson(s, auth) {
  const deps = { express: DEP_VERSIONS.express };
  for (const m of ['cors', 'helmet', 'morgan', 'dotenv']) if (s.middleware[m]) deps[m] = DEP_VERSIONS[m];
  if (s.database !== 'none') deps[DB_PACKAGE[s.database]] = DEP_VERSIONS[DB_PACKAGE[s.database]];
  if (auth.jwt) deps.jsonwebtoken = DEP_VERSIONS.jsonwebtoken;

  const pkg = {
    name: s.name,
    version: s.version,
    ...(s.description && { description: s.description }),
    ...(s.author && { author: s.author }),
    license: s.license,
    ...(s.license === 'UNLICENSED' && { private: true }),
    type: s.moduleSystem === 'esm' ? 'module' : 'commonjs',
    main: 'index.js',
    scripts: {
      start: 'node index.js',
      ...(s.tooling.nodemon && { dev: 'nodemon index.js' }),
      ...(auth.jwt && { token: 'node scripts/create-token.js' }),
      ...(['postgresql', 'mysql'].includes(s.database) && {
        'db:migrate': 'node scripts/migrate.js up',
        'db:status': 'node scripts/migrate.js status',
        'db:new': 'node scripts/migrate.js new',
      }),
    },
    engines: { node: `>=${s.nodeVersion}` },
    dependencies: Object.fromEntries(Object.entries(deps).sort()),
    ...(s.tooling.nodemon && { devDependencies: { nodemon: DEP_VERSIONS.nodemon } }),
  };
  return JSON.stringify(pkg, null, 2) + '\n';
}

const requiredEnv = (auth) => [...(auth.apiKey ? ['API_KEY'] : []), ...(auth.jwt ? ['JWT_SECRET'] : [])];

export function indexJs(s, resources, auth) {
  const m = moduleSyntax(s.moduleSystem);
  const base = apiBase(s);
  const L = [];

  if (s.middleware.dotenv) L.push(m.sideEffect('dotenv/config'));
  L.push(m.def('express', 'express'));
  if (s.middleware.cors) L.push(m.def('cors', 'cors'));
  if (s.middleware.helmet) L.push(m.def('helmet', 'helmet'));
  if (s.middleware.morgan) L.push(m.def('morgan', 'morgan'));
  if (s.database !== 'none') L.push(m.named(['connectDB'], './config/db.js'));
  for (const r of resources.keys()) L.push(m.def(`${toIdentifier(r)}Routes`, `./routes/${r}.js`));

  const endpoints = [...resources.values()].flatMap((r) => r.endpoints.map((ep) => `${ep.method} ${fullPath(s, ep)}`));

  L.push('', 'const app = express();', `const PORT = Number(process.env.PORT) || ${s.port};`, '');
  if (s.middleware.helmet) L.push('app.use(helmet());');
  if (s.middleware.cors) {
    L.push(
      "// CORS_ORIGIN: \"*\" atau daftar origin dipisah koma",
      `const corsOrigin = process.env.CORS_ORIGIN || ${JSON.stringify(s.corsOrigin)};`,
      "app.use(cors({ origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map((o) => o.trim()) }));"
    );
  }
  if (s.middleware.morgan) L.push("app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));");
  L.push(
    `app.use(express.json({ limit: '${s.bodyLimit}' }));`,
    '',
    "app.get('/', (req, res) => {",
    '  res.json({',
    `    name: ${JSON.stringify(s.name)},`,
    `    version: ${JSON.stringify(s.version)},`,
    `    endpoints: ${JSON.stringify(endpoints)},`,
    '  });',
    '});',
    '',
    "app.get('/health', (req, res) => {",
    "  res.json({ status: 'ok', uptime: process.uptime() });",
    '});',
    ''
  );
  for (const r of resources.keys()) L.push(`app.use('${base}/${r}', ${toIdentifier(r)}Routes);`);
  L.push(
    '',
    '// 404 untuk route yang tidak terdaftar',
    'app.use((req, res) => {',
    '  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} tidak ditemukan` });',
    '});',
    '',
    '// Error handler terpusat',
    '// eslint-disable-next-line no-unused-vars',
    'app.use((err, req, res, next) => {',
    '  const status = err.status || err.statusCode || 500;',
    '  if (status >= 500) console.error(err);',
    "  res.status(status).json({ success: false, message: status >= 500 ? 'Internal server error' : err.message });",
    '});',
    '',
    'async function start() {'
  );
  const envs = requiredEnv(auth);
  if (envs.length) {
    L.push(
      '  // Gagal cepat kalau secret auth belum di-set, daripada semua request ditolak diam-diam',
      `  const missing = ${JSON.stringify(envs)}.filter((key) => !process.env[key]);`,
      "  if (missing.length) throw new Error(`Environment variable belum di-set: ${missing.join(', ')}`);",
      ''
    );
  }
  if (s.database !== 'none') L.push('  await connectDB();');
  L.push(
    '  app.listen(PORT, () => {',
    `    console.log(\`${s.name} berjalan di http://localhost:\${PORT}\`);`,
    '  });',
    '}',
    '',
    'start().catch((err) => {',
    "  console.error('Gagal menjalankan server:', err);",
    '  process.exit(1);',
    '});',
    ''
  );
  return L.join('\n');
}

const exampleDbUrl = (s) =>
  ({
    mongodb: `mongodb://localhost:27017/${dbNameOf(s)}`,
    postgresql: `postgres://user:password@localhost:5432/${dbNameOf(s)}`,
    mysql: `mysql://user:password@localhost:3306/${dbNameOf(s)}`,
  })[s.database];

/**
 * example = true  → .env.example (placeholder, aman di-commit)
 * example = false → .env (secret acak sungguhan, di-.gitignore)
 */
export function envFile(s, auth, { example }) {
  const L = [`PORT=${s.port}`, 'NODE_ENV=development'];
  if (s.database !== 'none') {
    // Dengan compose, kredensial DB dipakai bersama oleh container database & aplikasi
    if (usesCompose(s)) L.push(...composeDbEnv(s, { example }));
    else L.push(`DATABASE_URL=${exampleDbUrl(s)}`);
  }
  if (s.middleware.cors) L.push(`CORS_ORIGIN=${s.corsOrigin}`);
  if (auth.apiKey) L.push(`API_KEY=${example ? 'ganti-dengan-api-key-rahasia' : crypto.randomBytes(24).toString('hex')}`);
  if (auth.jwt) L.push(`JWT_SECRET=${example ? 'ganti-dengan-string-acak-minimal-32-karakter' : crypto.randomBytes(48).toString('hex')}`);
  return L.join('\n') + '\n';
}

function describeEndpoint(s, ep) {
  const lines = [`### ${ep.method} \`${fullPath(s, ep)}\``, ''];
  lines.push(`- **Auth:** ${AUTH_LABEL[ep.auth]}`);
  if (ep.pathParams.length) {
    lines.push(`- **Path param:** ${ep.pathParams.map((p) => `\`${p.name}\` (${p.type === 'id' ? 'ID' : p.type})`).join(', ')}`);
  }
  if (ep.queryParams.length) {
    lines.push(`- **Query:** ${ep.queryParams.map((q) => `\`${q.name}\` (${q.type}${q.required ? ', wajib' : ''})`).join(', ')}`);
  }
  if (ep.body) {
    if (!ep.body.fields) lines.push('- **Body:** objek JSON bebas (tidak boleh kosong)');
    else {
      lines.push(`- **Body${ep.body.partial ? ' (semua opsional, minimal satu)' : ''}:**`);
      for (const f of ep.body.fields) lines.push(`  - \`${f.name}\`: ${f.type}${f.required ? ' — wajib' : ''}`);
    }
  }
  return lines.join('\n');
}

export function readme(s, resources, auth) {
  const isSql = ['postgresql', 'mysql'].includes(s.database);
  const all = [...resources.values()].flatMap((r) => r.endpoints.map((ep) => ({ ep, usesDb: r.usesDb })));
  const rows = all.map(
    ({ ep, usesDb }) =>
      `| ${ep.method} | \`${fullPath(s, ep)}\` | ${AUTH_LABEL[ep.auth]} | ${usesDb ? DB_LABEL[s.database] : 'In-memory (contoh)'} |`
  );
  const run = s.tooling.nodemon ? 'npm run dev   # mode development (auto-reload)\nnpm start     # mode production' : 'npm start';
  const createDb =
    s.database === 'postgresql'
      ? `createdb ${dbNameOf(s)}`
      : `mysql -u root -p -e "CREATE DATABASE ${dbNameOf(s)};"`;
  const dbInit = isSql
    ? `\n4. Buat database (sekali saja), lalu terapkan migration:\n   \`\`\`bash\n   ${createDb}\n   npm run db:migrate\n   \`\`\`\n`
    : '';
  const migrationDocs = isSql
    ? `\n## Migration database

Skema tabel dikelola lewat file SQL bernomor di \`db/migrations/\`. Status tiap file dicatat di tabel \`schema_migrations\`.

\`\`\`bash
npm run db:status               # lihat migration yang sudah/belum diterapkan
npm run db:new -- add_email     # buat db/migrations/002_add_email.sql
npm run db:migrate              # terapkan yang belum
\`\`\`

- **Jangan edit migration yang sudah diterapkan.** Runner menyimpan checksum dan akan menolak jalan kalau isinya berubah. Buat migration baru.
- **Production:** jalankan \`npm run db:migrate\` sebagai langkah deploy *sebelum* \`npm start\`.${
        s.database === 'mysql' ? '\n- MySQL tidak bisa me-rollback DDL (CREATE/ALTER auto-commit), jadi buat satu perubahan skema per file.' : ''
      }
`
    : '';
  const sample = all[0] ? `http://localhost:${s.port}${fullPath(s, all[0].ep).replace(/:id/g, '1')}` : `http://localhost:${s.port}/`;

  const authDocs = [];
  if (auth.apiKey) {
    authDocs.push(`### API Key\n\nKirim header \`x-api-key\` berisi nilai \`API_KEY\` dari \`.env\`:\n\n\`\`\`bash\ncurl -H "x-api-key: $API_KEY" ${sample}\n\`\`\``);
  }
  if (auth.jwt) {
    authDocs.push(`### JWT Bearer\n\nBuat token uji (berlaku 1 jam), lalu kirim di header \`Authorization\`:\n\n\`\`\`bash\nTOKEN=$(npm run --silent token -- user-123)\ncurl -H "Authorization: Bearer $TOKEN" ${sample}\n\`\`\`\n\nPayload token tersedia di \`req.user\` pada controller.`);
  }

  return `# ${s.name}

${s.description || 'REST API berbasis Express, digenerate oleh Node.js Visual Builder.'}

## Prasyarat

- Node.js ${s.nodeVersion} atau lebih baru${s.database !== 'none' ? `\n- ${DB_LABEL[s.database]} yang bisa diakses` : ''}

## Instalasi

1. Install dependency:
   \`\`\`bash
   npm install
   \`\`\`
2. Salin konfigurasi environment (lewati kalau \`.env\` sudah ada):
   \`\`\`bash
   cp .env.example .env
   \`\`\`
3. Sesuaikan isi \`.env\`${s.database !== 'none' ? ', terutama `DATABASE_URL`' : ''}${auth.apiKey || auth.jwt ? '. Ganti secret auth sebelum deploy' : ''}.
${dbInit}
## Menjalankan

\`\`\`bash
${run}
\`\`\`

Server berjalan di \`http://localhost:${s.port}\`.

## Endpoint

| Method | Path | Auth | Sumber data |
|---|---|---|---|
| GET | \`/\` | Publik | Info aplikasi |
| GET | \`/health\` | Publik | Health check |
${rows.join('\n')}

Request yang tidak lolos validasi dibalas \`400\` dengan daftar \`errors\` per field.

${all.map(({ ep }) => describeEndpoint(s, ep)).join('\n\n')}
${migrationDocs}${postmanDocs(s, auth)}${authDocs.length ? `\n## Autentikasi\n\n${authDocs.join('\n\n')}\n` : ''}${dockerDocs(s)}`;
}

function postmanDocs(s, auth) {
  if (!s.tooling.postman) return '';
  const secrets = [
    ...(auth.apiKey ? ['`apiKey` dengan nilai `API_KEY` dari `.env`'] : []),
    ...(auth.jwt ? ['`token` dengan hasil `npm run token`'] : []),
  ];
  return `
## Postman

1. Import \`postman/*.postman_collection.json\` dan \`postman/local.postman_environment.json\`, lalu pilih environment **${s.name} (local)**.
${secrets.length ? `2. Isi variabel ${secrets.join(' dan ')}.\n3` : '2'}. Jalankan satu folder lewat **Collection Runner**. Request POST menyimpan id data baru, lalu GET/PUT/PATCH/DELETE memakainya otomatis.
`;
}

function dockerDocs(s) {
  if (usesCompose(s)) {
    const db = s.database !== 'none';
    return `
## Docker Compose

\`\`\`bash
docker compose up --build        # ${db ? 'database + ' : ''}${['postgresql', 'mysql'].includes(s.database) ? 'migration + ' : ''}aplikasi
${db ? 'docker compose up -d db        # database saja, lalu jalankan npm run dev di host\n' : ''}docker compose down              # hentikan (tambah -v untuk menghapus data)
\`\`\`
${db ? `
- Kredensial database diambil dari \`DB_USER\`, \`DB_PASSWORD\`, \`DB_NAME\` di \`.env\`. Password dibuat acak saat generate.
- Password hanya dipakai saat volume database **pertama kali** dibuat. Kalau \`.env\` diganti setelahnya, jalankan \`docker compose down -v\` (data terhapus) atau ubah password langsung di database.
- Di dalam compose, \`DATABASE_URL\` otomatis menunjuk service \`db\`; nilai di \`.env\` (localhost) dipakai saat aplikasi jalan di host.
` : ''}`;
  }
  if (s.tooling.dockerfile) {
    return `\n## Docker\n\n\`\`\`bash\ndocker build -t ${slugOf(s)} .\ndocker run --env-file .env -p ${s.port}:${s.port} ${slugOf(s)}\n\`\`\`\n`;
  }
  return '';
}

export function gitignore(s) {
  const L = ['node_modules/', '.env', '.env.*', '!.env.example', 'npm-debug.log*', 'logs/', '*.log', '.DS_Store', 'coverage/'];
  if (s.tooling.postman) {
    // Collection tetap di-commit (dokumentasi API tim); environment berisi apiKey/token setelah diisi
    L.push('', '# Postman: environment berisi secret', 'postman/*.postman_environment.json');
  }
  return L.join('\n') + '\n';
}

export function dockerignore(s) {
  const L = ['node_modules', 'npm-debug.log', '.env', '.git'];
  // Tidak dibutuhkan saat runtime; jangan ikut masuk image
  if (s.tooling.postman) L.push('postman');
  if (s.tooling.readme) L.push('README.md');
  return L.join('\n') + '\n';
}

export function dockerfile(s) {
  return `FROM node:${s.nodeVersion}-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

USER node
EXPOSE ${s.port}
CMD ["node", "index.js"]
`;
}
