import React from 'react';
import { beginProgress, useProgressActive } from '../../lib/progress';

const SHOW_AFTER_MS = 180; // quick loads never flash the bar

/**
 * Thin gold bar across the top of the screen while a page's code or first
 * data is loading. It creeps toward 85%, then completes and fades when the
 * work is done.
 */
export default function TopProgressBar() {
  const active = useProgressActive();
  const [state, setState] = React.useState<'idle' | 'run' | 'done'>('idle');

  React.useEffect(() => {
    if (active) {
      const id = window.setTimeout(() => setState('run'), SHOW_AFTER_MS);
      return () => window.clearTimeout(id);
    }
    setState((s) => (s === 'run' ? 'done' : 'idle'));
  }, [active]);

  React.useEffect(() => {
    if (state !== 'done') return;
    const id = window.setTimeout(() => setState('idle'), 450);
    return () => window.clearTimeout(id);
  }, [state]);

  const width = state === 'run' ? '85%' : state === 'done' ? '100%' : '0%';
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1500,
        height: 3,
        width,
        opacity: state === 'idle' ? 0 : 1,
        background: 'var(--monarch-accent, #FFB000)',
        boxShadow: '0 0 8px var(--monarch-accent, #FFB000)',
        transition:
          state === 'run'
            ? 'width 2.4s cubic-bezier(.1,.7,.2,1), opacity .15s'
            : state === 'done'
              ? 'width .2s ease-out, opacity .25s .2s'
              : 'none',
        pointerEvents: 'none',
      }}
    />
  );
}

/** Suspense fallback for route pages: black screen plus the progress bar. */
export function RouteFallback() {
  React.useEffect(() => beginProgress(), []);
  return <div style={{ minHeight: '100vh', background: 'black' }} />;
}
