import { defaultEndpointConfig, displayPath, endpointSignature, getEndpointConfig } from './endpointConfig';
import { DEFAULT_DATABASE_CONFIG, DEFAULT_SERVER_CONFIG } from './serverConfig';

// Satu sumber kebenaran untuk tipe node: label, warna (node, badge, minimap), ikon & teks sidebar.
// Menambah tipe node baru cukup di file ini.
export const NODE_KINDS = {
  server:   { label: 'Start Server (Express)', color: '#38bdf8', icon: 'fa-rocket',        sidebar: 'Start Server' },
  get:      { label: 'API Endpoint (GET)',     color: '#4ade80', icon: 'fa-network-wired', sidebar: 'API GET Route' },
  post:     { label: 'API Endpoint (POST)',    color: '#facc15', icon: 'fa-file-import',   sidebar: 'API POST Route' },
  put:      { label: 'API Endpoint (PUT)',     color: '#fb923c', icon: 'fa-file-pen',      sidebar: 'API PUT Route' },
  patch:    { label: 'API Endpoint (PATCH)',   color: '#a78bfa', icon: 'fa-pen',           sidebar: 'API PATCH Route' },
  delete:   { label: 'API Endpoint (DELETE)',  color: '#f87171', icon: 'fa-trash',         sidebar: 'API DELETE Route' },
  database: { label: 'Database Connection',    color: '#f472b6', icon: 'fa-database',      sidebar: 'Database Model' },
};

export const FALLBACK_COLOR = '#94a3b8';

export const ENDPOINT_KINDS = {
  get:    { method: 'GET',    defaultPath: 'data' },
  post:   { method: 'POST',   defaultPath: 'data' },
  put:    { method: 'PUT',    defaultPath: 'data' },
  patch:  { method: 'PATCH',  defaultPath: 'data' },
  delete: { method: 'DELETE', defaultPath: 'data' },
};

const ENDPOINT_PATH_RE = /^[a-z][a-z0-9_-]*$/;
const ENDPOINT_PATH_MAX = 50;

export const isEndpointKind = (kind) => Boolean(ENDPOINT_KINDS[kind]);

export const endpointLabel = (kind, path, params = []) => `${ENDPOINT_KINDS[kind].method} ${displayPath(path, params)}`;

// Cari endpoint lain yang route-nya bentrok (method + path + jumlah path param sama)
export function findRouteConflict(kind, path, params, selfId, nodes) {
  const signature = endpointSignature(kind, path, params);
  return nodes.find(
    (n) => n.id !== selfId && n.data?.kind === kind && n.data?.path !== undefined &&
      endpointSignature(kind, n.data.path, getEndpointConfig(n.data).params) === signature
  );
}

export function validateEndpointPath(path, kind, selfId, nodes, params = []) {
  if (!path) return 'Path wajib diisi';
  if (path.length > ENDPOINT_PATH_MAX) return `Maksimal ${ENDPOINT_PATH_MAX} karakter`;
  if (!ENDPOINT_PATH_RE.test(path)) return 'Huruf kecil, angka, - atau _; diawali huruf';
  if (findRouteConflict(kind, path, params, selfId, nodes)) {
    return `${ENDPOINT_KINDS[kind].method} ${displayPath(path, params)} sudah ada`;
  }
  return null;
}

// Path default yang belum dipakai untuk method yang sama: data, data-2, data-3, ...
export function uniqueEndpointPath(kind, nodes) {
  const base = ENDPOINT_KINDS[kind].defaultPath;
  const used = new Set(nodes.filter((n) => n.data?.kind === kind).map((n) => n.data.path));
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

// Tipe node React Flow per kind (lihat nodes/index.js)
const NODE_TYPE_OF_KIND = { server: 'server', database: 'database' };

// Node yang punya panel properti
export const isConfigurableKind = (kind) => isEndpointKind(kind) || Boolean(NODE_TYPE_OF_KIND[kind]);

export function makeNode(id, kind, position, extra = {}) {
  const { path: customPath, ...rest } = extra;
  let data;
  if (isEndpointKind(kind)) {
    const path = customPath ?? ENDPOINT_KINDS[kind].defaultPath;
    const config = defaultEndpointConfig(kind);
    data = { kind, path, ...config, label: endpointLabel(kind, path, config.params) };
  } else if (kind === 'server') {
    data = { kind, label: NODE_KINDS[kind].label, config: structuredClone(DEFAULT_SERVER_CONFIG) };
  } else if (kind === 'database') {
    data = { kind, label: NODE_KINDS[kind].label, config: { ...DEFAULT_DATABASE_CONFIG } };
  } else {
    data = { kind, label: NODE_KINDS[kind].label };
  }
  return {
    id,
    position,
    type: isEndpointKind(kind) ? 'endpoint' : NODE_TYPE_OF_KIND[kind],
    data,
    className: `vb-node vb-node--${kind}`,
    // Warna aksen dipasang sebagai CSS variable, jadi canvas.css tidak perlu daftar warna sendiri
    style: { '--accent': NODE_KINDS[kind].color },
    ...rest,
  };
}

export const initialNodes = [
  makeNode('1', 'server', { x: 100, y: 100 }),
  makeNode('2', 'get', { x: 100, y: 250 }),
];

export const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

let idCounter = 3;
export const getId = () => `${idCounter++}`;
