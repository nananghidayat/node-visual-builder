import InspectorShell from './InspectorShell';
import { useState } from 'react';
import { ENDPOINT_KINDS, findRouteConflict } from '../../constants/nodeKinds';
import {
  AUTH_OPTIONS,
  BODY_KINDS,
  BODY_TYPES,
  ID_PARAM,
  ID_REQUIRED_KINDS,
  MAX_BODY_FIELDS,
  MAX_PARAMS,
  PARAM_TYPES,
  displayPath,
  getEndpointConfig,
  validateEndpointConfig,
} from '../../constants/endpointConfig';

// _key hanya untuk key React selama mengedit; dibuang saat disimpan
let keySeq = 0;
const withKeys = (rows) => rows.map((row) => ({ ...row, _key: `k${keySeq++}` }));
const stripKeys = (rows) => rows.map(({ _key, ...row }) => row);

const toDraft = (data) => {
  const config = getEndpointConfig(data);
  return { auth: config.auth, params: withKeys(config.params), body: withKeys(config.body) };
};
const toConfig = (draft) => ({ auth: draft.auth, params: stripKeys(draft.params), body: stripKeys(draft.body) });

/**
 * Panel properti endpoint. Perubahan disimpan sebagai draft dulu;
 * "Simpan" menerapkannya sekaligus (satu langkah undo).
 * Di-mount dengan key={node.id} supaya draft reset saat pindah node.
 */
