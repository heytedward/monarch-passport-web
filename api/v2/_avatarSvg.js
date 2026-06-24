// Server-side De Stijl avatar renderer -> SVG string, for the NFT image.
// Mirrors src/components/DeStijlAvatar.tsx's 3x3 grid + constant eyes (blocks
// 4 & 6) + mouth (block 8), rendered STATIC (no blink) as the canonical image.
// Underscore prefix => not a Vercel serverless function.

const FALLBACK = ['#FFFFFF', '#1A202C', '#FFFFFF', '#1A202C', '#E53E3E', '#1A202C', '#FFFFFF', '#1A202C', '#FFFFFF'];

export function avatarSvg(palette) {
  const colors = Array.isArray(palette) && palette.length === 9 ? palette : FALLBACK;
  let parts = '';
  for (let i = 0; i < 9; i++) {
    const x = (i % 3) * 100;
    const y = Math.floor(i / 3) * 100;
    parts += `<rect x="${x}" y="${y}" width="100" height="100" fill="${colors[i]}" stroke="#000000" stroke-width="8"/>`;
    // Eyes: blocks 4 & 6 (zero-based index 3 & 5)
    if (i === 3 || i === 5) parts += `<rect x="${x + 30}" y="${y + 30}" width="40" height="40" fill="#000000"/>`;
    // Mouth: block 8 (index 7)
    if (i === 7) parts += `<rect x="${x + 20}" y="${y + 40}" width="60" height="20" fill="#000000"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">${parts}</svg>`;
}
