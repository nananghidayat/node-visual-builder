import { useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './styles/canvas.css';

import { generateProject } from './api/generateProject';
import { buildSettings } from './constants/serverConfig';
import { useCanvasShortcuts } from './hooks/useCanvasShortcuts';
import { useFlowEditor } from './hooks/useFlowEditor';
import { usePanelResize } from './hooks/usePanelResize';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';

import FlowCanvas from './components/FlowCanvas';
import Header from './components/Header';
import PreviewPanel from './components/PreviewPanel';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import Toolbar from './components/Toolbar';

export default function AppWrapper() {
  return (
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  );
}

function App() {
  const mainRef = useRef(null);

  const editor = useFlowEditor();
  const panels = usePanelResize(mainRef);
  const { theme, toggleTheme } = useTheme('dark');
  const { toast, showToast, hideToast } = useToast();

  const [tool, setTool] = useState('pan'); // 'pan' | 'select'
  const [projectName, setProjectName] = useState('my-awesome-app');
  const [codeResult, setCodeResult] = useState('// Masukkan nama proyek di atas, lalu klik "Generate Code".');
  const [isGenerating, setIsGenerating] = useState(false);

  useCanvasShortcuts({ onUndo: editor.history.undo, onRedo: editor.history.redo, onTool: setTool });

  const handleGenerate = async () => {
    if (isGenerating) return; // cegah double-click mengirim dua request
    setIsGenerating(true);
    const settings = buildSettings(projectName, editor.nodes);
    const result = await generateProject({ nodes: editor.nodes, edges: editor.edges, projectName, settings });
    setIsGenerating(false);

    switch (result.status) {
      case 'success':
        setCodeResult(result.preview);
        break;
      case 'conflict':
        showToast('Gagal membuat folder', result.message);
        break;
      case 'offline':
        showToast('Backend tidak terhubung', 'Pastikan server di port 5000 sudah jalan.');
        break;
      default:
        setCodeResult(`// Gagal generate (HTTP ${result.httpStatus}): ${result.message}`);
        showToast('Generate gagal', result.message);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Toast toast={toast} onClose={hideToast} />

      <Header
        projectName={projectName}
        onProjectNameChange={setProjectName}
        theme={theme}
        onToggleTheme={toggleTheme}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />

      <Toolbar
        sidebar={panels.sidebar}
        preview={panels.preview}
        tool={tool}
        onToolChange={setTool}
        history={editor.history}
        selectedCount={editor.selectedCount}
        onDeleteSelected={editor.deleteSelected}
      />

      <div ref={mainRef} style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <Sidebar
          visible={panels.sidebar.visible}
          width={panels.sidebar.width}
          transition={panels.panelTransition}
          resizing={panels.resizeTarget === 'sidebar'}
          onResizeStart={panels.startResize('sidebar')}
          onResetWidth={panels.resetWidth('sidebar')}
          onAddNode={editor.addNodeAtCenter}
        />

        <FlowCanvas editor={editor} theme={theme} tool={tool} isResizing={panels.isResizing} projectName={projectName} />

        <PreviewPanel
          visible={panels.preview.visible}
          width={panels.preview.width}
          transition={panels.panelTransition}
          resizing={panels.resizeTarget === 'preview'}
          onResizeStart={panels.startResize('preview')}
          onResetWidth={panels.resetWidth('preview')}
          content={codeResult}
        />
      </div>
    </div>
  );
}
