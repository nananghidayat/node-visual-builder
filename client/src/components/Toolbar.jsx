import { MOD_KEY } from '../utils/helpers';
import { panelToggleStyle, toolButtonStyle } from './buttons';

const Divider = () => <div style={{ width: '1px', height: '18px', background: '#334155', margin: '0 4px' }} />;

/**
 * Grid 3 kolom: [toggle sidebar] [tools, selalu di tengah] [toggle preview]
 * Wrapper harus punya TEPAT tiga anak langsung.
 */
export default function Toolbar({ sidebar, preview, tool, onToolChange, history, selectedCount, onDeleteSelected }) {
  const hasSelection = selectedCount > 0;

  return (
    <div style={{ padding: '6px 20px', background: '#0f172a', borderBottom: '1px solid #334155', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', minHeight: '40px', userSelect: 'none' }}>
      {/* Kolom 1: toggle sidebar */}
      <div style={{ justifySelf: 'start' }}>
        <button onClick={sidebar.toggle} style={panelToggleStyle(sidebar.visible)} title={sidebar.visible ? 'Ciutkan sidebar' : 'Perluas sidebar'} aria-label="Toggle sidebar">
          <i className={`fa-solid ${sidebar.visible ? 'fa-indent' : 'fa-outdent'}`}></i>
        </button>
      </div>

      {/* Kolom 2: tools */}
      <div role="toolbar" aria-label="Tools kanvas" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button onClick={() => onToolChange('select')} aria-pressed={tool === 'select'} style={toolButtonStyle(false, tool === 'select' ? 'active' : 'default')} title="Select: blok area untuk memilih (V)" aria-label="Mode select">
          <i className="fa-solid fa-arrow-pointer"></i>
        </button>
        <button onClick={() => onToolChange('pan')} aria-pressed={tool === 'pan'} style={toolButtonStyle(false, tool === 'pan' ? 'active' : 'default')} title="Pan: geser kanvas (H) · Shift+drag untuk blok" aria-label="Mode pan">
          <i className="fa-solid fa-hand"></i>
        </button>

        <Divider />

        <button onClick={history.undo} disabled={!history.canUndo} style={toolButtonStyle(!history.canUndo)} title={`Undo (${MOD_KEY}+Z)`} aria-label="Undo">
          <i className="fa-solid fa-rotate-left"></i>
        </button>
        <button onClick={history.redo} disabled={!history.canRedo} style={toolButtonStyle(!history.canRedo)} title={`Redo (${MOD_KEY}+Shift+Z)`} aria-label="Redo">
          <i className="fa-solid fa-rotate-right"></i>
        </button>

        <Divider />

        {/* Badge absolute supaya grup tools tetap persis di tengah */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={onDeleteSelected}
            disabled={!hasSelection}
            style={toolButtonStyle(!hasSelection, 'danger')}
            title={hasSelection ? `Hapus ${selectedCount} terpilih (Delete)` : 'Hapus terpilih'}
            aria-label={hasSelection ? `Hapus ${selectedCount} terpilih` : 'Hapus terpilih'}
          >
            <i className="fa-solid fa-trash-can"></i>
          </button>
          {selectedCount > 1 && (
            <span style={{ position: 'absolute', top: '-6px', right: '-6px', minWidth: '16px', height: '16px', padding: '0 4px', boxSizing: 'border-box', borderRadius: '8px', background: '#f8fafc', color: '#0f172a', fontSize: '10px', fontWeight: 700, lineHeight: '16px', textAlign: 'center', pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>
              {selectedCount}
            </span>
          )}
        </div>
      </div>

      {/* Kolom 3: toggle preview */}
      <div style={{ justifySelf: 'end' }}>
        <button onClick={preview.toggle} style={panelToggleStyle(preview.visible)} title={preview.visible ? 'Hide Preview' : 'Show Preview'} aria-label="Toggle preview">
          <i className={`fa-solid ${preview.visible ? 'fa-code-compare' : 'fa-code'}`}></i>
        </button>
      </div>
    </div>
  );
}
