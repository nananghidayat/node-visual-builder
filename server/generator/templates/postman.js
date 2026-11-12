// Template Postman Collection v2.1 + Environment untuk proyek hasil generate
import crypto from 'crypto';
import { AUTH_LABEL, apiBase, fullPath, toIdentifier } from '../syntax.js';

const SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

// Urutan yang enak dijalankan di Collection Runner: buat data dulu, baru baca/ubah/hapus
const RUN_ORDER = ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'];

const EXAMPLE_VALUE = {
  string: 'contoh',
  number: 1,
  boolean: true,
  object: {},
  array: [],
};
const PARAM_EXAMPLE = { string: 'contoh', number: '1', boolean: 'true' };

const idVariable = (resource) => `${toIdentifier(resource)}Id`;

function exampleBody(body) {
  if (!body.fields) return { name: 'Contoh' }; // body bebas
  return Object.fromEntries(body.fields.map((f) => [f.name, EXAMPLE_VALUE[f.type]]));
}

function authOf(ep) {
  if (ep.auth === 'apiKey') {
    return {
      type: 'apikey',
      apikey: [
        { key: 'key', value: 'x-api-key', type: 'string' },
        { key: 'value', value: '{{apiKey}}', type: 'string' },
        { key: 'in', value: 'header', type: 'string' },
      ],
    };
  }
  if (ep.auth === 'jwt') return { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] };
  return { type: 'noauth' };
}

function testScript(ep) {
  const expected = ep.method === 'POST' ? 201 : 200;
  const lines = [
    `pm.test('Status ${expected}', () => pm.response.to.have.status(${expected}));`,
    "pm.test('success: true', () => pm.expect(pm.response.json().success).to.eql(true));",
  ];
  if (ep.method === 'POST') {
    lines.push(
      '',
      '// Simpan id data baru supaya request GET/PUT/PATCH/DELETE berikutnya langsung memakainya',
      'const data = pm.response.json().data || {};',
      'const id = data.id ?? data._id;',
      `if (id !== undefined) pm.collectionVariables.set('${idVariable(ep.resource)}', String(id));`
    );
  }
  return [{ listen: 'test', script: { type: 'text/javascript', exec: lines } }];
}

function urlOf(s, ep) {
  const path = fullPath(s, ep).split('/').filter(Boolean);
  const query = ep.queryParams.map((q) => ({
    key: q.name,
    value: PARAM_EXAMPLE[q.type],
    description: `${q.type}${q.required ? ', wajib' : ', opsional'}`,
    ...(q.required ? {} : { disabled: true }),
  }));
  const variable = ep.pathParams.map((p) => ({
    key: p.name,
    value: p.name === 'id' ? `{{${idVariable(ep.resource)}}}` : PARAM_EXAMPLE[p.type],
    description: p.name === 'id' ? 'Terisi otomatis setelah request POST' : p.type,
  }));
  const enabledQuery = query.filter((q) => !q.disabled).map((q) => `${q.key}=${q.value}`);
  return {
    raw: `{{baseUrl}}/${path.join('/')}${enabledQuery.length ? `?${enabledQuery.join('&')}` : ''}`,
    host: ['{{baseUrl}}'],
    path,
    ...(query.length && { query }),
    ...(variable.length && { variable }),
  };
}

function describe(ep) {
  const lines = [`Auth: ${AUTH_LABEL[ep.auth]}`];
  if (ep.body?.fields) {
    lines.push(
      '',
      ep.body.partial ? 'Body (semua opsional, minimal satu):' : 'Body:',
      ...ep.body.fields.map((f) => `- \`${f.name}\`: ${f.type}${f.required ? ' (wajib)' : ''}`)
    );
  } else if (ep.body) {
    lines.push('', 'Body: objek JSON bebas, tidak boleh kosong.');
  }
  return lines.join('\n');
}

function requestItem(s, ep) {
  const request = {
    method: ep.method,
    auth: authOf(ep),
    header: ep.body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
    url: urlOf(s, ep),
    description: describe(ep),
  };
  if (ep.body) {
    request.body = { mode: 'raw', raw: JSON.stringify(exampleBody(ep.body), null, 2), options: { raw: { language: 'json' } } };
  }
  return { name: `${ep.method} ${fullPath(s, ep)}`, event: testScript(ep), request };
}

export function postmanCollection(s, resources) {
  const folders = [...resources].map(([resource, { endpoints }]) => ({
    name: `${apiBase(s)}/${resource}`,
    item: [...endpoints]
      .sort((a, b) => RUN_ORDER.indexOf(a.method) - RUN_ORDER.indexOf(b.method) || a.pathParams.length - b.pathParams.length)
      .map((ep) => requestItem(s, ep)),
  }));

  const system = {
    name: 'Sistem',
    item: [
      { name: 'GET / (info aplikasi)', request: { method: 'GET', header: [], url: { raw: '{{baseUrl}}/', host: ['{{baseUrl}}'], path: [''] } } },
      {
        name: 'GET /health',
        event: [{ listen: 'test', script: { type: 'text/javascript', exec: ["pm.test('Status 200', () => pm.response.to.have.status(200));"] } }],
        request: { method: 'GET', header: [], url: { raw: '{{baseUrl}}/health', host: ['{{baseUrl}}'], path: ['health'] } },
      },
    ],
  };

  const variables = [
    { key: 'baseUrl', value: `http://localhost:${s.port}` },
    { key: 'apiKey', value: '', description: 'Isi dengan API_KEY dari .env' },
    { key: 'token', value: '', description: 'Isi dengan hasil npm run token' },
    // id default 1 cocok untuk data contoh in-memory/SQL; Mongo terisi setelah POST
    ...[...resources.keys()].map((r) => ({ key: idVariable(r), value: s.database === 'mongodb' ? '' : '1' })),
  ];

  return (
    JSON.stringify(
      {
        info: {
          _postman_id: crypto.randomUUID(),
          name: s.name,
          description: `${s.description || 'REST API digenerate oleh Node.js Visual Builder.'}\n\nJalankan folder lewat Collection Runner: request POST menyimpan id baru ke variabel, lalu dipakai request berikutnya.`,
          schema: SCHEMA,
        },
        item: [system, ...folders],
        variable: variables,
      },
      null,
      2
    ) + '\n'
  );
}

// Environment terpisah (mis. local/staging) supaya baseUrl & kredensial tidak perlu diedit di collection.
// Secret sengaja dikosongkan: file ini bisa ikut ter-commit.
export function postmanEnvironment(s, auth) {
  const values = [
    { key: 'baseUrl', value: `http://localhost:${s.port}`, type: 'default', enabled: true },
    ...(auth.apiKey ? [{ key: 'apiKey', value: '', type: 'secret', enabled: true }] : []),
    ...(auth.jwt ? [{ key: 'token', value: '', type: 'secret', enabled: true }] : []),
  ];
  return (
    JSON.stringify(
      { id: crypto.randomUUID(), name: `${s.name} (local)`, values, _postman_variable_scope: 'environment' },
      null,
      2
    ) + '\n'
  );
}
