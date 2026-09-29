import React from 'react';
import './LaunchSplash.css';
import { LOGO_DOT_BOTTOM, LOGO_DOT_TOP, LOGO_VIEWBOX, LOGO_WING_LEFT, LOGO_WING_RIGHT } from '../lib/logoPaths';

const SPIN_MS = 900; // one turn of the loading ring
const REVEAL_MS = 1550; // dots -> wings -> wordmark, then a short hold
const OUT_MS = 350;

/**
 * Full-screen launch splash, shown while a returning visitor's login is
 * restored. The ring spins for as long as that takes; once `ready`, it
 * settles upright, breaks into the logo's dots, the wings unfold and flap,
 * "MONARCH PASSPORT" rises in, and the splash fades to reveal the app (which
 * has been rendering and loading its data underneath the whole time).
 */
export default function LaunchSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const ringRef = React.useRef<SVGGElement>(null);
  const spin = React.useRef<Animation | null>(null);
  const [phase, setPhase] = React.useState<'spin' | 'settle' | 'reveal' | 'out'>('spin');
  const reduce = React.useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);

  React.useEffect(() => {
    const ring = ringRef.current;
    if (!ring || reduce || !ring.animate) return;
    spin.current = ring.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: SPIN_MS, iterations: Infinity },
    );
    return () => spin.current?.cancel();
  }, [reduce]);

  React.useEffect(() => {
    if (!ready || phase !== 'spin') return;
    const ring = ringRef.current;
    if (reduce || !ring?.animate || !spin.current) {
      setPhase('reveal');
      return;
    }
    // Ease the ring from wherever it is to the next upright position, so the
    // arcs collapse exactly onto the dots.
    setPhase('settle');
    const t = Number(spin.current.currentTime ?? 0) % SPIN_MS;
    const angle = (t / SPIN_MS) * 360;
    spin.current.cancel();
    const settle = ring.animate(
      [{ transform: `rotate(${angle}deg)` }, { transform: 'rotate(720deg)' }],
      { duration: 520, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' },
    );
    settle.finished.then(() => setPhase('reveal'), () => setPhase('reveal'));
  }, [ready, phase, reduce]);

  React.useEffect(() => {
    if (phase === 'reveal') {
      const id = window.setTimeout(() => setPhase('out'), reduce ? 400 : REVEAL_MS);
      return () => window.clearTimeout(id);
    }
    if (phase === 'out') {
      const id = window.setTimeout(onDone, OUT_MS);
      return () => window.clearTimeout(id);
    }
  }, [phase, reduce, onDone]);

  const cls = `launch-splash${phase === 'reveal' || phase === 'out' ? ' is-reveal' : ''}${phase === 'out' ? ' is-out' : ''}`;
  return (
    <div className={cls} role="status" aria-live="polite" aria-label="Loading Monarch Passport">
      <svg viewBox={LOGO_VIEWBOX} fill="#FFB000" aria-hidden="true">
        <g className="ls-ringwrap">
          <g className="ls-ring" ref={ringRef}>
            <circle className="ls-arc ls-a1" cx="965" cy="410" r="129" pathLength={100} />
            <circle className="ls-arc ls-a2" cx="965" cy="410" r="129" pathLength={100} />
          </g>
        </g>
        <g className="ls-dots">
          <path d={LOGO_DOT_TOP} />
          <path d={LOGO_DOT_BOTTOM} />
        </g>
        <path className="ls-wl" d={LOGO_WING_LEFT} />
        <path className="ls-wr" d={LOGO_WING_RIGHT} />
      </svg>
      <div className="ls-word">MONARCH<br />PASSPORT</div>
    </div>
  );
}
