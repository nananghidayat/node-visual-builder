import { Handle, Position } from '@xyflow/react';
import { NODE_KINDS } from '../constants/nodeKinds';
import { DATABASE_LABEL, getDatabaseConfig } from '../constants/serverConfig';

export default function DatabaseNode({ data }) {
  const { driver, name } = getDatabaseConfig(data);
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div className="vb-node-title">
        <i className={`fa-solid ${NODE_KINDS.database.icon}`}></i>
        <span>Database</span>
      </div>
      <div className="vb-chips">
        {driver === 'none' ? (
          <span className="vb-chip vb-chip--warn" title="Pilih driver di panel properti">Driver belum dipilih</span>
        ) : (
          <>
            <span className="vb-chip">{DATABASE_LABEL[driver]}</span>
            {name && <span className="vb-chip" title="Nama database">{name}</span>}
          </>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
