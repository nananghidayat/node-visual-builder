// Penulisan proyek ke disk + render pohon direktori
import fs from 'fs';
import path from 'path';
import { ConflictError, ValidationError } from './errors.js';

export function resolveProjectDir(outputRoot, name) {
  const folder = name.replace(/^@/, '').replace('/', '__');
  const root = path.resolve(outputRoot);
  const dir = path.resolve(root, folder);
  // Cegah path traversal: hasil harus berada DI DALAM outputRoot, bukan outputRoot itu sendiri
  if (path.dirname(dir) !== root) throw new ValidationError({ name: 'Nama proyek menghasilkan path yang tidak aman.' });
  return { folder, dir };
}

export function writeProject(dir, folder, files) {
  // mkdirSync non-recursive = cek-dan-klaim atomik: gagal EEXIST kalau folder sudah ada,
  // jadi dua request bersamaan dengan nama sama tidak bisa saling menimpa.
  try {
    fs.mkdirSync(dir);
  } catch (err) {
    if (err.code === 'EEXIST') {
      throw new ConflictError(
        `Nama proyek "${folder}" sudah ada. Gagal membuat folder; gunakan nama lain atau hapus folder generated/${folder} terlebih dahulu.`
      );
    }
    throw err;
  }
  try {
    for (const [rel, content] of Object.entries(files)) {
      const target = path.join(dir, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true }); // jangan tinggalkan folder setengah jadi
    throw err;
  }
}

export function renderTree(rootName, filePaths) {
  const tree = {};
  for (const p of filePaths) {
    const parts = p.split('/');
    let cur = tree;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) cur[part] = null;
      else cur = cur[part] ??= {};
    });
  }
  const lines = [`📁 ${rootName}/`];
  const walk = (node, prefix) => {
    const keys = Object.keys(node).sort(
      (a, b) => (node[a] === null) - (node[b] === null) || a.localeCompare(b)
    );
    keys.forEach((k, i) => {
      const last = i === keys.length - 1;
      const isDir = node[k] !== null;
      lines.push(`${prefix}${last ? '└── ' : '├── '}${isDir ? '📁' : '📄'} ${k}${isDir ? '/' : ''}`);
      if (isDir) walk(node[k], prefix + (last ? '    ' : '│   '));
    });
  };
  walk(tree, ' ');
  return lines.join('\n');
}
