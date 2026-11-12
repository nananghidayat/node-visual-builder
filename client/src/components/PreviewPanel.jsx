import ResizeHandle from './ResizeHandle';

export default function PreviewPanel({ visible, width, transition, resizing, onResizeStart, onResetWidth, content }) {
  return (
    <div style={{ position: 'relative', width: visible ? `${width}px` : '0px', opacity: visible ? 1 : 0, overflow: 'hidden', transition, flexShrink: 0 }}>
      {visible && <ResizeHandle side="left" active={resizing} onMouseDown={onResizeStart} onDoubleClick={onResetWidth} />}

      <div style={{ width: `${width}px`, minWidth: `${width}px`, boxSizing: 'border-box', background: '#0f172a', color: '#38bdf8', padding: '20px', overflowY: 'auto', userSelect: 'none', height: '100%' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#f8fafc', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Pratinjau Struktur Proyek:
        </h3>
        <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text' }}>
          {content}
        </pre>
      </div>
    </div>
  );
}
