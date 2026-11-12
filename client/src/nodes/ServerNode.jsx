import { Handle, Position } from '@xyflow/react';
import { NODE_KINDS } from '../constants/nodeKinds';
import { getServerConfig } from '../constants/serverConfig';

export default function ServerNode({ data }) {
  const c = getServerConfig(data);
  return (
    <>
      <div className="vb-node-title">
        <i className={`fa-solid ${NODE_KINDS.server.icon}`}></i>
        <span>Start Server (Express)</span>
      </div>
      <div className="vb-chips">
        <span className="vb-chip" title="Port">:{c.port}</span>
        {c.apiPrefix !== '/' && <span className="vb-chip" title="Prefix API">{c.apiPrefix}</span>}
        <span className="vb-chip" title="Module system">{c.moduleSystem === 'esm' ? 'ESM' : 'CJS'}</span>
        <span className="vb-chip" title="Versi Node.js">Node {c.nodeVersion}</span>
      </div>
      {/* Server adalah titik awal: hanya koneksi keluar */}
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
