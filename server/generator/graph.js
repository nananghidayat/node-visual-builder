// Analisis graf: node → daftar resource & endpoint yang sudah tervalidasi
import { METHOD_ORDER, toPascal } from './syntax.js';

const METHOD_OF_KIND = { get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE' };
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const ID_REQUIRED_METHODS = new Set(['PUT', 'PATCH', 'DELETE']);

const ENDPOINT_PATH_RE = /^[a-z][a-z0-9_-]*$/;
const FIELD_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
const AUTH_TYPES = ['none', 'apiKey', 'jwt'];
const PARAM_TYPES = ['string', 'number', 'boolean', 'id'];
const BODY_TYPES = ['string', 'number', 'boolean', 'object', 'array'];
const RESERVED_BODY_FIELDS = new Set(['id', '_id']);
const MAX_PARAMS = 10;
const MAX_BODY_FIELDS = 30;

const ID_PARAM = { name: 'id', in: 'path', type: 'id', required: true };

const inferKind = (label = '') => {
  if (/start server/i.test(label)) return 'server';
  if (/database/i.test(label)) return 'database';
  if (/DELETE/.test(label)) return 'delete';
  if (/PATCH/.test(label)) return 'patch';
  if (/PUT/.test(label)) return 'put';
  if (/POST/.test(label)) return 'post';
  if (/api/i.test(label)) return 'get';
  return null;
};

// Fallback untuk payload lama yang belum punya data.path
const resourceFromLabel = (label = '') => {
  const match = /\/api\/([A-Za-z0-9_-]+)/.exec(label);
  let r = (match ? match[1] : 'items').toLowerCase();
  if (!/^[a-z]/.test(r)) r = `r-${r}`;
  return r;
};

/**
 * Validasi konfigurasi satu endpoint. Mengembalikan { config } atau { error }.
 * Aturan harus sama dengan validasi di frontend (constants/endpointConfig.js).
 */
function normalizeEndpoint(data, method) {
  // Node lama tanpa konfigurasi: perilaku lama (PUT/PATCH/DELETE pakai /:id, body bebas)
  const rawParams = Array.isArray(data.params) ? data.params : ID_REQUIRED_METHODS.has(method) ? [ID_PARAM] : [];
  const rawBody = Array.isArray(data.body) ? data.body : [];
  const auth = data.auth ?? 'none';

  if (!AUTH_TYPES.includes(auth)) return { error: `auth "${auth}" tidak dikenal` };
  if (rawParams.length > MAX_PARAMS) return { error: `maksimal ${MAX_PARAMS} parameter` };
  if (rawBody.length > MAX_BODY_FIELDS) return { error: `maksimal ${MAX_BODY_FIELDS} field body` };

  const seen = new Set();
  const pathParams = [];
  const queryParams = [];
  for (const p of rawParams) {
    const name = String(p?.name ?? '');
    if (!FIELD_NAME_RE.test(name)) return { error: `nama parameter "${name}" tidak valid` };
    if (seen.has(name)) return { error: `parameter "${name}" duplikat` };
    seen.add(name);
    const location = p.in === 'query' ? 'query' : 'path';
    // "id" selalu path param bertipe id (tipe mengikuti database)
    if (name === 'id') {
      if (location !== 'path') return { error: 'parameter "id" harus berupa path param' };
      pathParams.push({ name, type: 'id' });
      continue;
    }
    const type = PARAM_TYPES.includes(p.type) && p.type !== 'id' ? p.type : null;
    if (!type) return { error: `tipe parameter "${name}" tidak valid` };
    if (location === 'path') pathParams.push({ name, type });
    else queryParams.push({ name, type, required: Boolean(p.required) });
  }

  if (ID_REQUIRED_METHODS.has(method) && !pathParams.some((p) => p.name === 'id')) {
    return { error: `${method} wajib punya path param "id"` };
  }
  // id selalu segmen pertama supaya URL konsisten: /users/:id/:other
  pathParams.sort((a, b) => (a.name === 'id' ? -1 : b.name === 'id' ? 1 : 0));

  let body = null;
  if (BODY_METHODS.has(method)) {
    const fields = [];
    const seenFields = new Set();
    for (const f of rawBody) {
      const name = String(f?.name ?? '');
      if (!FIELD_NAME_RE.test(name)) return { error: `nama field body "${name}" tidak valid` };
      if (RESERVED_BODY_FIELDS.has(name)) return { error: `field body "${name}" dicadangkan` };
      if (seenFields.has(name)) return { error: `field body "${name}" duplikat` };
      if (!BODY_TYPES.includes(f.type)) return { error: `tipe field body "${name}" tidak valid` };
      seenFields.add(name);
      fields.push({ name, type: f.type, required: method !== 'PATCH' && Boolean(f.required) });
    }
    body = { fields: fields.length ? fields : null, partial: method === 'PATCH' };
  }

  return { config: { auth, pathParams, queryParams, body } };
}

function handlerName(method, pathParams) {
  const hasId = pathParams.some((p) => p.name === 'id');
  const verb = { GET: hasId ? 'get' : 'list', POST: 'create', PUT: 'replace', PATCH: 'update', DELETE: 'remove' }[method];
  return pathParams.length ? `${verb}By${pathParams.map((p) => toPascal(p.name)).join('And')}` : verb;
}

export function analyzeGraph(nodes = [], edges = [], settings) {
  const warnings = [];
  const byId = new Map();
  for (const n of nodes) {
    const kind = n?.data?.kind ?? inferKind(n?.data?.label);
    if (kind) byId.set(n.id, { ...n, kind });
  }

  const neighbors = new Map();
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    if (!neighbors.has(e.source)) neighbors.set(e.source, new Set());
    if (!neighbors.has(e.target)) neighbors.set(e.target, new Set());
    neighbors.get(e.source).add(e.target);
    neighbors.get(e.target).add(e.source);
  }
  const isLinkedTo = (id, kind) => [...(neighbors.get(id) ?? [])].some((nid) => byId.get(nid)?.kind === kind);

  const all = [...byId.values()];
  const servers = all.filter((n) => n.kind === 'server');
  const databases = all.filter((n) => n.kind === 'database');
  if (servers.length === 0) warnings.push('Tidak ada node "Start Server". Server tetap digenerate dengan konfigurasi default.');
  if (servers.length > 1) warnings.push(`Ada ${servers.length} node "Start Server"; hanya satu server yang digenerate.`);
  if (databases.length > 0 && settings.database === 'none') {
    warnings.push('Ada node Database di kanvas, tapi driver database "none". Endpoint terkait memakai data contoh in-memory.');
  }

  // resource -> { endpoints: [], usesDb, linked: Set<boolean> }
  const resources = new Map();
  const signatures = new Set();

  for (const n of all.filter((x) => METHOD_OF_KIND[x.kind])) {
    const method = METHOD_OF_KIND[n.kind];
    const data = n.data ?? {};

    let resource;
    if (data.path !== undefined) {
      resource = String(data.path).trim().toLowerCase();
      if (!ENDPOINT_PATH_RE.test(resource) || resource.length > 50) {
        warnings.push(`Path endpoint ${method} "${data.path}" tidak valid; node dilewati.`);
        continue;
      }
    } else {
      resource = resourceFromLabel(data.label);
    }

    const { config, error } = normalizeEndpoint(data, method);
    if (error) {
      warnings.push(`Endpoint ${method} /${resource}: ${error}; node dilewati.`);
      continue;
    }

    // Dua route bentrok kalau method, resource, dan jumlah path param sama (Express mencocokkan posisi)
    const routePath = config.pathParams.length ? `/${config.pathParams.map((p) => `:${p.name}`).join('/')}` : '/';
    const signature = `${method} ${resource} ${config.pathParams.length}`;
    if (signatures.has(signature)) {
      warnings.push(`Endpoint ${method} /${resource}${routePath === '/' ? '' : routePath} bentrok dengan endpoint lain; hanya satu yang digenerate.`);
      continue;
    }
    signatures.add(signature);

    const entry = resources.get(resource) ?? { endpoints: [], usesDb: false, linked: new Set() };
    const linked = isLinkedTo(n.id, 'database');
    entry.linked.add(linked);
    if (linked && settings.database !== 'none') entry.usesDb = true;

    entry.endpoints.push({
      method,
      resource,
      routePath,
      handler: handlerName(method, config.pathParams),
      ...config,
    });

    if (servers.length > 0 && !isLinkedTo(n.id, 'server')) {
      warnings.push(`Endpoint ${method} /${resource} belum terhubung ke node Start Server (tetap di-mount).`);
    }
    resources.set(resource, entry);
  }

  for (const [resource, entry] of resources) {
    entry.endpoints.sort(
      (a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method) || a.pathParams.length - b.pathParams.length
    );
    if (entry.usesDb && entry.linked.has(false)) {
      warnings.push(`Sebagian endpoint /${resource} tidak terhubung ke Database; semua endpoint /${resource} tetap memakai database supaya datanya konsisten.`);
    }
    delete entry.linked;
  }

  if (settings.database !== 'none' && ![...resources.values()].some((r) => r.usesDb)) {
    warnings.push('Database dikonfigurasi, tapi belum ada endpoint yang terhubung ke node Database. Koneksi tetap dibuat saat start.');
  }

  const authTypes = new Set([...resources.values()].flatMap((r) => r.endpoints.map((e) => e.auth)));
  return {
    resources,
    warnings,
    auth: { apiKey: authTypes.has('apiKey'), jwt: authTypes.has('jwt') },
  };
}
