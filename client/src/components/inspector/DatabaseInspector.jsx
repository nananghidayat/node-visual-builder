import { DATABASE_OPTIONS, defaultDatabaseName, getDatabaseConfig, validateDatabaseConfig } from '../../constants/serverConfig';
import InspectorShell, { Field, useDraft } from './InspectorShell';

export default function DatabaseInspector({ node, linkedEndpoints, projectName, onSave, onClose }) {
  const { draft, setDraft, isDirty, reset } = useDraft(() => getDatabaseConfig(node.data));
  const current = DATABASE_OPTIONS.find((o) => o.value === draft.driver);
  const errors = validateDatabaseConfig(draft);
  const hasErrors = Object.keys(errors).length > 0;
  const fallbackName = defaultDatabaseName(projectName);

  return (
    <InspectorShell
      badge="DB"
      title={current.label}
      accent={node.style?.['--accent']}
      onClose={onClose}
      isDirty={isDirty}
      status={hasErrors ? <span className="vb-field-error">Perbaiki nama database</span> : undefined}
      canSave={isDirty && !hasErrors}
      onReset={reset}
      onSave={() => isDirty && !hasErrors && onSave(node.id, { ...draft, name: draft.name.trim() })}
    >
      <section className="vb-section">
        <h4 className="vb-section__title">Driver</h4>
        <div className="vb-radio-list" role="radiogroup" aria-label="Driver database">
          {DATABASE_OPTIONS.map((o) => (
            <label key={o.value} className={`vb-radio${draft.driver === o.value ? ' is-active' : ''}`}>
              <input
                type="radio"
                name={`db-driver-${node.id}`}
                value={o.value}
                checked={draft.driver === o.value}
                onChange={() => setDraft((d) => ({ ...d, driver: o.value }))}
              />
              <span className="vb-toggle__text">
                <span>{o.label}</span>
                <span className="vb-hint">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="vb-section">
        <h4 className="vb-section__title">Koneksi</h4>
        <Field
          label="Nama database"
          error={errors.name}
          hint={draft.name ? 'Dipakai di DATABASE_URL, DB_NAME, dan perintah CREATE DATABASE' : `Kosong = pakai nama proyek: ${fallbackName || '—'}`}
        >
          <input
            className={`vb-input${errors.name ? ' has-error' : ''}`}
            value={draft.name}
            placeholder={fallbackName}
            maxLength={63}
            spellCheck={false}
            disabled={draft.driver === 'none'}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value.trim() }))}
          />
        </Field>
      </section>

      <section className="vb-section">
        <h4 className="vb-section__title">Endpoint terhubung</h4>
        {linkedEndpoints.length === 0 ? (
          <p className="vb-empty">Belum ada. Tarik koneksi dari node method ke node ini.</p>
        ) : (
          <ul className="vb-linked-list">
            {linkedEndpoints.map((n) => (
              <li key={n.id} style={{ '--accent': n.style?.['--accent'] }}>
                <code>{n.data.label}</code>
              </li>
            ))}
          </ul>
        )}
        {draft.driver === 'none' && linkedEndpoints.length > 0 && (
          <p className="vb-field-error">Pilih driver; tanpa driver, endpoint di atas memakai data contoh in-memory.</p>
        )}
        <p className="vb-hint">Connection string diisi di .env sebagai DATABASE_URL setelah proyek digenerate.</p>
      </section>
    </InspectorShell>
  );
}
