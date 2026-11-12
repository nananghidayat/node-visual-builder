import { useState } from 'react';

/**
 * Draft lokal untuk panel properti: perubahan baru diterapkan saat Simpan.
 * Komponen panel di-mount dengan key={node.id}, jadi draft otomatis reset saat pindah node.
 */
export function useDraft(createInitial, serialize = (v) => v) {
  const [draft, setDraft] = useState(createInitial);
  const isDirty = JSON.stringify(serialize(draft)) !== JSON.stringify(serialize(createInitial()));
  return { draft, setDraft, isDirty, reset: () => setDraft(createInitial()) };
}

/** Kerangka panel: header (badge + judul + tutup), isi scroll, footer (status + Reset/Simpan). */
export default function InspectorShell({ badge, title, accent, onClose, status, isDirty, canSave, onReset, onSave, children }) {
  return (
    <div className="vb-inspector nowheel nodrag nopan" role="dialog" aria-label={`Properti ${title}`}>
      <header className="vb-inspector__header">
        <span className="vb-method" style={{ '--accent': accent }}>{badge}</span>
        <code className="vb-inspector__path" title={title}>{title}</code>
        <button className="vb-icon-btn" onClick={onClose} title="Tutup" aria-label="Tutup panel properti">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </header>

      <div className="vb-inspector__body">{children}</div>

      <footer className="vb-inspector__footer">
        <div className="vb-inspector__status" aria-live="polite">
          {status ?? (isDirty && <span className="vb-dirty">Belum disimpan</span>)}
        </div>
        <button className="vb-btn vb-btn--ghost" onClick={onReset} disabled={!isDirty}>Reset</button>
        <button className="vb-btn vb-btn--primary" onClick={onSave} disabled={!canSave}>Simpan</button>
      </footer>
    </div>
  );
}

/** Field form berlabel dengan hint / error di bawahnya. */
export function Field({ label, hint, error, children, wide = false }) {
  return (
    <label className={`vb-field${wide ? ' vb-field--wide' : ''}`}>
      <span className="vb-field__label">{label}</span>
      {children}
      {error ? <span className="vb-field-error">{error}</span> : hint && <span className="vb-hint">{hint}</span>}
    </label>
  );
}

/** Saklar on/off dengan label + hint. */
export function Toggle({ label, hint, checked, onChange, disabled = false }) {
  return (
    <label className={`vb-toggle${disabled ? ' is-disabled' : ''}`}>
      <input type="checkbox" className="vb-check" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="vb-toggle__text">
        <span>{label}</span>
        {hint && <span className="vb-hint">{hint}</span>}
      </span>
    </label>
  );
}
