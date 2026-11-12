import {
  LICENSE_OPTIONS,
  MIDDLEWARE_OPTIONS,
  MODULE_OPTIONS,
  NODE_VERSION_OPTIONS,
  RESERVED_PORTS,
  TOOLING_OPTIONS,
  getServerConfig,
  validateServerConfig,
} from '../../constants/serverConfig';
import InspectorShell, { Field, Toggle, useDraft } from './InspectorShell';

export default function ServerInspector({ node, onSave, onClose }) {
  const { draft, setDraft, isDirty, reset } = useDraft(() => getServerConfig(node.data));
  const errors = validateServerConfig(draft);
  const hasErrors = Object.keys(errors).length > 0;

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));
  const setGroup = (group, key) => (value) => setDraft((d) => ({ ...d, [group]: { ...d[group], [key]: value } }));

  const save = () => {
    if (!isDirty || hasErrors) return;
    onSave(node.id, { ...draft, port: Number(draft.port), bodyLimit: String(draft.bodyLimit).toLowerCase() });
  };

  const reservedPort = RESERVED_PORTS[Number(draft.port)];

  return (
    <InspectorShell
      badge="SERVER"
      title={`Express · :${draft.port}${draft.apiPrefix === '/' ? '' : draft.apiPrefix}`}
      accent={node.style?.['--accent']}
      onClose={onClose}
      status={hasErrors ? <span className="vb-field-error">Perbaiki isian yang ditandai</span> : undefined}
      isDirty={isDirty}
      canSave={isDirty && !hasErrors}
      onReset={reset}
      onSave={save}
    >
      <section className="vb-section">
        <h4 className="vb-section__title">Jaringan</h4>
        <div className="vb-form-grid">
          <Field
            label="Port"
            error={errors.port}
            hint={reservedPort ? `⚠ Bentrok dengan ${reservedPort} kalau dijalankan bersamaan` : 'Default PORT di .env'}
          >
            <input className={`vb-input${errors.port ? ' has-error' : ''}`} type="number" min="1" max="65535" value={draft.port} onChange={set('port')} />
          </Field>
          <Field label="Prefix API" error={errors.apiPrefix} hint="Semua route di bawah prefix ini">
            <input className={`vb-input${errors.apiPrefix ? ' has-error' : ''}`} value={draft.apiPrefix} onChange={set('apiPrefix')} spellCheck={false} />
          </Field>
          <Field label="Batas ukuran body" error={errors.bodyLimit} hint="express.json limit">
            <input className={`vb-input${errors.bodyLimit ? ' has-error' : ''}`} value={draft.bodyLimit} onChange={set('bodyLimit')} spellCheck={false} />
          </Field>
          <Field label="CORS origin" error={errors.corsOrigin} hint={draft.middleware.cors ? '"*" atau URL dipisah koma' : 'CORS nonaktif'}>
            <input
              className={`vb-input${errors.corsOrigin ? ' has-error' : ''}`}
              value={draft.corsOrigin}
              onChange={set('corsOrigin')}
              disabled={!draft.middleware.cors}
              spellCheck={false}
              placeholder="*"
            />
          </Field>
        </div>
        {draft.middleware.cors && draft.corsOrigin === '*' && (
          <p className="vb-hint">Origin "*" mengizinkan semua situs; batasi ke domain frontend sebelum production.</p>
        )}
      </section>

      <section className="vb-section">
        <h4 className="vb-section__title">Runtime</h4>
        <div className="vb-form-grid">
          <Field label="Module system">
            <select className="vb-input" value={draft.moduleSystem} onChange={set('moduleSystem')}>
              {MODULE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Versi Node.js" hint="engines & Dockerfile">
            <select className="vb-input" value={draft.nodeVersion} onChange={set('nodeVersion')}>
              {NODE_VERSION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section className="vb-section">
        <h4 className="vb-section__title">Middleware</h4>
        <div className="vb-toggle-list">
          {MIDDLEWARE_OPTIONS.map((o) => (
            <Toggle key={o.key} label={o.label} hint={o.hint} checked={draft.middleware[o.key]} onChange={setGroup('middleware', o.key)} />
          ))}
        </div>
      </section>

      <section className="vb-section">
        <h4 className="vb-section__title">package.json</h4>
        <div className="vb-form-grid">
          <Field label="Versi" error={errors.version}>
            <input className={`vb-input${errors.version ? ' has-error' : ''}`} value={draft.version} onChange={set('version')} spellCheck={false} />
          </Field>
          <Field label="Lisensi">
            <select className="vb-input" value={draft.license} onChange={set('license')}>
              {LICENSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Author" wide>
            <input className="vb-input" value={draft.author} onChange={set('author')} placeholder="Nama <email>" maxLength={120} />
          </Field>
          <Field label="Deskripsi" wide>
            <input className="vb-input" value={draft.description} onChange={set('description')} maxLength={200} />
          </Field>
        </div>
      </section>

      <section className="vb-section">
        <h4 className="vb-section__title">File tambahan</h4>
        <div className="vb-toggle-list">
          {TOOLING_OPTIONS.map((o) => {
            const forcedByCompose = o.key === 'dockerfile' && draft.tooling.compose;
            return (
              <Toggle
                key={o.key}
                label={o.label}
                hint={forcedByCompose ? 'Wajib untuk docker-compose.yml' : o.hint}
                checked={forcedByCompose || draft.tooling[o.key]}
                disabled={forcedByCompose}
                onChange={setGroup('tooling', o.key)}
              />
            );
          })}
        </div>
      </section>
    </InspectorShell>
  );
}
