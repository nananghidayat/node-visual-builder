import Logo from './Logo';

function ThemeSwitch({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '13px', color: '#94a3b8' }}>Tema:</span>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Ganti tema"
        onClick={onToggle}
        style={{ width: '46px', height: '22px', background: isDark ? '#4f46e5' : '#cbd5e1', borderRadius: '12px', position: 'relative', cursor: 'pointer', border: 'none', padding: 0, transition: 'background 0.3s' }}
      >
        <span
          style={{ width: '18px', height: '18px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: isDark ? '26px' : '2px', transition: 'left 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#334155', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
        >
          <i className={`fa-solid ${isDark ? 'fa-moon' : 'fa-sun'}`}></i>
        </span>
      </button>
    </div>
  );
}

export default function Header({ projectName, onProjectNameChange, theme, onToggleTheme, onGenerate, isGenerating }) {
  return (
    <header style={{ padding: '10px 20px', background: '#1e1e1e', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2d3748', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 650, letterSpacing: '-0.2px', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Logo size={24} title="" />
          Node Visual Builder
        </h2>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>Proyek:</span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            style={{ background: '#334155', color: '#fff', border: '1px solid #475569', padding: '5px 10px', borderRadius: '4px', fontSize: '13px', outline: 'none' }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <ThemeSwitch theme={theme} onToggle={onToggleTheme} />

        <button
          onClick={onGenerate}
          disabled={isGenerating}
          style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: '6px', cursor: isGenerating ? 'wait' : 'pointer', opacity: isGenerating ? 0.7 : 1, fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <i className={`fa-solid ${isGenerating ? 'fa-spinner fa-spin' : 'fa-code'}`}></i>
          {isGenerating ? 'Generating…' : 'Generate Code'}
        </button>
      </div>
    </header>
  );
}
