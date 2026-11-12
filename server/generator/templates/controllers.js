// Template controller per resource. Satu handler per endpoint.
// Catatan penulisan: potongan kode hasil generate yang memakai template literal ditulis
// dalam string kutip tunggal supaya `${...}`-nya tidak dievaluasi oleh generator.
import { moduleSyntax, toPascal, toTable } from '../syntax.js';

const COLS = 'id, data, created_at';
const NOT_FOUND = "return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });";

// Ekspresi JS untuk filter, data baru, dan destructuring req.valid sebuah endpoint
function endpointExpressions(ep) {
  const hasId = ep.pathParams.some((p) => p.name === 'id');
  const extraPath = ep.pathParams.filter((p) => p.name !== 'id').map((p) => p.name);
  const usesQueryAsFilter = ep.method !== 'POST' && ep.queryParams.length > 0;

  const filterParts = [...(usesQueryAsFilter ? ['...queryParams'] : []), ...extraPath.map((n) => `${n}: params.${n}`)];
  const filters = filterParts.length ? `{ ${filterParts.join(', ')} }` : '{}';
  const pathMerge = extraPath.map((n) => `, ${n}: params.${n}`).join('');
  // Path param non-id ikut disimpan supaya filter yang sama tetap cocok saat dibaca lagi
  const newFields = `...body${pathMerge}`;

  const destructure = [
    ...(hasId || extraPath.length ? ['params'] : []),
    // Alias: nama `query` dipakai fungsi database di controller SQL
    ...(usesQueryAsFilter ? ['query: queryParams'] : []),
    ...(ep.body ? ['body'] : []),
  ];
  return {
    hasId,
    filters,
    hasFilters: filterParts.length > 0,
    newFields,
    newData: `{ ${newFields} }`,
    prelude: destructure.length ? [`  const { ${destructure.join(', ')} } = req.valid;`] : [],
  };
}

const asyncHandler = (name, prelude, body) => [
  `const ${name} = async (req, res, next) => {`,
  ...prelude,
  '  try {',
  ...body.map((line) => `    ${line}`),
  '  } catch (err) {',
  '    next(err);',
  '  }',
  '};',
  '',
];

const syncHandler = (name, prelude, body) => [
  `const ${name} = (req, res) => {`,
  ...prelude,
  ...body.map((line) => `  ${line}`),
  '};',
  '',
];

// ---------------------------------------------------------------------------
// In-memory
// ---------------------------------------------------------------------------
function memoryHandler(ep) {
  const x = endpointExpressions(ep);
  const pick = `(item) => item.id === params.id${x.hasFilters ? ` && matches(item, ${x.filters})` : ''}`;
  const findIndex = [`const index = items.findIndex(${pick});`, `if (index === -1) ${NOT_FOUND}`];

  const body = {
    GET: x.hasId
      ? [`const item = items.find(${pick});`, `if (!item) ${NOT_FOUND}`, 'res.json({ success: true, data: item });']
      : [`res.json({ success: true, data: ${x.hasFilters ? `items.filter((item) => matches(item, ${x.filters}))` : 'items'} });`],
    POST: [`const item = { ${x.newFields}, id: nextId++ };`, 'items.push(item);', 'res.status(201).json({ success: true, data: item });'],
    PUT: [...findIndex, `items[index] = { ${x.newFields}, id: params.id };`, 'res.json({ success: true, data: items[index] });'],
    PATCH: [...findIndex, 'items[index] = { ...items[index], ...body, id: params.id };', 'res.json({ success: true, data: items[index] });'],
    DELETE: [...findIndex, 'const [deleted] = items.splice(index, 1);', 'res.json({ success: true, data: deleted });'],
  }[ep.method];
  return syncHandler(ep.handler, x.prelude, body);
}

// ---------------------------------------------------------------------------
// MongoDB (mongoose)
// ---------------------------------------------------------------------------
function mongoHandler(ep, Model) {
  const x = endpointExpressions(ep);
  const byId = x.hasFilters ? `{ _id: params.id, ...${x.filters} }` : '{ _id: params.id }';
  const opts = "{ returnDocument: 'after', runValidators: true }";
  const found = [`if (!data) ${NOT_FOUND}`, 'res.json({ success: true, data });'];

  const body = {
    GET: x.hasId
      ? [`const data = await ${Model}.findOne(${byId}).lean();`, ...found]
      : [`const data = await ${Model}.find(${x.filters}).sort({ createdAt: -1 }).lean();`, 'res.json({ success: true, data });'],
    POST: [`const data = await ${Model}.create(${x.newData});`, 'res.status(201).json({ success: true, data });'],
    PUT: [`const data = await ${Model}.findOneAndReplace(${byId}, ${x.newData}, ${opts}).lean();`, ...found],
    PATCH: [`const data = await ${Model}.findOneAndUpdate(${byId}, { $set: body }, ${opts}).lean();`, ...found],
    DELETE: [`const data = await ${Model}.findOneAndDelete(${byId}).lean();`, ...found],
  }[ep.method];
  return asyncHandler(ep.handler, x.prelude, body);
}

// ---------------------------------------------------------------------------
// PostgreSQL & MySQL (tabel generik: id, data JSON, created_at)
// ---------------------------------------------------------------------------
function sqlWhereHelper(db) {
  const idClause = db === 'postgresql' ? '`id = $${values.length}`' : "'id = ?'";
  const fieldClause =
    db === 'postgresql' ? "`data->>'${key}' = $${values.length}`" : "`JSON_UNQUOTE(JSON_EXTRACT(data, '$.${key}')) = ?`";
  return [
    '// Bangun klausa WHERE dari id + filter. Nama field sudah divalidasi middleware, dicek ulang di sini.',
    'const FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;',
    'function where(filters, id) {',
    '  const clauses = [];',
    '  const values = [];',
    '  if (id !== undefined) {',
    '    values.push(id);',
    `    clauses.push(${idClause});`,
    '  }',
    '  for (const [key, value] of Object.entries(filters)) {',
    '    if (!FIELD_RE.test(key)) throw new Error(`Field filter tidak valid: ${key}`);',
    '    values.push(String(value));',
    `    clauses.push(${fieldClause});`,
    '  }',
    "  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', values };",
    '}',
    '',
  ];
}

