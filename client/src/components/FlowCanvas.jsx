import { useCallback, useEffect, useRef, useState } from 'react';
import { Background, Controls, MiniMap, Panel, ReactFlow, SelectionMode } from '@xyflow/react';
import { FALLBACK_COLOR, NODE_KINDS } from '../constants/nodeKinds';
import { HistoryContext } from '../context/HistoryContext';
import { nodeTypes } from '../nodes';
import ContextMenu from './ContextMenu';
import CursorCoordinates from './CursorCoordinates';
import DatabaseInspector from './inspector/DatabaseInspector';
import EndpointInspector from './inspector/EndpointInspector';
import ServerInspector from './inspector/ServerInspector';

// Endpoint yang terhubung langsung ke node tertentu (untuk panel Database)
const linkedEndpointsOf = (nodeId, nodes, edges) => {
  const ids = new Set(edges.flatMap((e) => (e.source === nodeId ? [e.target] : e.target === nodeId ? [e.source] : [])));
  return nodes.filter((n) => ids.has(n.id) && n.type === 'endpoint');
};

// Pilih panel sesuai jenis node. key={node.id} supaya draft reset saat pindah node.
function Inspector({ editor, projectName }) {
  const node = editor.inspectedNode;
  const close = editor.clearSelection;
  if (node.data.kind === 'server') {
    return <ServerInspector key={node.id} node={node} onSave={editor.updateNodeConfig} onClose={close} />;
  }
  if (node.data.kind === 'database') {
    return (
      <DatabaseInspector
        key={node.id}
        node={node}
        linkedEndpoints={linkedEndpointsOf(node.id, editor.nodes, editor.edges)}
        projectName={projectName}
        onSave={editor.updateNodeConfig}
        onClose={close}
      />
    );
  }
  return <EndpointInspector key={node.id} node={node} nodes={editor.nodes} onSave={editor.updateEndpointConfig} onClose={close} />;
}

const minimapNodeColor = (n) => NODE_KINDS[n.data?.kind]?.color ?? FALLBACK_COLOR;

export default function FlowCanvas({ editor, theme, tool, isResizing, projectName }) {
  const canvasRef = useRef(null);
  const [menu, setMenu] = useState(null);

  // Tutup context menu saat klik di mana pun
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    setMenu({ id: node.id, type: 'node', top: event.clientY, left: event.clientX });
  }, []);

  const onEdgeContextMenu = useCallback((event, edge) => {
    event.preventDefault();
    setMenu({ id: edge.id, type: 'edge', top: event.clientY, left: event.clientX });
  }, []);

  const handleMenuDelete = (id, type) => {
    editor.deleteElement(id, type);
    setMenu(null);
  };

  const isDark = theme === 'dark';

  return (
    <div
      ref={canvasRef}
      onDrop={editor.onDrop}
      onDragOver={editor.onDragOver}
      // Saat resize panel, kanvas tidak menangkap pointer supaya tidak ikut pan/seleksi
      style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative', pointerEvents: isResizing ? 'none' : 'auto' }}
    >
      <HistoryContext.Provider value={editor.history.takeSnapshot}>
        <ReactFlow
          nodes={editor.nodes}
          edges={editor.edges}
          nodeTypes={nodeTypes}
          {...editor.handlers}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          className={tool === 'select' ? 'vb-tool-select' : undefined}
          selectionOnDrag={tool === 'select'}
          panOnDrag={tool === 'select' ? [1] : true}
          selectionMode={SelectionMode.Partial}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
        >
          <Background gap={16} size={1} />
          <Controls />
          <MiniMap
            nodeColor={minimapNodeColor}
            nodeStrokeWidth={0}
            nodeBorderRadius={4}
            maskColor={isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(241, 245, 249, 0.65)'}
            maskStrokeColor="#6366f1"
            maskStrokeWidth={2}
            style={{ background: isDark ? '#0f172a' : '#ffffff' }}
            pannable
            zoomable
          />
          <CursorCoordinates containerRef={canvasRef} theme={theme} />
          {editor.inspectedNode && (
            <Panel position="top-right">
              <Inspector editor={editor} projectName={projectName} />
            </Panel>
          )}
        </ReactFlow>
      </HistoryContext.Provider>

      <ContextMenu menu={menu} onDelete={handleMenuDelete} />
    </div>
  );
}
