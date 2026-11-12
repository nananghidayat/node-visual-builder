import { useCallback, useRef, useState } from 'react';
import { HISTORY_LIMIT } from '../constants/layout';

/**
 * Undo/redo berbasis snapshot { nodes, edges }.
 * Ref = sumber kebenaran (aman dari stale closure & klik beruntun); state = untuk re-render tombol.
 * Panggil takeSnapshot() SEBELUM perubahan struktur (tambah/hapus/sambung/geser/edit).
 */
export function useHistory(nodes, edges, setNodes, setEdges) {
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const [history, setHistory] = useState({ past: [], future: [] });
  const historyRef = useRef(history);

  const commit = (next) => {
    historyRef.current = next;
    setHistory(next);
  };

  const current = () => ({ nodes: nodesRef.current, edges: edgesRef.current });

  const restore = useCallback(
    (snapshot) => {
      // Seleksi tidak ikut dipulihkan supaya tombol hapus tidak menunjuk elemen yang keliru
      const nds = snapshot.nodes.map((n) => ({ ...n, selected: false }));
      const eds = snapshot.edges.map((e) => ({ ...e, selected: false }));
      nodesRef.current = nds;
      edgesRef.current = eds;
      setNodes(nds);
      setEdges(eds);
    },
    [setNodes, setEdges]
  );

  const takeSnapshot = useCallback(() => {
    const { past } = historyRef.current;
    commit({ past: [...past.slice(-(HISTORY_LIMIT - 1)), current()], future: [] });
  }, []);

  const undo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (past.length === 0) return;
    commit({ past: past.slice(0, -1), future: [...future, current()] });
    restore(past[past.length - 1]);
  }, [restore]);

  const redo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (future.length === 0) return;
    commit({ past: [...past, current()], future: future.slice(0, -1) });
    restore(future[future.length - 1]);
  }, [restore]);

  return {
    takeSnapshot,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
