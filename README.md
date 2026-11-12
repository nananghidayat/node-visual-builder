<<<<<<< HEAD
<div align="center">

<img src="client/public/favicon.svg" width="72" alt="Node Visual Builder" />

# Node Visual Builder

**Rancang REST API Express secara visual, lalu generate proyek Node.js yang siap dijalankan.**

Susun server, endpoint, dan database sebagai node di kanvas. Atur auth, parameter, dan body per endpoint. Satu klik menghasilkan proyek lengkap dengan validasi, migration, Docker Compose, dan Postman collection.

</div>

---

## Fitur

### Kanvas visual

- Node **Server**, **GET / POST / PUT / PATCH / DELETE**, dan **Database**, dengan warna per tipe dan minimap
- Tambah node lewat drag dari sidebar atau **double-click**. Sidebar bisa diciutkan jadi rail ikon
- **Undo / redo**, seleksi blok (mode Select), hapus banyak node sekaligus
- Panel properti untuk setiap node, dengan draft dan tombol Simpan (satu kali simpan = satu langkah undo)
- Tema gelap/terang, panel sidebar & preview bisa di-resize

### Konfigurasi per node

| Node | Yang bisa diatur |
|---|---|
| **Server** | Port, prefix API, CORS origin, batas ukuran body, CommonJS/ESM, versi Node, middleware (CORS, Helmet, Morgan, dotenv), metadata `package.json`, file tambahan (nodemon, README, Dockerfile, docker-compose, Postman) |
| **Endpoint** | Path, auth (Publik / API Key / JWT), path & query parameter bertipe, field body bertipe dengan status wajib |
| **Database** | Driver (MongoDB, PostgreSQL, MySQL) dan nama database |

Validasi yang sama dijalankan di frontend dan di backend generator, termasuk deteksi route yang bentrok (`GET /users/:id` vs `GET /users/:slug`).

### Proyek yang dihasilkan

- Express dengan struktur `routes/`, `controllers/`, `middleware/`, `config/`
- **Validasi request** per endpoint: konversi tipe, field wajib, error `400` per field, dan field asing di body dibuang
- **Auth** API Key (perbandingan timing-safe) atau JWT HS256, dengan secret acak di `.env`
- **Database**: mongoose, pg, atau mysql2, dengan pesan error koneksi yang jelas
- **Migration SQL** bernomor (`npm run db:migrate | db:status | db:new`), dengan checksum dan lock
- **Docker Compose**: service database, migration, dan aplikasi dengan healthcheck
- **Postman collection** berisi semua endpoint, auth, contoh body, dan test. Request POST menyimpan id baru untuk dipakai request berikutnya
- README proyek berisi tabel endpoint, cara setup, dan contoh `curl`

---

## Cara kerja

```
┌──────────────┐      ┌────────────────────┐      ┌──────────────┐
│ Start Server │ ───▶ │ GET /users/:id     │ ───▶ │   Database   │
│ :3000  /api  │      │ POST /users  (JWT) │      │    MySQL     │
└──────────────┘      └────────────────────┘      └──────────────┘
```

- **Server → Method**: endpoint di-mount ke server
- **Method → Database**: controller endpoint memakai database sungguhan. Tanpa koneksi ini, endpoint memakai data contoh in-memory
- Arah panah tidak berpengaruh, karena koneksi dibaca dua arah

---

## Menjalankan

### Prasyarat

- Node.js 18 atau lebih baru
- npm

### Instalasi

```bash
git clone https://github.com/<username>/<repo>.git
cd <repo>

cd server && npm install && cd ..
cd client && npm install && cd ..
```

### Jalankan

Frontend dan backend generator berjalan di dua terminal terpisah:

```bash
# Terminal 1: backend generator (port 5000)
cd server
node index.js

# Terminal 2: frontend (Vite, port 5173)
cd client
npm run dev
```

Buka `http://localhost:5173`.

Hasil generate ditulis ke `server/generated/<nama-proyek>/`. Generate dengan nama yang sudah ada akan ditolak supaya tidak menimpa hasil sebelumnya.

---

## Pemakaian singkat

1. Isi **nama proyek** di header (huruf kecil, angka, `-`, `_`).
2. Klik node **Start Server** untuk mengatur port, prefix API, middleware, dan file tambahan.
3. Tambahkan node method, lalu klik untuk mengatur path, auth, parameter, dan body.
4. (Opsional) Tambahkan node **Database**, pilih driver, lalu hubungkan dari node method.
5. Klik **Generate Code**. Struktur folder dan peringatan (kalau ada) muncul di panel preview.
6. Masuk ke folder hasil generate, lalu ikuti README di dalamnya:

```bash
cd server/generated/<nama-proyek>
npm install
npm run db:migrate   # kalau memakai PostgreSQL/MySQL
npm run dev
```

atau, kalau docker-compose diaktifkan:

```bash
docker compose up --build
```

---

## Shortcut keyboard

| Shortcut | Aksi |
|---|---|
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl/⌘ + Shift + Z`, `Ctrl + Y` | Redo |
| `V` | Mode Select (drag untuk memblok) |
| `H` | Mode Pan (geser kanvas) |
| `Shift + drag` | Blok area di mode Pan |
| `Delete` / `Backspace` | Hapus node/koneksi terpilih |
| Double-click path endpoint | Ubah path |
| Double-click item sidebar | Tambah node di tengah kanvas |

---

## Struktur repositori

```
├── client/                      # Frontend (Vite + React + @xyflow/react)
│   ├── index.html
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── App.jsx
│       ├── api/                 # Pemanggilan backend generator
│       ├── components/          # Header, Toolbar, Sidebar, kanvas, panel properti
│       │   └── inspector/       # Panel Server, Endpoint, Database
│       ├── constants/           # Tipe node, aturan validasi, konfigurasi default
│       ├── context/
│       ├── hooks/               # Editor kanvas, undo/redo, resize panel, shortcut
│       ├── nodes/               # Komponen node kustom
│       └── styles/canvas.css
└── server/                      # Backend generator (Express, port 5000)
    ├── index.js                 # Endpoint POST /api/generate-project
    ├── generated/               # Output proyek (diabaikan git)
    └── generator/
        ├── graph.js             # Membaca graf node → resource & endpoint
        ├── settings.js          # Normalisasi & validasi pengaturan
        ├── fs.js                # Penulisan aman ke disk
        └── templates/           # Template file proyek hasil generate
```

---

## Keamanan & batasan

- **Hanya untuk dipakai di lokal.** Backend generator menulis file ke disk, tidak punya autentikasi, dan CORS-nya terbuka. Jangan deploy ke server publik.
- Nama proyek divalidasi dan path-nya dicek supaya tidak bisa keluar dari `server/generated/` (mencegah path traversal).
- Skema database hasil generate memakai tabel generik (`id`, `data` JSON, `created_at`) supaya langsung bisa dipakai. Untuk production, ganti dengan kolom yang spesifik lewat migration baru.
- Kode hasil generate sebaiknya di-review sebelum dipakai di production.

---

## Lisensi

Belum ditentukan. Tambahkan file `LICENSE` sesuai kebutuhan.
=======
# node-visual-builder
Rancang REST API Express secara visual di kanvas, lalu generate proyek Node.js lengkap: validasi, auth JWT/API Key, MongoDB/PostgreSQL/MySQL + migration, Docker Compose, dan Postman collection.
>>>>>>> 24e8cab2c49f3a9a0cd6fa1f322bd4b57220ea15
