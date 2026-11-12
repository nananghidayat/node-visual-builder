import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateProject, ValidationError, ConflictError } from './generator/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

// Semua hasil generate dikumpulkan di sini, terpisah dari kode server builder
const OUTPUT_ROOT = path.join(__dirname, 'generated');

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.post('/api/generate-project', (req, res) => {
  try {
    const result = generateProject(req.body ?? {}, OUTPUT_ROOT);
    res.json({
      success: true,
      message: `Proyek "${result.folder}" berhasil dibuat (${result.files.length} file).`,
      path: result.dir,
      files: result.files,
      warnings: result.warnings,
      previewStructure: result.previewStructure,
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      return res.status(409).json({ success: false, code: 'PROJECT_EXISTS', message: err.message });
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({ success: false, message: err.message, errors: err.errors });
    }
    console.error('Generate gagal:', err);
    res.status(500).json({ success: false, message: 'Gagal menulis proyek ke disk. Cek log server.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server berjalan di http://localhost:${PORT}`);
});
