// Store/closet preview for a THEME: the same De Stijl square grid as an avatar,
// but no face -- a checkerboard of the theme's two colors (background from its
// light/dark mode + the accent as the highlight).
interface ThemeSwatchProps {
  accent?: string | null;
  mode?: 'light' | 'dark' | null;
  size?: number;
}

const ThemeSwatch = ({ accent, mode = 'dark', size = 60 }: ThemeSwatchProps) => {
  const bg = mode === 'light' ? '#FFFFFF' : '#1A202C';
  const hi = accent || '#FFB000';

  // 3x3 checkerboard: highlight on even cells, background on odd.
  const cells = Array.from({ length: 9 }, (_, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    return (row + col) % 2 === 0 ? hi : bg;
  });

  return (
    <svg width={size} height={size} viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      {cells.map((c, i) => (
        <rect
          key={i}
          x={(i % 3) * 100}
          y={Math.floor(i / 3) * 100}
          width="100"
          height="100"
          fill={c}
          stroke="#000000"
          strokeWidth="8"
        />
      ))}
    </svg>
  );
};

export default ThemeSwatch;
