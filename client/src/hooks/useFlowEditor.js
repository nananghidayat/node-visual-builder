import { useCallback, useState } from 'react';
import { addEdge, applyEdgeChanges, applyNodeChanges, useReactFlow, useStoreApi } from '@xyflow/react';
import {
  NODE_KINDS,
  endpointLabel,
  getId,
  initialEdges,
  initialNodes,
  isConfigurableKind,
  isEndpointKind,
  makeNode,
  uniqueEndpointPath,
} from '../constants/nodeKinds';
import { useHistory } from './useHistory';

/**
 * Semua state & handler kanvas: nodes, edges, seleksi, hapus, drop, sambung,
 * plus undo/redo. Komponen UI cukup menerima hasil hook ini.
 */
export function useFlowEditor() {
  const { screenToFlowPosition } = useReactFlow();
  const store = useStoreApi();
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selected, setSelected] = useState({ nodes: [], edges: [] });

  const history = useHistory(nodes, edges, setNodes, setEdges);
  const { takeSnapshot } = history;

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const onConnect = useCallback(
    (connection) => {
      takeSnapshot();
      setEdges((eds) => addEdge(connection, eds));
    },
    [takeSnapshot]
  );

  // Snapshot sekali di awal drag (bukan tiap pergerakan): satu geser = satu langkah undo
  const onNodeDragStart = useCallback(() => takeSnapshot(), [takeSnapshot]);

  // Hapus via keyboard (Backspace/Delete) bawaan React Flow
  const onBeforeDelete = useCallback(async () => {
    takeSnapshot();
    return true;
  }, [takeSnapshot]);

  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }) => {
    setSelected({ nodes: selNodes.map((n) => n.id), edges: selEdges.map((e) => e.id) });
  }, []);

  const selectedCount = selected.nodes.length + selected.edges.length;

  const deleteElement = useCallback(
    (id, type) => {
      takeSnapshot();
      if (type === 'node') {
        setNodes((nds) => nds.filter((n) => n.id !== id));
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      } else {
        setEdges((eds) => eds.filter((e) => e.id !== id));
      }
    },
    [takeSnapshot]
  );

  const deleteSelected = useCallback(() => {
    if (selected.nodes.length === 0 && selected.edges.length === 0) return;
    takeSnapshot();
    const nodeIds = new Set(selected.nodes);
    const edgeIds = new Set(selected.edges);
    setNodes((nds) => nds.filter((n) => !nodeIds.has(n.id)));
    setEdges((eds) => eds.filter((e) => !edgeIds.has(e.id) && !nodeIds.has(e.source) && !nodeIds.has(e.target)));
    setSelected({ nodes: [], edges: [] });
  }, [selected, takeSnapshot]);

  // Simpan konfigurasi endpoint (auth/params/body) sebagai satu langkah undo
  const updateEndpointConfig = useCallback(
    (id, config) => {
      takeSnapshot();
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, ...config, label: endpointLabel(n.data.kind, n.data.path, config.params) } }
            : n
        )
      );
    },
    [takeSnapshot]
  );

  // Batalkan seleksi lewat state kita sendiri (flow ini controlled)
  const clearSelection = useCallback(() => {
    setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)));
    setEdges((eds) => eds.map((e) => (e.selected ? { ...e, selected: false } : e)));
  }, []);

  // Simpan konfigurasi node Server/Database (data.config) sebagai satu langkah undo
  const updateNodeConfig = useCallback(
    (id, config) => {
      takeSnapshot();
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, config } } : n)));
    },
    [takeSnapshot]
  );

  // Panel properti hanya muncul saat tepat satu node yang bisa dikonfigurasi dipilih (tanpa koneksi)
  const inspectedNode =
    selected.nodes.length === 1 && selected.edges.length === 0
      ? nodes.find((n) => n.id === selected.nodes[0] && isConfigurableKind(n.data?.kind)) ?? null
      : null;

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const addNode = useCallback(
    (kind, position, { select = false, cascade = false } = {}) => {
      if (!NODE_KINDS[kind]) return;
      const id = getId();
      takeSnapshot();
      setNodes((nds) => {
        let pos = position;
        if (cascade) {
          const occupied = (p) => nds.some((n) => Math.abs(n.position.x - p.x) < 8 && Math.abs(n.position.y - p.y) < 8);
          while (occupied(pos)) pos = { x: pos.x + 24, y: pos.y + 24 };
        }
        const node = makeNode(id, kind, pos, isEndpointKind(kind) ? { path: uniqueEndpointPath(kind, nds) } : {});
        if (!select) return nds.concat(node);
        return nds.map((n) => (n.selected ? { ...n, selected: false } : n)).concat({ ...node, selected: true });
      });
      if (select) setEdges((eds) => eds.map((e) => (e.selected ? { ...e, selected: false } : e)));
    },
    [takeSnapshot]
  );

  const addNodeAtCenter = useCallback(
    (kind) => {
      const { width, height, transform } = store.getState();
      const [tx, ty, zoom] = transform;
      const NODE_HALF_WIDTH = 100; // .vb-node width 200px
      const NODE_HALF_HEIGHT = 30;
      const center = { x: (width / 2 - tx) / zoom - NODE_HALF_WIDTH, y: (height / 2 - ty) / zoom - NODE_HALF_HEIGHT };
      addNode(kind, { x: Math.round(center.x), y: Math.round(center.y) }, { select: true, cascade: true });
    },
    [store, addNode]
  );

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData('application/reactflow');
      addNode(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [screenToFlowPosition, addNode]
  );

  return {
    nodes,
    edges,
    selectedCount,
    history,
    handlers: {
      onNodesChange,
      onEdgesChange,
      onConnect,
      onNodeDragStart,
      onSelectionDragStart: onNodeDragStart,
      onBeforeDelete,
      onSelectionChange,
    },
    inspectedNode,
    updateEndpointConfig,
    updateNodeConfig,
    clearSelection,
    deleteElement,
    deleteSelected,
    onDragOver,
    onDrop,
    addNodeAtCenter,
  };
}
