// Konfigurasi per endpoint: auth, parameter (path/query), dan body.
// Aturan validasi di sini HARUS sama dengan server/generator/graph.js (normalizeEndpoint).

export const AUTH_OPTIONS = [
  { value: 'none', label: 'Publik', icon: 'fa-globe' },
  { value: 'apiKey', label: 'API Key', icon: 'fa-key' },
  { value: 'jwt', label: 'JWT', icon: 'fa-lock' },
];
export const AUTH_LABEL = Object.fromEntries(AUTH_OPTIONS.map((o) => [o.value, o.label]));

export const PARAM_TYPES = ['string', 'number', 'boolean'];
export const BODY_TYPES = ['string', 'number', 'boolean', 'object', 'array'];

export const BODY_KINDS = new Set(['post', 'put', 'patch']);
export const ID_REQUIRED_KINDS = new Set(['put', 'patch', 'delete']);

const FIELD_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
const RESERVED_BODY_FIELDS = new Set(['id', '_id']);
export const MAX_PARAMS = 10;
export const MAX_BODY_FIELDS = 30;

export const ID_PARAM = { name: 'id', in: 'path', type: 'id', required: true };

export const defaultEndpointConfig = (kind) => ({
  auth: 'none',
  params: ID_REQUIRED_KINDS.has(kind) ? [{ ...ID_PARAM }] : [],
  body: [],
});

// Node lama yang belum punya konfigurasi tetap terbaca dengan default
export const getEndpointConfig = (data) => {
  const defaults = defaultEndpointConfig(data.kind);
  return {
    auth: data.auth ?? defaults.auth,
    params: Array.isArray(data.params) ? data.params : defaults.params,
    body: Array.isArray(data.body) ? data.body : defaults.body,
  };
};

// Path param berurutan seperti di URL: id selalu segmen pertama
export const pathParamsOf = (params) =>
  params
    .filter((p) => p.in === 'path')
    .sort((a, b) => (a.name === 'id' ? -1 : b.name === 'id' ? 1 : 0));

export const displayPath = (path, params) =>
  `/${path}${pathParamsOf(params).map((p) => `/:${p.name || '?'}`).join('')}`;

// Dua route bentrok kalau method, path, dan jumlah path param sama (Express mencocokkan per posisi)
export const endpointSignature = (kind, path, params) => `${kind} ${path} ${pathParamsOf(params).length}`;

/**
 * Validasi konfigurasi. Hasil:
 *   { params: { [index]: pesan }, body: { [index]: pesan }, general: [pesan], hasErrors }
 */
export function validateEndpointConfig(kind, config) {
  const errors = { params: {}, body: {}, general: [] };

  const seen = new Map();
  config.params.forEach((p, i) => {
    if (!p.name) errors.params[i] = 'Nama wajib diisi';
    else if (!FIELD_NAME_RE.test(p.name)) errors.params[i] = 'Huruf, angka, _; tidak diawali angka';
    else if (seen.has(p.name)) errors.params[i] = `"${p.name}" duplikat`;
    else if (p.name === 'id' && p.in !== 'path') errors.params[i] = '"id" harus path param';
    seen.set(p.name, i);
  });
  if (config.params.length > MAX_PARAMS) errors.general.push(`Maksimal ${MAX_PARAMS} parameter`);
  if (ID_REQUIRED_KINDS.has(kind) && !config.params.some((p) => p.name === 'id' && p.in === 'path')) {
    errors.general.push('Method ini wajib punya path param "id"');
  }

  if (BODY_KINDS.has(kind)) {
    const seenFields = new Set();
    config.body.forEach((f, i) => {
      if (!f.name) errors.body[i] = 'Nama wajib diisi';
      else if (!FIELD_NAME_RE.test(f.name)) errors.body[i] = 'Huruf, angka, _; tidak diawali angka';
      else if (RESERVED_BODY_FIELDS.has(f.name)) errors.body[i] = `"${f.name}" dikelola server`;
      else if (seenFields.has(f.name)) errors.body[i] = `"${f.name}" duplikat`;
      seenFields.add(f.name);
    });
    if (config.body.length > MAX_BODY_FIELDS) errors.general.push(`Maksimal ${MAX_BODY_FIELDS} field body`);
  }

  errors.hasErrors =
    Object.keys(errors.params).length > 0 || Object.keys(errors.body).length > 0 || errors.general.length > 0;
  return errors;
}
