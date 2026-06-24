import React, { useMemo } from 'react';

import useStore from '../store/useStore';

interface DeStijlAvatarProps {
  seed: string;
  size?: number;
  colors?: string[];
  /**
   * Frame shape. 'square' is the current De Stijl block grid; 'circle' clips
   * the same grid to a disc. The blinking eyes + mouth stay constant across
   * shapes -- this is the lever for evolving the avatar "era" (square -> circle
   * -> ... ) without ever losing the face.
   */
  shape?: 'square' | 'circle';
}

const PALETTE = [
  '#FFFFFF', // White
  '#1A202C', // Black (Monarch)
  '#E53E3E', // Red
  '#3182CE', // Blue
  '#FFB000', // Monarch Gold
];

const DeStijlAvatar: React.FC<DeStijlAvatarProps> = ({ seed, size = 100, colors, shape = 'square' }) => {
  const { activeAvatarColors } = useStore();
  const effectiveColors = colors || activeAvatarColors;

  // Unique id so multiple avatars on one page don't share a clipPath def.
  const clipId = React.useId().replace(/:/g, '');

  // Simple deterministic hash function
  const hash = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
    }
    return h;
  }, [seed]);

  // Generate pseudo-random numbers from hash
  const getRand = (index: number) => {
    const x = Math.sin(hash + index) * 10000;
    return x - Math.floor(x);
  };

  const getColor = (index: number) => {
    if (effectiveColors && effectiveColors[index - 1]) {
      return effectiveColors[index - 1];
    }
    const r = getRand(index);
    return PALETTE[Math.floor(r * PALETTE.length)];
  };

  const blocks = useMemo(() => {
    const result = [];
    for (let i = 1; i <= 9; i++) {
      result.push({
        id: i,
        x: ((i - 1) % 3) * 100,
        y: Math.floor((i - 1) / 3) * 100,
        fill: getColor(i)
      });
    }
    return result;
  }, [hash, effectiveColors]);

  const isCircle = shape === 'circle';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 300"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <style>
        {`
          @keyframes mechanicalBlink {
            0%, 93%, 97%, 100% { transform: scaleY(1); }
            95% { transform: scaleY(0); }
          }
          .destijl-pupil {
            transform-origin: center;
            transform-box: fill-box;
            animation: mechanicalBlink 4s infinite;
          }
        `}
      </style>

      {isCircle && (
        <defs>
          <clipPath id={clipId}>
            <circle cx="150" cy="150" r="150" />
          </clipPath>
        </defs>
      )}

      <g clipPath={isCircle ? `url(#${clipId})` : undefined}>
        {blocks.map((b) => (
          <React.Fragment key={b.id}>
            {/* Main Block */}
            <rect
              x={b.x}
              y={b.y}
              width="100"
              height="100"
              fill={b.fill}
              stroke="#000000"
              strokeWidth="8"
            />

            {/* Eyes (Blocks 4 & 6) */}
            {(b.id === 4 || b.id === 6) && (
              <rect
                className="destijl-pupil"
                x={b.x + 30}
                y={b.y + 30}
                width="40"
                height="40"
                fill="#000000"
              />
            )}

            {/* Mouth (Block 8) */}
            {b.id === 8 && (
              <rect
                x={b.x + 20}
                y={b.y + 40}
                width="60"
                height="20"
                fill="#000000"
              />
            )}
          </React.Fragment>
        ))}
      </g>

      {/* Clean circular frame on top of the clipped grid */}
      {isCircle && (
        <circle cx="150" cy="150" r="146" fill="none" stroke="#000000" strokeWidth="8" />
      )}
    </svg>
  );
};

export default DeStijlAvatar;
