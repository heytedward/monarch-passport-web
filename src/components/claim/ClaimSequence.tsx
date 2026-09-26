import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RARITY_COLORS } from '../../lib/destijlPalette';
import {
  mountClaimSequence,
  type ClaimArtifactInfo,
  type ClaimEngine,
  type ClaimOutcome,
} from './claimSequenceEngine';

interface ClaimSequenceProps {
  artifact: ClaimArtifactInfo;
  /** Privy has resolved (login state is known). */
  ready: boolean;
  authenticated: boolean;
  login: () => void;
  /** Performs the claim; rejects with an Error whose message is shown in the panel. */
  claim: () => Promise<ClaimOutcome>;
  onCloset: () => void;
  onAscension: () => void;
}

// Full-screen first-claim sequence: sealed card -> tear + turn -> reveal ->
// WNGS reward -> closet / Ascension CTAs. The canvas engine owns its DOM; this
// wrapper mounts it once and feeds it auth state and the claim request.
const ClaimSequence: React.FC<ClaimSequenceProps> = ({
  artifact, ready, authenticated, login, claim, onCloset, onAscension,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ClaimEngine | null>(null);
  // Latest props for the engine's callbacks, so it never needs remounting.
  const latest = useRef({ authenticated, login, claim, onCloset, onAscension });
  latest.current = { authenticated, login, claim, onCloset, onAscension };
  // Set when claim is pressed while signed out; the claim runs after login.
  const pendingClaim = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const engine = mountClaimSequence(root, {
      artifact,
      rarityColor: RARITY_COLORS[artifact.tier.toUpperCase()] || RARITY_COLORS.COMMON,
      onPress: () => {
        if (!latest.current.authenticated) {
          pendingClaim.current = true;
          latest.current.login();
          return;
        }
        engine.begin(latest.current.claim());
      },
      onCloset: () => latest.current.onCloset(),
      onAscension: () => latest.current.onAscension(),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
      document.body.style.overflow = prevOverflow;
    };
    // Mount once per artifact; later prop changes flow through `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact.id]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setAuthState(ready, authenticated);
    if (authenticated && pendingClaim.current) {
      pendingClaim.current = false;
      engine.begin(latest.current.claim());
    }
  }, [ready, authenticated]);

  // Portal to <body>: route pages sit inside PageTransition's
  // `will-change: transform` wrapper, which would otherwise become the
  // containing block for this position:fixed layer and collapse it to 0px.
  return createPortal(<div ref={rootRef} />, document.body);
};

export default ClaimSequence;
