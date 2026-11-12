import { useEffect, useState } from 'react';
import { Panel, useReactFlow } from '@xyflow/react';

// Komponen terisolasi: update koordinat tiap mousemove tidak me-render ulang seluruh App/kanvas
export default function CursorCoordinates({ containerRef, theme }) {
  const { screenToFlowPosition } = useReactFlow();
  const [pos, setPos] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e) => setPos(screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    const onLeave = () => setPos(null);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [containerRef, screenToFlowPosition]);

  if (!pos) return null;

  const isDark = theme === 'dark';
  return (
    <Panel position="bottom-center">
      <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11px', padding: '4px 10px', borderRadius: '4px', background: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)', color: isDark ? '#94a3b8' : '#475569', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, pointerEvents: 'none', userSelect: 'none', fontVariantNumeric: 'tabular-nums' }}>
        X: {Math.round(pos.x)} &nbsp; Y: {Math.round(pos.y)}
      </div>
    </Panel>
  );
}