function postgresHandler(ep, table) {
  const x = endpointExpressions(ep);
  const w = `const w = where(${x.filters}${x.hasId ? ', params.id' : ''});`;
  const found = [`if (!data) ${NOT_FOUND}`, 'res.json({ success: true, data });'];

  const body = {
    GET: x.hasId
      ? [w, 'const [data] = await query(`SELECT ' + COLS + ' FROM ' + table + '${w.sql}`, w.values);', ...found]
      : [w, 'const data = await query(`SELECT ' + COLS + ' FROM ' + table + '${w.sql} ORDER BY id DESC`, w.values);', 'res.json({ success: true, data });'],
    POST: [
      `const [data] = await query('INSERT INTO ${table} (data) VALUES ($1) RETURNING ${COLS}', [${x.newData}]);`,
      'res.status(201).json({ success: true, data });',
    ],
    PUT: [w, 'const [data] = await query(`UPDATE ' + table + ' SET data = $${w.values.length + 1}${w.sql} RETURNING ' + COLS + '`, [...w.values, ' + x.newData + ']);', ...found],
    PATCH: [w, 'const [data] = await query(`UPDATE ' + table + ' SET data = data || $${w.values.length + 1}::jsonb${w.sql} RETURNING ' + COLS + '`, [...w.values, body]);', ...found],
    DELETE: [w, 'const [data] = await query(`DELETE FROM ' + table + '${w.sql} RETURNING ' + COLS + '`, w.values);', ...found],
  }[ep.method];
  return asyncHandler(ep.handler, x.prelude, body);
}

function mysqlHandler(ep, table) {
  const x = endpointExpressions(ep);
  const w = `const w = where(${x.filters}${x.hasId ? ', params.id' : ''});`;
  const selectById = (idExpr) => `const [data] = await query('SELECT ${COLS} FROM ${table} WHERE id = ?', [${idExpr}]);`;
  const updated = [`if (result.affectedRows === 0) ${NOT_FOUND}`, selectById('params.id'), 'res.json({ success: true, data });'];

  const body = {
    GET: x.hasId
      ? [w, 'const [data] = await query(`SELECT ' + COLS + ' FROM ' + table + '${w.sql}`, w.values);', `if (!data) ${NOT_FOUND}`, 'res.json({ success: true, data });']
      : [w, 'const data = await query(`SELECT ' + COLS + ' FROM ' + table + '${w.sql} ORDER BY id DESC`, w.values);', 'res.json({ success: true, data });'],
    POST: [
      `const result = await query('INSERT INTO ${table} (data) VALUES (?)', [JSON.stringify(${x.newData})]);`,
      selectById('result.insertId'),
      'res.status(201).json({ success: true, data });',
    ],
    PUT: [w, 'const result = await query(`UPDATE ' + table + ' SET data = ?${w.sql}`, [JSON.stringify(' + x.newData + '), ...w.values]);', ...updated],
    PATCH: [w, 'const result = await query(`UPDATE ' + table + ' SET data = JSON_MERGE_PATCH(data, ?)${w.sql}`, [JSON.stringify(body), ...w.values]);', ...updated],
    DELETE: [
      w,
      'const [data] = await query(`SELECT ' + COLS + ' FROM ' + table + '${w.sql}`, w.values);',
      `if (!data) ${NOT_FOUND}`,
      `await query('DELETE FROM ${table} WHERE id = ?', [params.id]);`,
      'res.json({ success: true, data });',
    ],
  }[ep.method];
  return asyncHandler(ep.handler, x.prelude, body);
}

// ---------------------------------------------------------------------------
export function controllerJs(s, resource, { endpoints, usesDb }) {
  const m = moduleSyntax(s.moduleSystem);
  const db = usesDb ? s.database : 'none';
  const L = [];

  if (db === 'mongodb') L.push(m.def(toPascal(resource), `../models/${resource}.js`), '');
  if (db === 'postgresql' || db === 'mysql') {
    L.push(m.named(['query'], '../config/db.js'), '');
    if (endpoints.some((ep) => ep.method !== 'POST')) L.push(...sqlWhereHelper(db));
  }
  if (db === 'none') {
    L.push(
      '// Data contoh in-memory: hilang saat server restart.',
      '// Hubungkan endpoint ke node Database di builder untuk memakai database sungguhan.',
      'const items = [',
      "  { id: 1, name: 'Contoh 1' },",
      "  { id: 2, name: 'Contoh 2' },",
      '];',
      'let nextId = items.length + 1;',
      ''
    );
    if (endpoints.some((ep) => endpointExpressions(ep).hasFilters)) {
      L.push('const matches = (item, filters) => Object.entries(filters).every(([key, value]) => item[key] === value);', '');
    }
  }

  for (const ep of endpoints) {
    if (db === 'none') L.push(...memoryHandler(ep));
    else if (db === 'mongodb') L.push(...mongoHandler(ep, toPascal(resource)));
    else if (db === 'postgresql') L.push(...postgresHandler(ep, toTable(resource)));
    else L.push(...mysqlHandler(ep, toTable(resource)));
  }

  L.push(m.exportNamed(endpoints.map((ep) => ep.handler)), '');
  return L.join('\n');
}
