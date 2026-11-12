import { useState } from 'react';
import { RAIL_WIDTH } from '../constants/layout';
import { NODE_KINDS } from '../constants/nodeKinds';
import ResizeHandle from './ResizeHandle';

const onDragStart = (event, kind) => {
  event.dataTransfer.setData('application/reactflow', kind);
  event.dataTransfer.effectAllowed = 'move';
};

/**
 * Satu layout untuk dua mode, supaya ikon TIDAK berpindah saat diciutkan/diperluas:
 * - Isi sidebar selalu selebar `width`; wrapper yang menganimasikan lebar & memotong sisanya.
 * - Ikon berada di kolom tetap (tengahnya = RAIL_WIDTH / 2); label & judul hanya memudar.
 */
export default function Sidebar({ visible, width, transition, resizing, onResizeStart, onResetWidth, onAddNode }) {
  const collapsed = !visible;

  const [tip, setTip] = useState(null);
  const showTip = (label) => (event) => {
    if (!collapsed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTip({ label, top: rect.top + rect.height / 2, left: rect.right + 10 });
  };
  const hideTip = () => setTip(null);

  return (
    <div
      className={`vb-sidebar${collapsed ? ' is-collapsed' : ''}${resizing ? ' is-resizing' : ''}`}
      style={{ width: `${collapsed ? RAIL_WIDTH : width}px`, transition, '--sb-width': `${width}px` }}
    >
      <aside className="vb-sidebar__inner" aria-label="Komponen node">
        <h3 className="vb-sidebar__title" aria-hidden={collapsed}>Komponen Node</h3>

        {Object.entries(NODE_KINDS).map(([kind, { icon, color, sidebar }]) => (
          <div
            key={kind}
            className="vb-side-item"
            style={{ '--accent': color }}
            draggable
            role="button"
            tabIndex={0}
            aria-label={`Tambah ${sidebar}`}
            title={collapsed ? undefined : `${sidebar}: seret ke kanvas atau double-click`}
            onDragStart={(event) => {
              hideTip();
              onDragStart(event, kind);
            }}
            onDoubleClick={() => onAddNode(kind)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onAddNode(kind);
              }
            }}
            onMouseEnter={showTip(sidebar)}
            onMouseLeave={hideTip}
            onFocus={showTip(sidebar)}
            onBlur={hideTip}
          >
            <span className="vb-side-item__icon"><i className={`fa-solid ${icon}`}></i></span>
            <span className="vb-side-item__label">{sidebar}</span>
          </div>
        ))}
      </aside>

      {collapsed && tip && (
        <div className="vb-rail__tooltip" role="tooltip" style={{ top: tip.top, left: tip.left }}>
          {tip.label}
          <span className="vb-rail__tooltip-hint">seret / double-click</span>
        </div>
      )}

      {visible && <ResizeHandle side="right" active={resizing} onMouseDown={onResizeStart} onDoubleClick={onResetWidth} />}
    </div>
  );
}