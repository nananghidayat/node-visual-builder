// Runner migration tanpa dependency tambahan.
//   npm run db:migrate          terapkan semua migration yang belum dijalankan
//   npm run db:status           lihat status tiap migration
//   npm run db:new -- nama      buat file migration baru (mis. add_email_to_users)
//
// Aturan: JANGAN edit file migration yang sudah diterapkan. Buat migration baru.
// Runner menyimpan checksum tiap file dan menolak jalan kalau file lama berubah.

const MIGRATIONS_DIR = path.join(SCRIPT_DIR, '..', 'db', 'migrations');
const FILE_RE = /^(\d+)_[a-z0-9_]+\.sql$/;
const LOCK_KEY = 'schema_migrations';

const checksum = (sql) => crypto.createHash('sha256').update(sql).digest('hex');

function listMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => FILE_RE.test(name))
    .sort((a, b) => Number(FILE_RE.exec(a)[1]) - Number(FILE_RE.exec(b)[1]))
    .map((name) => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
      return { name, sql, checksum: checksum(sql) };
    });
}

/*__ADAPTER__*/

async function readApplied(db) {
  await db.exec(CREATE_TABLE);
  const rows = await db.query('SELECT name, checksum FROM schema_migrations');
  return new Map(rows.map((r) => [r.name, String(r.checksum).trim()]));
}

async function migrate() {
  const db = await connect();
  try {
    await db.lock(); // cegah dua proses deploy menjalankan migration bersamaan
    const applied = await readApplied(db);
    const files = listMigrations();

    const changed = files.filter((f) => applied.has(f.name) && applied.get(f.name) !== f.checksum);
    if (changed.length) {
      throw new Error(
        `Migration sudah diterapkan tapi isinya berubah: ${changed.map((f) => f.name).join(', ')}. ` +
          'Kembalikan isi file itu, lalu buat perubahan di migration baru (npm run db:new -- nama).'
      );
    }

    const pending = files.filter((f) => !applied.has(f.name));
    if (pending.length === 0) {
      console.log('Skema sudah terbaru, tidak ada migration baru.');
      return;
    }

    for (const f of pending) {
      process.stdout.write(`→ ${f.name} ... `);
      if (db.transactional) await db.exec('BEGIN');
      try {
        await db.exec(f.sql);
        await db.query(INSERT_APPLIED, [f.name, f.checksum]);
        if (db.transactional) await db.exec('COMMIT');
      } catch (err) {
        if (db.transactional) await db.exec('ROLLBACK').catch(() => {});
        console.log('GAGAL');
        throw new Error(`${f.name}: ${err.message}`, { cause: err });
      }
      console.log('ok');
    }
    console.log(`${pending.length} migration diterapkan.`);
  } finally {
    await db.unlock().catch(() => {});
    await db.close();
  }
}

async function status() {
  const db = await connect();
  try {
    const applied = await readApplied(db);
    const files = listMigrations();
    const names = new Set(files.map((f) => f.name));
    for (const f of files) {
      const mark = !applied.has(f.name) ? '•  pending ' : applied.get(f.name) === f.checksum ? '✓  applied ' : '⚠  BERUBAH ';
      console.log(`${mark} ${f.name}`);
    }
    for (const name of applied.keys()) {
      if (!names.has(name)) console.log(`⚠  HILANG   ${name} (tercatat di database, file tidak ada)`);
    }
    if (files.length === 0) console.log('Belum ada file migration.');
  } finally {
    await db.close();
  }
}

function newMigration(rawName) {
  const name = String(rawName || '').trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (!name) throw new Error('Nama migration wajib diisi, mis. npm run db:new -- add_email_to_users');
  fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  const last = listMigrations().reduce((max, f) => Math.max(max, Number(FILE_RE.exec(f.name)[1])), 0);
  const file = `${String(last + 1).padStart(3, '0')}_${name}.sql`;
  fs.writeFileSync(
    path.join(MIGRATIONS_DIR, file),
    `-- ${name}\n-- Tulis perubahan skema di sini. Jangan edit file ini setelah diterapkan.\n\n`
  );
  console.log(`Dibuat: db/migrations/${file}`);
}

const [command = 'up', ...args] = process.argv.slice(2);
const commands = { up: migrate, status, new: () => newMigration(args.join('_')) };

if (!commands[command]) {
  console.error(`Perintah tidak dikenal: "${command}". Pakai: up | status | new <nama>`);
  process.exit(1);
}

Promise.resolve()
  .then(() => {
    if (command !== 'new' && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL belum di-set. Salin .env.example ke .env lalu isi connection string.');
    }
    return commands[command]();
  })
  .catch((err) => {
    console.error(`Migration gagal: ${err.message}`);
    process.exit(1);
  });
