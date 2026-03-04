import React from 'react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
      className={`
        w-8 h-8 flex items-center justify-center rounded-lg
        transition-all duration-200
        hover:scale-110
        ${className}
      `}
      style={{ fontSize: '1.1rem', lineHeight: 1 }}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}