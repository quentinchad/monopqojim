import React from 'react';
import { THEMES, setThemeId, useThemeId } from '../themes.js';

export default function ThemePicker({ label = true }) {
  const current = useThemeId();
  return (
    <div className="theme-picker">
      {label && <span className="tp-label">🎨 Thème</span>}
      {Object.entries(THEMES).map(([id, t]) => (
        <button key={id} className={`theme-swatch ${id === current ? 'active' : ''}`} title={t.name}
          style={{ background: `linear-gradient(135deg, ${t.scene.skyTop}, ${t.css.accent})` }}
          onClick={() => setThemeId(id)}>
          {t.icon}
        </button>
      ))}
    </div>
  );
}
