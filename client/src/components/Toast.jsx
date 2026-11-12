export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div
      role="alert"
      style={{ position: 'fixed', top: '64px', right: '20px', zIndex: 3000, width: '340px', maxWidth: 'calc(100vw - 40px)', display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '14px 16px', background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', borderLeft: '4px solid #ef4444', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}
    >
      <i className="fa-solid fa-circle-exclamation" style={{ color: '#ef4444', marginTop: '2px' }}></i>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{toast.title}</div>
        <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5, wordBreak: 'break-word' }}>{toast.message}</div>
      </div>
      <button onClick={onClose} title="Tutup" aria-label="Tutup notifikasi" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: 0 }}>
        <i className="fa-solid fa-xmark"></i>
      </button>
    </div>
  );
}
