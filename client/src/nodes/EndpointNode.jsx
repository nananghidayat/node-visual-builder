import { useEffect, useRef, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { ENDPOINT_KINDS, endpointLabel, validateEndpointPath } from '../constants/nodeKinds';
import { AUTH_OPTIONS, BODY_KINDS, getEndpointConfig, pathParamsOf } from '../constants/endpointConfig';
import { useTakeSnapshot } from '../context/HistoryContext';

export default function EndpointNode({ id, data }) {
  const { updateNodeData, getNodes } = useReactFlow();
  const takeSnapshot = useTakeSnapshot();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.path);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const config = getEndpointConfig(data);
  const pathSuffix = pathParamsOf(config.params).map((p) => `/:${p.name}`).join('');
  const queryCount = config.params.filter((p) => p.in === 'query').length;
  const auth = AUTH_OPTIONS.find((o) => o.value === config.auth);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = (e) => {
    e?.stopPropagation();
    setDraft(data.path);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const commit = () => {
    const next = draft.trim().toLowerCase().replace(/^\/+/, '');
    const err = validateEndpointPath(next, data.kind, id, getNodes(), config.params);
    if (err) {
      setError(err);
      return false;
    }
    if (next !== data.path) {
      takeSnapshot(); // supaya edit path bisa di-undo
      updateNodeData(id, { path: next, label: endpointLabel(data.kind, next, config.params) });
    }
    cancel();
    return true;
  };

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div className="vb-endpoint-row">
        <span className="vb-method">{ENDPOINT_KINDS[data.kind].method}</span>
        {editing ? (
          <input
            ref={inputRef}
            className={`vb-path-input nodrag nopan${error ? ' has-error' : ''}`}
            value={draft}
            maxLength={50}
            spellCheck={false}
            aria-label="Path endpoint"
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              e.stopPropagation(); // jangan sampai Backspace/Delete menghapus node
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
            onBlur={() => {
              if (!commit()) cancel(); // blur dengan input invalid = batal, kembali ke path lama
            }}
          />
        ) : (
          <>
            <span className="vb-path" onDoubleClick={startEdit} title="Double-click untuk ubah path">
              /{data.path}
              {pathSuffix && <span className="vb-path__params">{pathSuffix}</span>}
            </span>
            <button className="vb-edit nodrag" onClick={startEdit} title="Ubah path">
              <i className="fa-solid fa-pen"></i>
            </button>
          </>
        )}
      </div>
      {error && <div className="vb-error">{error}</div>}

      {/* Ringkasan konfigurasi; detail diatur di panel properti saat node dipilih */}
      {(config.auth !== 'none' || queryCount > 0 || (BODY_KINDS.has(data.kind) && config.body.length > 0)) && (
        <div className="vb-chips">
          {config.auth !== 'none' && (
            <span className="vb-chip" title={`Auth: ${auth.label}`}>
              <i className={`fa-solid ${auth.icon}`}></i> {auth.label}
            </span>
          )}
          {queryCount > 0 && (
            <span className="vb-chip" title={`${queryCount} query param`}>?{queryCount} query</span>
          )}
          {BODY_KINDS.has(data.kind) && config.body.length > 0 && (
            <span className="vb-chip" title={`${config.body.length} field body`}>{'{ }'} {config.body.length} field</span>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
