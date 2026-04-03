import { useTheme } from '../context/ThemeContext';
import { useEffect, useState } from 'react';

export default function ThemeTest() {
  const { theme, toggleTheme, isDarkMode, setDarkMode } = useTheme();
  const [htmlClass, setHtmlClass] = useState(document.documentElement.className);

  useEffect(() => {
    const interval = setInterval(() => {
      setHtmlClass(document.documentElement.className);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handleClearStorage = () => {
    localStorage.removeItem('userPreferences');
    window.location.reload();
  };

  const handleForceLight = () => {
    setDarkMode(false);
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  };

  const handleForceDark = () => {
    setDarkMode(true);
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  };

  return (
    <div className="fixed bottom-4 right-4 p-4 rounded-lg shadow-2xl border-2 z-[9999]"
         style={{
           backgroundColor: 'rgb(30, 41, 59)',
           borderColor: 'rgb(51, 65, 85)',
           color: 'rgb(248, 250, 252)',
           minWidth: '280px'
         }}>
      <div className="space-y-3">
        <div>
          <p className="font-bold text-lg mb-1">🎨 Debug Tema</p>
          <p className="text-sm opacity-80">Tema: <span className="font-mono font-bold">{theme}</span></p>
          <p className="text-sm opacity-80">isDarkMode: <span className="font-mono">{isDarkMode ? 'true' : 'false'}</span></p>
          <p className="text-xs opacity-60 font-mono break-all">HTML: {htmlClass || 'sin clase'}</p>
        </div>

        <div className="space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full px-4 py-2 rounded-lg transition-colors font-medium"
            style={{ backgroundColor: 'rgb(59, 130, 246)', color: 'white' }}
          >
            🔄 Toggle Tema
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleForceLight}
              className="px-3 py-1.5 rounded text-sm font-medium"
              style={{ backgroundColor: 'rgb(248, 250, 252)', color: 'rgb(15, 23, 42)' }}
            >
              ☀️ Light
            </button>
            <button
              onClick={handleForceDark}
              className="px-3 py-1.5 rounded text-sm font-medium"
              style={{ backgroundColor: 'rgb(15, 23, 42)', color: 'rgb(248, 250, 252)', border: '1px solid rgb(51, 65, 85)' }}
            >
              🌙 Dark
            </button>
          </div>

          <button
            onClick={handleClearStorage}
            className="w-full px-3 py-1.5 rounded text-xs font-medium"
            style={{ backgroundColor: 'rgb(239, 68, 68)', color: 'white' }}
          >
            🗑️ Limpiar Storage
          </button>
        </div>
      </div>
    </div>
  );
}
