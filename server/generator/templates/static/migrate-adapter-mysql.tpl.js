const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(255) PRIMARY KEY,
  checksum CHAR(64) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;
const INSERT_APPLIED = 'INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)';

// multipleStatements: satu file migration boleh berisi beberapa statement
async function connect() {
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  return {
    // DDL di MySQL auto-commit, jadi transaksi tidak bisa membatalkan CREATE/ALTER.
    // Karena itu: satu perubahan skema per file migration.
    transactional: false,
    query: async (sql, params) => (await conn.query(sql, params))[0],
    exec: (sql) => conn.query(sql),
    lock: async () => {
      const [[row]] = await conn.query('SELECT GET_LOCK(?, 30) AS ok', [LOCK_KEY]);
      if (row.ok !== 1) throw new Error('Gagal mengambil lock migration. Ada proses migrate lain yang sedang jalan?');
    },
    unlock: () => conn.query('SELECT RELEASE_LOCK(?)', [LOCK_KEY]),
    close: () => conn.end(),
  };
}
