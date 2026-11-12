const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(255) PRIMARY KEY,
  checksum CHAR(64) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;
const INSERT_APPLIED = 'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)';

// Satu koneksi khusus (bukan pool) supaya BEGIN/COMMIT dan advisory lock berada di sesi yang sama
async function connect() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return {
    transactional: true, // PostgreSQL mendukung DDL di dalam transaksi
    query: async (sql, params) => (await client.query(sql, params)).rows,
    exec: (sql) => client.query(sql),
    lock: () => client.query('SELECT pg_advisory_lock(hashtext($1))', [LOCK_KEY]),
    unlock: () => client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_KEY]),
    close: () => client.end(),
  };
}
