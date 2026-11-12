import { useState } from 'react';
import { HANDLE_WIDTH } from '../constants/layout';

// Garis tipis di tepi panel untuk drag-resize. Overlay (absolute) supaya tidak ikut dihitung flex.
export default function ResizeHandle({ side, active, onMouseDown, onDoubleClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Geser untuk ubah lebar · Double-click untuk reset"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side]: 0,
        width: `${HANDLE_WIDTH}px`,
        cursor: 'col-resize',
        zIndex: 20,
        background: active || hovered ? '#6366f1' : '#334155',
        transition: 'background 0.15s',
      }}
    />
  );
}
