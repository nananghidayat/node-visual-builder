// Template middleware proyek hasil generate: validasi request & autentikasi
import { moduleSyntax } from '../syntax.js';

export function validateJs(s) {
  const m = moduleSyntax(s.moduleSystem);
  return `// Validasi & konversi tipe untuk path param, query, dan body.
// Hasil yang sudah bersih disimpan di req.valid = { params, query, body }.
// Hanya field yang dideklarasikan yang diteruskan ke controller (cegah mass assignment).

const INVALID = Symbol('invalid');
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const TYPE_LABEL = { id: 'ID', number: 'angka', boolean: 'boolean (true/false)', string: 'teks', object: 'objek', array: 'array' };

function coerce(value, type, { fromString = false, idKind = 'int' } = {}) {
  switch (type) {
    case 'id':
      if (idKind === 'objectId') return typeof value === 'string' && OBJECT_ID_RE.test(value) ? value : INVALID;
      return /^\\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : INVALID;
    case 'number':
      if (typeof value === 'number') return Number.isFinite(value) ? value : INVALID;
      if (fromString && typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
      return INVALID;
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (fromString && (value === 'true' || value === 'false')) return value === 'true';
      return INVALID;
    case 'string':
      return typeof value === 'string' ? value : INVALID;
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : INVALID;
    case 'array':
      return Array.isArray(value) ? value : INVALID;
    default:
      return INVALID;
  }
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    const valid = { params: {}, query: {} };

    for (const p of schema.params ?? []) {
      const value = coerce(req.params[p.name], p.type, { fromString: true, idKind: schema.idKind });
      if (value === INVALID) errors.push({ field: \`params.\${p.name}\`, message: \`harus \${TYPE_LABEL[p.type]} yang valid\` });
      else valid.params[p.name] = value;
    }

    for (const q of schema.query ?? []) {
      const raw = req.query[q.name];
      if (raw === undefined || raw === '') {
        if (q.required) errors.push({ field: \`query.\${q.name}\`, message: 'wajib diisi' });
        continue;
      }
      const value = coerce(raw, q.type, { fromString: true });
      if (value === INVALID) errors.push({ field: \`query.\${q.name}\`, message: \`harus \${TYPE_LABEL[q.type]}\` });
      else valid.query[q.name] = value;
    }

    if (schema.body) {
      const body = req.body;
      if (!isPlainObject(body)) {
        errors.push({ field: 'body', message: 'harus berupa objek JSON' });
      } else if (!schema.body.fields) {
        // Body bebas: terima objek apa pun, kecuali id/_id yang dikelola server
        const clean = Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'id' && key !== '_id'));
        if (Object.keys(clean).length === 0) errors.push({ field: 'body', message: 'tidak boleh kosong' });
        else valid.body = clean;
      } else {
        valid.body = {};
        for (const f of schema.body.fields) {
          const raw = body[f.name];
          if (raw === undefined || raw === null) {
            if (f.required && !schema.body.partial) errors.push({ field: \`body.\${f.name}\`, message: 'wajib diisi' });
            continue;
          }
          const value = coerce(raw, f.type);
          if (value === INVALID) errors.push({ field: \`body.\${f.name}\`, message: \`harus \${TYPE_LABEL[f.type]}\` });
          else valid.body[f.name] = value;
        }
        if (schema.body.partial && errors.length === 0 && Object.keys(valid.body).length === 0) {
          errors.push({ field: 'body', message: 'minimal satu field harus diisi' });
        }
      }
    }

    if (errors.length) return res.status(400).json({ success: false, message: 'Validasi gagal', errors });
    req.valid = valid;
    next();
  };
}

${m.exportNamed(['validate'])}
`;
}

export function authJs(s, auth) {
  const m = moduleSyntax(s.moduleSystem);
  const L = [];
  if (auth.apiKey) L.push(m.def('crypto', 'crypto'));
  if (auth.jwt) L.push(m.def('jwt', 'jsonwebtoken'));
  L.push('');

  const names = [];
  if (auth.apiKey) {
    names.push('requireApiKey');
    L.push(
      '// Bandingkan dengan waktu konstan supaya tidak bisa ditebak lewat timing attack',
      'const safeEqual = (a, b) => {',
      '  const bufA = Buffer.from(String(a));',
      '  const bufB = Buffer.from(String(b));',
      '  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);',
      '};',
      '',
      '// Header: x-api-key: <API_KEY>',
      'function requireApiKey(req, res, next) {',
      "  const key = req.get('x-api-key');",
      '  if (!key || !safeEqual(key, process.env.API_KEY)) {',
      "    return res.status(401).json({ success: false, message: 'API key tidak valid atau tidak ada' });",
      '  }',
      '  next();',
      '}',
      ''
    );
  }
  if (auth.jwt) {
    names.push('requireJwt');
    L.push(
      '// Header: Authorization: Bearer <token>. Payload token tersedia di req.user',
      'function requireJwt(req, res, next) {',
      "  const [scheme, token] = (req.get('authorization') || '').split(' ');",
      "  if (scheme !== 'Bearer' || !token) {",
      "    return res.status(401).json({ success: false, message: 'Token Bearer tidak ada' });",
      '  }',
      '  try {',
      "    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });",
      '    next();',
      '  } catch {',
      "    return res.status(401).json({ success: false, message: 'Token tidak valid atau kedaluwarsa' });",
      '  }',
      '}',
      ''
    );
  }
  L.push(m.exportNamed(names), '');
  return L.join('\n');
}

// Script bantu untuk membuat token uji: npm run token -- <user-id>
export function createTokenJs(s) {
  const m = moduleSyntax(s.moduleSystem);
  return [
    ...(s.middleware.dotenv ? [m.sideEffect('dotenv/config')] : []),
    m.def('jwt', 'jsonwebtoken'),
    '',
    'if (!process.env.JWT_SECRET) {',
    "  console.error('JWT_SECRET belum di-set di environment.');",
    '  process.exit(1);',
    '}',
    '',
    "const sub = process.argv[2] || 'dev-user';",
    "const token = jwt.sign({ sub }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });",
    'console.log(token);',
    '',
  ].join('\n');
}
