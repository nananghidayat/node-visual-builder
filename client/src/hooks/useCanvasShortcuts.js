import { useEffect, useRef } from 'react';
import { isTypingTarget } from '../utils/helpers';

/**
 * Shortcut kanvas dalam satu listener:
 *   Ctrl/⌘+Z            → undo
 *   Ctrl/⌘+Shift+Z, Ctrl+Y → redo
 *   V / H               → mode select / pan
 * Tidak aktif saat fokus di input (biar undo teks bawaan browser tetap jalan).
 */
export function useCanvasShortcuts({ onUndo, onRedo, onTool }) {
  // Simpan handler terbaru di ref supaya listener cukup dipasang sekali
  const handlers = useRef({ onUndo, onRedo, onTool });
  handlers.current = { onUndo, onRedo, onTool };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      const { onUndo: undo, onRedo: redo, onTool: setTool } = handlers.current;

      if (e.ctrlKey || e.metaKey) {
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((key === 'z' && e.shiftKey) || key === 'y') {
          e.preventDefault();
          redo();
        }
        return;
      }
      if (e.altKey) return;
      if (key === 'v') setTool('select');
      if (key === 'h') setTool('pan');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
