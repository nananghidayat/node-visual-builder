// Gaya tombol ikon 28×28 yang dipakai di toolbar

export const toolButtonStyle = (disabled, variant = 'default') => {
  const danger = variant === 'danger' && !disabled;
  return {
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: danger ? 'none' : '1px solid #475569',
    background: danger ? '#ef4444' : '#1e293b',
    color: danger ? '#fff' : '#94a3b8',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'background 0.2s, opacity 0.2s',
    ...(variant === 'active' && { background: '#4f46e5', color: '#fff', border: '1px solid #6366f1' }),
  };
};

// Tombol toggle panel (sidebar/preview): sedikit lebih terang saat panel terbuka
export const panelToggleStyle = (open) => ({
  ...toolButtonStyle(false),
  background: open ? '#334155' : '#1e293b',
});
