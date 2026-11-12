import DatabaseNode from './DatabaseNode';
import EndpointNode from './EndpointNode';
import ServerNode from './ServerNode';

// Harus di level modul supaya referensinya stabil
// (kalau dibuat di dalam komponen, React Flow memberi warning & me-remount node)
export const nodeTypes = { endpoint: EndpointNode, server: ServerNode, database: DatabaseNode };
