import { useEffect, useState } from 'react';

export function useTheme(initial = 'dark') {
  const [theme, setTheme] = useState(initial);

  // Class di <html> dipakai canvas.css (html.dark ...) untuk warna node & kontrol
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light')),
  };
}
