// Menu klik kanan untuk node/koneksi. Posisi fixed = koordinat kursor langsung.
export default function ContextMenu({ menu, onDelete }) {
  if (!menu) return null;
  return (
    <div
      role="menu"
      style={{ position: 'fixed', top: menu.top, left: menu.left, background: '#1e293b', color: '#fff', padding: '8px 12px', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid #334155', zIndex: 1000, cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
      onClick={() => onDelete(menu.id, menu.type)}
    >
      <i className="fa-solid fa-trash-can" style={{ color: '#ef4444' }}></i> Hapus {menu.type === 'node' ? 'Node Ini' : 'Koneksi Ini'}
    </div>
  );
}