export default function EndpointInspector({ node, nodes, onSave, onClose }) {
  const { kind, path } = node.data;
  const method = ENDPOINT_KINDS[kind].method;
  const hasBody = BODY_KINDS.has(kind);
  const idLocked = ID_REQUIRED_KINDS.has(kind);
  const isPatch = kind === 'patch';

  const [draft, setDraft] = useState(() => toDraft(node.data));
  const config = toConfig(draft);
  const errors = validateEndpointConfig(kind, config);
  const conflict = errors.hasErrors ? null : findRouteConflict(kind, path, config.params, node.id, nodes);
  const isDirty = JSON.stringify(config) !== JSON.stringify(getEndpointConfig(node.data));
  const canSave = isDirty && !errors.hasErrors && !conflict;

  // ---- mutasi draft ----
  const setAuth = (auth) => setDraft((d) => ({ ...d, auth }));

  const addParam = () =>
    setDraft((d) => ({ ...d, params: [...d.params, ...withKeys([{ name: '', in: 'query', type: 'string', required: false }])] }));

  const updateParam = (key, patch) =>
    setDraft((d) => ({
      ...d,
      params: d.params.map((p) => {
        if (p._key !== key) return p;
        const next = { ...p, ...patch };
        // "id" selalu path param bertipe id; keluar dari "id" kembali ke string
        if (next.name === 'id') return { ...next, ...ID_PARAM, _key: p._key };
        if (p.name === 'id' && next.name !== 'id') next.type = 'string';
        if (next.in === 'path') next.required = true;
        return next;
      }),
    }));

  const removeParam = (key) => setDraft((d) => ({ ...d, params: d.params.filter((p) => p._key !== key) }));

  const addField = () =>
    setDraft((d) => ({ ...d, body: [...d.body, ...withKeys([{ name: '', type: 'string', required: !isPatch }])] }));
  const updateField = (key, patch) =>
    setDraft((d) => ({ ...d, body: d.body.map((f) => (f._key === key ? { ...f, ...patch } : f)) }));
  const removeField = (key) => setDraft((d) => ({ ...d, body: d.body.filter((f) => f._key !== key) }));

  const reset = () => setDraft(toDraft(node.data));
  const save = () => canSave && onSave(node.id, config);

  return (
    <InspectorShell
      badge={method}
      title={displayPath(path, config.params)}
      accent={node.style?.['--accent']}
      onClose={onClose}
      status={
        errors.general[0] ? (
          <span className="vb-field-error">{errors.general[0]}</span>
        ) : conflict ? (
          <span className="vb-field-error">Bentrok dengan {conflict.data.label}</span>
        ) : undefined
      }
      isDirty={isDirty}
      canSave={canSave}
      onReset={reset}
      onSave={save}
    >
      {/* ---------- Auth ---------- */}
      <section className="vb-section">
        <h4 className="vb-section__title">Autentikasi</h4>
        <div className="vb-segmented" role="radiogroup" aria-label="Autentikasi">
          {AUTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="radio"
              aria-checked={draft.auth === opt.value}
              className={`vb-segmented__item${draft.auth === opt.value ? ' is-active' : ''}`}
              onClick={() => setAuth(opt.value)}
            >
              <i className={`fa-solid ${opt.icon}`}></i> {opt.label}
            </button>
          ))}
        </div>
        <p className="vb-hint">
          {draft.auth === 'apiKey' && 'Header x-api-key wajib cocok dengan API_KEY di .env.'}
          {draft.auth === 'jwt' && 'Header Authorization: Bearer <token>, diverifikasi dengan JWT_SECRET.'}
          {draft.auth === 'none' && 'Bisa diakses tanpa kredensial.'}
        </p>
      </section>

      {/* ---------- Parameter ---------- */}
      <section className="vb-section">
        <div className="vb-section__head">
          <h4 className="vb-section__title">Parameter</h4>
          <button className="vb-link-btn" onClick={addParam} disabled={draft.params.length >= MAX_PARAMS}>
            <i className="fa-solid fa-plus"></i> Tambah
          </button>
        </div>

        {draft.params.length === 0 ? (
          <p className="vb-empty">Belum ada parameter.</p>
        ) : (
          <div className="vb-table">
            <div className="vb-table__row vb-table__row--head vb-table__row--param">
              <span>Nama</span><span>Lokasi</span><span>Tipe</span><span title="Wajib">Wajib</span><span />
            </div>
            {draft.params.map((p, i) => {
              const isId = p.name === 'id' && p.in === 'path';
              return (
                <div key={p._key}>
                  <div className="vb-table__row vb-table__row--param">
                    <input
                      className={`vb-input${errors.params[i] ? ' has-error' : ''}`}
                      value={p.name}
                      placeholder="nama"
                      maxLength={40}
                      spellCheck={false}
                      disabled={isId && idLocked}
                      onChange={(e) => updateParam(p._key, { name: e.target.value.trim() })}
                      aria-label="Nama parameter"
                    />
                    <select className="vb-input" value={p.in} disabled={isId} onChange={(e) => updateParam(p._key, { in: e.target.value })} aria-label="Lokasi parameter">
                      <option value="path">path</option>
                      <option value="query">query</option>
                    </select>
                    {isId ? (
                      <span className="vb-input vb-input--static" title="Tipe ID mengikuti database (angka atau ObjectId)">ID</span>
                    ) : (
                      <select className="vb-input" value={p.type} onChange={(e) => updateParam(p._key, { type: e.target.value })} aria-label="Tipe parameter">
                        {PARAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    )}
                    <input
                      type="checkbox"
                      className="vb-check"
                      checked={p.in === 'path' || p.required}
                      disabled={p.in === 'path'}
                      title={p.in === 'path' ? 'Path param selalu wajib' : 'Wajib diisi'}
                      onChange={(e) => updateParam(p._key, { required: e.target.checked })}
                      aria-label="Wajib"
                    />
                    <button
                      className="vb-icon-btn"
                      onClick={() => removeParam(p._key)}
                      disabled={isId && idLocked}
                      title={isId && idLocked ? `${method} wajib punya id` : 'Hapus parameter'}
                      aria-label="Hapus parameter"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                  {errors.params[i] && <div className="vb-field-error">{errors.params[i]}</div>}
                </div>
              );
            })}
          </div>
        )}
        <p className="vb-hint">
          Path param jadi segmen URL (<code>/:nama</code>). Selain <code>id</code>, parameter dipakai sebagai filter data.
        </p>
      </section>

      {/* ---------- Body ---------- */}
      {hasBody && (
        <section className="vb-section">
          <div className="vb-section__head">
            <h4 className="vb-section__title">Body</h4>
            <button className="vb-link-btn" onClick={addField} disabled={draft.body.length >= MAX_BODY_FIELDS}>
              <i className="fa-solid fa-plus"></i> Field
            </button>
          </div>

          {draft.body.length === 0 ? (
            <p className="vb-empty">Body bebas: objek JSON apa pun diterima (tidak boleh kosong).</p>
          ) : (
            <div className="vb-table">
              <div className={`vb-table__row vb-table__row--head vb-table__row--body${isPatch ? ' is-patch' : ''}`}>
                <span>Field</span><span>Tipe</span>{!isPatch && <span>Wajib</span>}<span />
              </div>
              {draft.body.map((f, i) => (
                <div key={f._key}>
                  <div className={`vb-table__row vb-table__row--body${isPatch ? ' is-patch' : ''}`}>
                    <input
                      className={`vb-input${errors.body[i] ? ' has-error' : ''}`}
                      value={f.name}
                      placeholder="nama"
                      maxLength={40}
                      spellCheck={false}
                      onChange={(e) => updateField(f._key, { name: e.target.value.trim() })}
                      aria-label="Nama field"
                    />
                    <select className="vb-input" value={f.type} onChange={(e) => updateField(f._key, { type: e.target.value })} aria-label="Tipe field">
                      {BODY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {!isPatch && (
                      <input type="checkbox" className="vb-check" checked={f.required} onChange={(e) => updateField(f._key, { required: e.target.checked })} aria-label="Wajib" />
                    )}
                    <button className="vb-icon-btn" onClick={() => removeField(f._key)} title="Hapus field" aria-label="Hapus field">
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                  {errors.body[i] && <div className="vb-field-error">{errors.body[i]}</div>}
                </div>
              ))}
            </div>
          )}
          <p className="vb-hint">
            {isPatch
              ? 'PATCH: semua field opsional, minimal satu dikirim.'
              : 'Hanya field yang didaftarkan yang disimpan; field lain dibuang.'}
          </p>
        </section>
      )}
    </InspectorShell>
  );
}

