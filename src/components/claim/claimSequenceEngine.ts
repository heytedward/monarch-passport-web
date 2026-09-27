// Canvas + DOM engine for the first-claim sequence on /v/:id.
//
// A face-down card (PLogo back) sits in a foil sleeve. Pressing claim tears
// the sleeve from the top-left while the card turns over; the tear holds at
// ~80% until the claim request settles, then rips off and colour floods the
// card, WNGS motes fly into the counter, and the closet / Ascension CTAs land.
//
// The engine owns its DOM (built into `root`) so React never re-renders over
// the imperative state; ClaimSequence.tsx is the thin React wrapper.

export interface ClaimArtifactInfo {
  id: string;
  name: string;
  tier: string;
  collection: string | null;
  season: string | null;
  isSeasonArtifact: boolean;
}

export interface ClaimOutcome {
  awarded: number;
  premiumUnlocked: boolean;
}

export interface ClaimEngineOptions {
  artifact: ClaimArtifactInfo;
  rarityColor: string;
  onPress: () => void;
  onCloset: () => void;
  onAscension: () => void;
}

export interface ClaimEngine {
  /** Run the tear/reveal against a claim request. Rejections show their message. */
  begin: (claim: Promise<ClaimOutcome>) => void;
  setAuthState: (ready: boolean, authenticated: boolean) => void;
  destroy: () => void;
}

// Self-hosted brand font (public/fonts/unbounded.css), shared with the app.
const FONT_HREF = '/fonts/unbounded.css';
const FONT = "'Unbounded Variable', system-ui, sans-serif";

const CSS = `
.mcs { position: fixed; inset: 0; z-index: 1000; background: #000; overflow: hidden; color: #f4f4f4;
  font-family: var(--brand-font, 'Unbounded Variable', system-ui, sans-serif); user-select: none; -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent; --mcs-gold: #f0b429; --mcs-gold-hi: #ffd24a; --mcs-cyan: #3df0ff; }
.mcs [hidden] { display: none !important; }
.mcs canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.mcs-hud { position: absolute; inset: 0; z-index: 3; pointer-events: none; display: flex; flex-direction: column; align-items: center;
  padding: calc(env(safe-area-inset-top, 0px) + 14px) 18px calc(env(safe-area-inset-bottom, 0px) + 18px); }
.mcs-panel { margin-top: auto; width: min(92vw, 400px); pointer-events: auto; border: 2px solid var(--mcs-gold); background: rgba(0,0,0,.74);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); padding: 22px 18px 16px; box-sizing: border-box;
  transform: translateY(28px); opacity: 0;
  transition: transform .55s cubic-bezier(.16,1,.3,1), opacity .4s ease, border-color .4s, filter .4s; }
.mcs-panel.show { transform: none; opacity: 1; }
.mcs-panel.verifying { border-color: var(--mcs-cyan); }
.mcs-panel.out { transform: translateY(36px) scale(.96); opacity: 0; filter: blur(4px); transition-duration: .35s; }
.mcs-panel.live { border-color: var(--mcs-cyan); }
.mcs-kicker { color: var(--mcs-gold); font-size: 15px; line-height: 1.25; letter-spacing: .06em; text-align: center; font-family: var(--brand-font, 'Unbounded Variable', system-ui, sans-serif); }
.mcs-panel.live .mcs-kicker { color: #9aa; font-family: var(--brand-font, 'Unbounded Variable', system-ui, sans-serif); font-size: 11px; letter-spacing: .16em; text-align: left; min-height: 14px; }
.mcs-caret { display: inline-block; width: 7px; height: 11px; background: var(--mcs-cyan); margin-left: 3px; vertical-align: -1px; animation: mcs-blink .8s steps(1) infinite; }
@keyframes mcs-blink { 50% { opacity: 0; } }
.mcs-title { margin: 14px 0 8px; font-family: var(--brand-font, 'Unbounded Variable', system-ui, sans-serif); font-size: 26px; line-height: 1.05; letter-spacing: .02em; text-wrap: balance; text-transform: uppercase; }
.mcs-meta { color: var(--mcs-gold); font-size: 11px; letter-spacing: .08em; margin-bottom: 6px; text-transform: uppercase; }
.mcs-badge { display: inline-block; background: var(--mcs-gold); color: #000; padding: 2px 6px; margin-left: 6px; font-size: 10px; }
.mcs-badge.tier { background: transparent; color: var(--mcs-rarity); border: 1px solid var(--mcs-rarity); margin-left: 0; margin-right: 8px; }
.mcs-serial { color: #777; font-size: 10px; letter-spacing: .08em; margin: 8px 0 16px; text-transform: uppercase; overflow-wrap: anywhere; }
.mcs-line { height: 1px; background: #2a2a2a; margin: 12px 0 16px; }
.mcs-panel.live .mcs-line { background: #1a4a50; }
.mcs-term { font-size: 10.5px; line-height: 1.6; letter-spacing: .05em; color: #8fdfe6; white-space: pre-wrap; margin: -4px 0 10px; min-height: calc(1.6em * 4); }
.mcs-term .ok { color: var(--mcs-cyan); }
.mcs-term .err { color: var(--mcs-gold); }
.mcs-bonus { display: flex; align-items: center; gap: 12px; margin: 8px 0 16px; }
.mcs-coin { width: 36px; height: 36px; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--mcs-cyan); color: var(--mcs-cyan); font-size: 12px; transition: box-shadow .25s, background .25s, color .25s; }
.mcs-coin.hit { box-shadow: 0 0 0 3px rgba(240,180,41,.25), 0 0 18px rgba(240,180,41,.7); }
.mcs-coin.full { background: var(--mcs-gold); color: #000; border-color: var(--mcs-gold); }
.mcs-bonus b { font-family: var(--brand-font, 'Unbounded Variable', system-ui, sans-serif); color: var(--mcs-gold); font-size: 22px; font-weight: 400; font-variant-numeric: tabular-nums; display: inline-block; }
.mcs-bonus b.pop { animation: mcs-pop .16s ease-out; }
@keyframes mcs-pop { 40% { transform: scale(1.12); color: var(--mcs-gold-hi); } }
.mcs-lbl { display: block; color: #888; font-size: 10px; letter-spacing: .12em; }
.mcs-banner { background: var(--mcs-gold); color: #000; text-align: center; font-family: var(--brand-font, 'Unbounded Variable', system-ui, sans-serif); font-size: 12px; letter-spacing: .06em;
  padding: 12px 8px; margin-bottom: 12px; clip-path: inset(0 100% 0 0); transition: clip-path .55s cubic-bezier(.7,0,.2,1); }
.mcs-banner.in { clip-path: inset(0 0 0 0); }
.mcs-note { color: #888; font-size: 10px; letter-spacing: .1em; text-align: center; margin: 0 0 14px; min-height: 1.3em; }
.mcs-btn { display: flex; align-items: center; justify-content: center; gap: 10px; box-sizing: border-box; min-height: 48px; width: 100%;
  border: 0; border-radius: 0; cursor: pointer; text-decoration: none; font: 700 12px var(--brand-font, 'Unbounded Variable', system-ui, sans-serif); letter-spacing: .08em;
  background: var(--mcs-gold); color: #000; margin-top: 8px; position: relative; overflow: hidden; }
.mcs-btn.white { background: #fff; color: #000; }
.mcs-btn.pass { background: #00f0ff; color: #000; }
.mcs-btn.pass::before { content: ""; position: absolute; top: 0; bottom: 0; left: -45%; width: 35%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,.75), transparent); animation: mcs-glint 3.2s ease-in-out 1.2s infinite; }
@keyframes mcs-glint { 0% { left: -45%; } 35%, 100% { left: 110%; } }
.mcs-btn .arrow { font-family: var(--brand-font, 'Unbounded Variable', system-ui, sans-serif); font-size: 16px; }
.mcs-btn:active { transform: translateY(1px); }
.mcs-btn:disabled { cursor: progress; }
.mcs-btn:focus-visible { outline: 2px solid var(--mcs-cyan); outline-offset: 3px; }
.mcs-btn.busy { background: #061416; color: var(--mcs-cyan); border: 1px solid var(--mcs-cyan); font-family: var(--brand-font, 'Unbounded Variable', system-ui, sans-serif); letter-spacing: .2em; }
.mcs-btn.busy::after { content: ""; position: absolute; top: 0; bottom: 0; left: -40%; width: 40%;
  background: linear-gradient(90deg, transparent, rgba(61,240,255,.35), transparent); animation: mcs-sweep 1.1s linear infinite; }
@keyframes mcs-sweep { to { left: 100%; } }
.mcs .rv { opacity: 0; transform: translateY(8px); transition: opacity .45s ease, transform .5s cubic-bezier(.16,1,.3,1); }
.mcs .rv.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .mcs .rv, .mcs-panel, .mcs-banner { transition-duration: .01s; }
  .mcs-btn.busy::after, .mcs-btn.pass::before, .mcs-caret { animation: none; }
}
`;

const TEMPLATE = `
<canvas aria-hidden="true"></canvas>
<div class="mcs-hud">
  <section class="mcs-panel" data-el="unclaimed" hidden>
    <div class="mcs-kicker">AUTHENTIC<br>MONARCH ARTIFACT<br>UNCLAIMED</div>
    <div class="mcs-line"></div>
    <div class="mcs-title" data-el="titleA"></div>
    <div class="mcs-meta"><span data-el="metaA"></span><span class="mcs-badge" data-el="seasonBadge">SEASON EXCLUSIVE</span></div>
    <div class="mcs-serial" data-el="serial"></div>
    <div class="mcs-term" data-el="term" aria-live="polite" hidden></div>
    <button class="mcs-btn" data-el="claim" type="button">CLAIM ARTIFACT</button>
  </section>
  <section class="mcs-panel live" data-el="claimed" hidden>
    <div class="mcs-kicker"><span data-el="kick"></span><i class="mcs-caret"></i></div>
    <div class="mcs-title rv" data-at="120" data-el="titleB"></div>
    <div class="mcs-meta rv" data-at="240"><span class="mcs-badge tier" data-el="tierBadge"></span><span data-el="metaB"></span></div>
    <div class="mcs-line rv" data-at="340"></div>
    <div class="mcs-bonus rv" data-at="440">
      <div class="mcs-coin" data-el="coin">P</div>
      <div><b data-el="wngsB">+<span data-el="wngs">0</span> $WNGS</b><span class="mcs-lbl">ACTIVATION BONUS AWARDED</span></div>
    </div>
    <div class="mcs-banner" data-el="banner">PREMIUM TRACK UNLOCKED<br>ASCENSION ELEVATED</div>
    <p class="mcs-note" data-el="note"></p>
    <button class="mcs-btn white rv" data-el="closet" type="button">GO TO CLOSET</button>
    <button class="mcs-btn pass rv" data-el="pass" type="button">VIEW ASCENSION PASS <span class="arrow" aria-hidden="true">&#8594;</span></button>
  </section>
</div>
`;

// Extruded-P brand mark, from PLogo (410x410 viewBox) — the card back.
const P_OUTER = 'M252.8 61Q280.9 61 302.7 73.9Q324.6 86.8 336.9 109.3Q349.1 131.9 349.1 159.9L349.1 165.6Q349.1 193.6 336.9 216.3Q324.6 239.1 302.7 252Q280.9 264.9 252.8 264.9L180.7 264.9L180.7 362L84 362L84 61L252.8 61Z';
const P_COUNTER = 'M180.7 132.3L180.7 194.4L220.5 194.4Q235.8 194.4 243.4 186.6Q251.1 178.7 251.1 165.1L251.1 161.6Q251.1 147.6 243.4 140Q235.8 132.3 220.5 132.3Z';
const P_BRACKETS = 'M57 3 H407 V281 M3 129 V407 H353';
const LOGO = { accent: '#FFB000', face: '#FFFFFF', shadow: '#2a2a31' };

// Papillon clef mark, paths from the brand logo.svg (1929.64 x 1459.22):
// two dots on the centre line and a bass clef either side (the "wings").
const MARK_DOTS = 'M965.35,380.63c-53.21,1.58-99.94-37.36-100.16-97.49-.2-54.36,38.41-99.68,100.16-100.14,55.99-.42,98.03,40.8,99.26,97.88,1.22,56.35-42.99,101.52-99.27,99.75Z M966.46,439.05c47.18-2.32,98.18,37.36,98.17,98.68,0,55.27-41.86,99.73-99.63,98.75-60.67-1.03-99.14-42.83-99.9-97.4-.86-61.26,50.23-102.87,101.37-100.03Z';
const MARK_L = 'M236.74,262.16c4.24,.25,7.04-2.85,10.3-4.95,35.77-23.06,78.33-20.59,112.28,4.79,40.25,30.08,54.38,86.37,35.04,136.47-14.39,37.29-41.54,62.37-78.27,77.53-17.69,7.3-36.28,11.97-55.09,11.84-37.53-.26-71.65-11.49-100.36-36.96-28.13-24.95-43.88-56.5-51.22-92.84-11.23-55.55-1.27-108.45,21.14-159.34,23.73-53.88,60.05-98.07,107.56-132.82C284.89,31.68,337.56,12.12,394.65,3.7c29.15-4.3,58.57-4.72,87.59-1.92,48.25,4.66,94.63,17.27,137.57,40.86,66.42,36.48,115.74,89.41,149.97,156.48,21.05,41.23,34.11,85.05,39.19,131.26,3.15,28.68,5.46,57.46,3.87,86.17-2.65,48.19-11.14,95.48-25.31,141.79-27.17,88.79-71.22,168.99-123.39,245.11-37.17,54.23-77.54,106.01-120.45,155.83-30.53,35.45-61.47,70.51-93.43,104.72-23.31,24.95-46.07,50.49-69.42,75.41-70.8,75.55-143.47,149.3-217.8,221.35-30.3,29.37-61.18,58.3-93.28,85.83-13.53,11.6-28.74,14.4-45.38,11.63-16.21-2.71-27.3-20.35-23.7-36.76,1.96-8.91,6.27-16.77,11.15-24.44,17.42-27.41,37.62-52.79,57.51-78.36,57.5-73.89,115.36-147.49,173.21-221.11,48.68-61.95,96.29-124.71,142.59-188.46,55.87-76.92,109.09-155.58,153.83-239.6,32.46-60.96,59.52-124.21,76.27-191.5,8.52-34.21,13.5-68.98,13.22-104.18-.37-48.6-11.37-95.01-37.3-136.42-33.78-53.94-82.9-86.77-145.84-97.34-59.39-9.98-112.46,6.05-159.33,42.87-24.3,19.09-41.59,43.47-49.46,73.87-.44,1.72-1.16,3.41,.21,5.37Z';
const MARK_R = 'M1695.11,264.15c-3.87-22.28-12.68-40.21-25.49-56.03-31.54-38.96-73.39-60.6-122.15-68-76.02-11.54-139.34,14.6-190.01,70.76-29.32,32.5-44.49,72.67-51.91,115.55-10.35,59.8-1.62,118.08,14.96,175.64,20.57,71.42,52.55,137.82,89.39,202.03,52.52,91.52,113.86,177.08,177.14,261.33,54.59,72.67,110.97,143.95,167.02,215.48,47.73,60.91,95.63,121.69,141.96,183.68,9.97,13.33,19.6,26.96,27.71,41.55,5.95,10.71,8.2,21.92,3.05,33.67-5.14,11.73-13.86,18.21-26.95,19.23-16.72,1.3-30.31-3.95-43.08-15.07-82.91-72.22-159.38-151.09-236.49-229.24-33.47-33.93-65.79-69.06-98.59-103.68-31.86-33.64-63.52-67.51-94.03-102.36-35.26-40.27-70.04-80.95-103.23-123.02-37.15-47.08-71.74-95.89-102.59-147.23-36.79-61.24-65.49-126.16-84.5-195.23-15.29-55.58-21.92-112.14-19.43-169.67,4.56-105.31,40.12-197.82,115.47-273.1,53.73-53.67,119.21-85.11,194-95.75,92.53-13.17,179.85,2.43,257.42,56.57,75.73,52.85,123.95,124.99,138.04,216.96,7.33,47.83,3.27,95.62-23.74,138.08-25.55,40.17-61.92,64.11-109.97,69.79-41.07,4.85-77.82-6.27-110.35-30.22-45.3-33.36-64.26-94.2-43.97-145.77,16.74-42.55,57.05-69.78,101.87-68.7,16.18,.39,30.85,5.69,44.53,14.04,4.13,2.52,8.2,5.16,13.93,8.77Z';
const MARK_W = 1929.64, MARK_H = 1459.22, MARK_CX = 965;

const PIPS = ['#dc143c', '#ffb000', '#204a9e'];
const PIPS_GREY = ['#6b6b70', '#8c8c92', '#55555b'];
const MIN_VERIFY = 2.0; // seconds, so the tear never flashes past on a fast claim

type Particle = { x: number; y: number; vx: number; vy: number; life: number; age: number; r: number; hue: number };
type Shred = { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; a: number; crimp: boolean };
type Shock = { x: number; y: number; r: number; a: number; c: string; lag: number };
type Mote = { sx: number; sy: number; c1x: number; c1y: number; ex: number; ey: number; t0: number; dur: number; age: number; e: number };
type Fly = { x: number; y: number; vx: number; vy: number; ph: number; age: number; life: number };
type Sparkle = { x: number; y: number; age: number; life: number; r: number; gold: boolean };
type Pt = [number, number];

const OPEN = 0, SEALED = 1, VERIFY = 2, SMASH = 3, FLOAT = 4;

export function mountClaimSequence(root: HTMLElement, opts: ClaimEngineOptions): ClaimEngine {
  const { artifact } = opts;
  const TAG_ID = artifact.id.trim().toUpperCase().slice(0, 32);
  const NAME = artifact.name.toUpperCase();
  const TIER = artifact.tier.toUpperCase();
  const SET_LINE = `${(artifact.collection || 'GENERAL RELEASE').toUpperCase()} · ${(artifact.season || 'UNSPECIFIED').toUpperCase()}`;
  const RARITY = opts.rarityColor;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- DOM ----------
  if (!document.getElementById('mcs-style')) {
    const st = document.createElement('style'); st.id = 'mcs-style'; st.textContent = CSS; document.head.appendChild(st);
  }
  if (!document.getElementById('mcs-fonts')) {
    const ln = document.createElement('link'); ln.id = 'mcs-fonts'; ln.rel = 'stylesheet'; ln.href = FONT_HREF; document.head.appendChild(ln);
  }
  root.classList.add('mcs');
  root.style.setProperty('--mcs-rarity', RARITY);
  root.innerHTML = TEMPLATE;
  const q = <T extends HTMLElement>(name: string) => root.querySelector(`[data-el="${name}"]`) as T;
  const el = {
    unclaimed: q<HTMLElement>('unclaimed'), claimed: q<HTMLElement>('claimed'), term: q<HTMLElement>('term'),
    claim: q<HTMLButtonElement>('claim'), kick: q<HTMLElement>('kick'), coin: q<HTMLElement>('coin'),
    wngs: q<HTMLElement>('wngs'), wngsB: q<HTMLElement>('wngsB'), banner: q<HTMLElement>('banner'),
    note: q<HTMLElement>('note'), closet: q<HTMLButtonElement>('closet'), pass: q<HTMLButtonElement>('pass'),
  };
  q<HTMLElement>('titleA').textContent = NAME;
  q<HTMLElement>('titleB').textContent = NAME;
  q<HTMLElement>('metaA').textContent = SET_LINE;
  q<HTMLElement>('metaB').textContent = SET_LINE;
  q<HTMLElement>('tierBadge').textContent = TIER;
  q<HTMLElement>('serial').textContent = `SERIAL NUM: ${TAG_ID} · REGISTRY TIER: ${TIER}`;
  q<HTMLElement>('seasonBadge').hidden = !artifact.isSeasonArtifact;

  const cv = root.querySelector('canvas') as HTMLCanvasElement;
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
  const pOuter = new Path2D(P_OUTER), pCounter = new Path2D(P_COUNTER), pBrackets = new Path2D(P_BRACKETS);
  const mDots = new Path2D(MARK_DOTS), mL = new Path2D(MARK_L), mR = new Path2D(MARK_R);

  // ---------- state ----------
  let W = 1, H = 1, CX = 0, S = 1, dpr = 1;
  let state = OPEN, t = 0, openT = 0, smashT = 0, verifyT = 0;
  let color = 0, floatY = 0, rot = 0, shake = 0, flash = 0, pop = 1, rarityP = 0;
  let cardY = 0, targetY = 0, cardSc = 1, targetSc = 1;
  let tearP = 0, flipA = 0, resolved = false, failed = false, failMsg = '', claimedShown = false, sparkleT = 0;
  let outcome: ClaimOutcome = { awarded: 0, premiumUnlocked: false };
  let authReady = false, authed = false, retry = false;
  const IMPACT = { x: -0.44, y: -0.46 }; // where the tear starts: top-left
  let shards: Shred[] = [], dust: Particle[] = [], jag: number[] = [], shocks: Shock[] = [];
  let motes: Mote[] = [], flies: Fly[] = [], sparkles: Sparkle[] = [];
  let timers: number[] = [];
  let moteTotal = 0, moteArrived = 0, wngsTarget = 0;
  let raf = 0, alive = true;

  const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, RM ? Math.min(ms, 60) : ms)); };
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
  const easeInOut = (p: number) => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const easeOutBack = (p: number) => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };

  // 3:4 like the product grid; u = one CSS px of a 300px-wide product card.
  const cardSize = () => { const w = Math.min(240 * dpr, W * 0.62); return { w, h: w * 4 / 3, u: w / 300 }; };
  const scNow = () => cardSc * pop;
  const impactWorld = () => {
    const { w, h } = cardSize();
    return { x: CX + IMPACT.x * w * scNow(), y: cardY + floatY + IMPACT.y * h * scNow() };
  };

  // ---------- layout ----------
  function fitTo(panel: HTMLElement) {
    const r = panel.getBoundingClientRect();
    const offset = panel.classList.contains('show') && !panel.classList.contains('out') ? 0 : 28;
    const top = r.height ? (parseFloat(getComputedStyle(root.querySelector('.mcs-hud') as HTMLElement).paddingTop) || 14) + 30 : 0;
    const bottom = r.height ? r.top - root.getBoundingClientRect().top - offset - 18 : H / dpr;
    const cardHcss = (cardSize().h / dpr) * 1.1;
    targetSc = Math.max(.34, Math.min(1, (bottom - top) / cardHcss));
    targetY = ((top + bottom) / 2) * dpr;
  }
  function prefit() {
    const p = el.unclaimed, wasHidden = p.hidden;
    p.hidden = false; p.style.visibility = 'hidden';
    fitTo(p);
    p.hidden = wasHidden; p.style.visibility = '';
    cardY = targetY; cardSc = targetSc;
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.2);
    const r = root.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    cv.width = W; cv.height = H; S = Math.min(W, H) / 860; CX = W / 2;
    if (claimedShown) fitTo(el.claimed);
    else if (state < SMASH) prefit();
  }

  // ---------- effects ----------
  function puff(x: number, y: number, n: number, pwr: number, hue: number) {
    if (RM) n = Math.round(n / 4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (20 + Math.random() * pwr) * S;
      dust.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .4 + Math.random(), age: 0, r: (1 + Math.random() * 3) * S, hue });
    }
  }
  function makeJag() {
    jag = [];
    let v = 0;
    for (let k = 0; k <= 48; k++) {
      v = v * .45 + (Math.random() - .5) * 9;
      jag.push(v + (Math.random() < .12 ? (Math.random() - .5) * 16 : 0));
    }
  }
  function makeShreds() {
    shards = [];
    const { w, h, u } = cardSize();
    const sc = scNow(), n = RM ? 12 : 44;
    const L = Math.hypot(w, h), dx = w / L, dy = h / L;
    for (let i = 0; i < n; i++) {
      const lx = (Math.random() - .5) * (w + 28 * u), ly = (Math.random() - .5) * (h + 28 * u);
      const sp = (160 + Math.random() * 420) * S, spread = (Math.random() - .5) * 1.2;
      shards.push({
        x: CX + lx * sc, y: cardY + floatY + ly * sc,
        vx: (dx * Math.cos(spread) - dy * Math.sin(spread)) * sp,
        vy: (dy * Math.cos(spread) + dx * Math.sin(spread)) * sp - 120 * S,
        w: (6 + Math.random() * 12) * u * sc, h: (22 + Math.random() * 46) * u * sc,
        rot: Math.random() * 6, vr: (Math.random() - .5) * 9, a: 1, crimp: Math.random() < .3,
      });
    }
  }
  function spawnFlies() {
    if (RM) return;
    const ip = impactWorld();
    for (let i = 0; i < 3; i++) {
      flies.push({ x: ip.x, y: ip.y, vx: (i - 1) * 55 * S + (Math.random() - .5) * 30 * S, vy: -(70 + Math.random() * 60) * S, ph: Math.random() * 6, age: 0, life: 3.2 + Math.random() });
    }
  }

  // ---------- drawing ----------
  function setSpacing(px: number) {
    const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    if ('letterSpacing' in c) c.letterSpacing = px + 'px';
  }
  // Papillon clef mark; the two clefs flutter as wings. sc: 1 unit ~ 100px wide.
  function drawMark(sc: number, flap: number, sat: number) {
    const k = sc * 104 / MARK_W;
    ctx.save(); ctx.scale(k, k); ctx.translate(-MARK_CX, -MARK_H * .47);
    let fill: CanvasGradient;
    if (sat < .08) {
      fill = ctx.createLinearGradient(0, 150, 0, 1350);
      fill.addColorStop(0, '#f2f2f2'); fill.addColorStop(.5, '#a0a0a4'); fill.addColorStop(1, '#3a3a3e');
    } else {
      fill = ctx.createLinearGradient(300, 150, 1600, 1350);
      fill.addColorStop(0, '#fff4c8'); fill.addColorStop(.3, '#f0b429'); fill.addColorStop(.7, '#c47820'); fill.addColorStop(1, '#6a2e10');
    }
    ctx.fillStyle = fill;
    const f = Math.max(.18, Math.cos(Math.sin(flap) * .3));
    for (const path of [mL, mR]) {
      ctx.save(); ctx.translate(MARK_CX, 0); ctx.scale(f, 1); ctx.translate(-MARK_CX, 0);
      ctx.fill(path); ctx.restore();
    }
    ctx.fill(mDots);
    ctx.restore();
  }
  function drawLogo(size: number) {
    const k = size / 410;
    ctx.save(); ctx.scale(k, k); ctx.translate(-205, -205);
    ctx.strokeStyle = LOGO.accent; ctx.lineWidth = 6; ctx.stroke(pBrackets);
    ctx.save(); ctx.translate(23, -23); ctx.fillStyle = LOGO.accent; ctx.fill(pOuter); ctx.restore();
    ctx.fillStyle = LOGO.shadow;
    for (let o = 2; o <= 24; o += 2) { ctx.save(); ctx.translate(o, o); ctx.fill(pOuter); ctx.restore(); }
    ctx.fillStyle = LOGO.face; ctx.fill(pOuter);
    ctx.fillStyle = LOGO.shadow; ctx.fill(pCounter);
    ctx.restore();
  }
  // Trading-card silhouette: chamfered top-right + bottom-left corners.
  function chamfer(x: number, y: number, w: number, h: number, n: number) {
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w - n, y); ctx.lineTo(x + w, y + n);
    ctx.lineTo(x + w, y + h); ctx.lineTo(x + n, y + h); ctx.lineTo(x, y + h - n);
    ctx.closePath();
  }
  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function bezel(x: number, y: number, w: number, h: number, u: number) {
    chamfer(x, y, w, h, 22 * u);
    const bz = ctx.createLinearGradient(x, y, x + w, y + h);
    bz.addColorStop(0, '#f6f6fb'); bz.addColorStop(.46, '#c3c4d0'); bz.addColorStop(1, '#ededf3');
    ctx.fillStyle = bz; ctx.fill();
  }
  function fitText(text: string, maxW: number, px: number, u: number) {
    let size = px;
    ctx.font = `700 ${size * u}px ${FONT}`;
    while (size > 8 && ctx.measureText(text).width > maxW) { size -= .5; ctx.font = `700 ${size * u}px ${FONT}`; }
  }
  // The framed art window: iridescent studio backdrop + the mark.
  function art(sat: number, ax: number, ay: number, aw: number, ah: number, u: number, foil: number) {
    const g = ctx.createLinearGradient(ax, ay, ax + aw, ay + ah);
    if (sat) { g.addColorStop(0, '#cdc3f3'); g.addColorStop(.35, '#efd6ea'); g.addColorStop(.68, '#cfeee3'); g.addColorStop(1, '#b7c6f1'); }
    else { g.addColorStop(0, '#dadade'); g.addColorStop(.5, '#bfbfc5'); g.addColorStop(1, '#a3a3aa'); }
    ctx.fillStyle = g; ctx.fillRect(ax, ay, aw, ah);
    const blobs = sat
      ? ['rgba(255,255,255,.6)', 'rgba(186,168,255,.5)', 'rgba(150,238,214,.45)']
      : ['rgba(255,255,255,.45)', 'rgba(170,170,176,.4)', 'rgba(210,210,214,.4)'];
    blobs.forEach((c, k) => {
      const bx = ax + aw * (.3 + .4 * Math.sin(t * .3 + k * 2.1));
      const by = ay + ah * (.35 + .28 * Math.cos(t * .23 + k * 1.3));
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, aw * .6);
      rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(ax, ay, aw, ah);
    });

    ctx.save();
    ctx.translate(ax + aw / 2, ay + ah * .42);
    ctx.shadowColor = 'rgba(20,16,40,.28)'; ctx.shadowBlur = 18 * u; ctx.shadowOffsetY = 10 * u;
    drawMark(1.75 * u, t * (sat ? 3.4 : 2.8), sat);
    ctx.restore();

    if (foil > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'color-dodge'; ctx.globalAlpha = .2 * foil;
      const off = (Math.sin(t * .55) * .5 + .5) * aw * 1.4;
      const fg = ctx.createLinearGradient(ax - off, ay, ax - off + aw * 2.2, ay + ah * .8);
      const hues = [283, 2, 53, 93, 176, 228];
      for (let r = 0; r < 3; r++) hues.forEach((hu, k) => fg.addColorStop((r * 6 + k) / 18, `hsl(${hu},72%,58%)`));
      fg.addColorStop(1, 'hsl(283,72%,58%)');
      ctx.fillStyle = fg; ctx.fillRect(ax, ay, aw, ah);
      ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .32 * foil;
      const gx = ax + aw * (.5 + .38 * Math.sin(t * .55)), gy = ay + ah * (.4 + .2 * Math.cos(t * .42));
      const gl = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.hypot(aw, ah) * .8);
      gl.addColorStop(.05, 'rgba(255,255,255,.75)'); gl.addColorStop(.3, 'rgba(255,255,255,.15)'); gl.addColorStop(.9, 'rgba(0,0,0,.25)');
      ctx.fillStyle = gl; ctx.fillRect(ax, ay, aw, ah);
      ctx.restore();
    }

    ctx.fillStyle = '#101014';
    ctx.beginPath(); ctx.moveTo(ax + aw, ay + ah - 22 * u); ctx.lineTo(ax + aw, ay + ah); ctx.lineTo(ax + aw - 22 * u, ay + ah); ctx.fill();

    const nh = 74 * u;
    const ng = ctx.createLinearGradient(0, ay + ah - nh, 0, ay + ah);
    ng.addColorStop(0, 'rgba(9,9,13,0)'); ng.addColorStop(.38, 'rgba(9,9,13,.62)'); ng.addColorStop(1, 'rgba(9,9,13,.9)');
    ctx.fillStyle = ng; ctx.fillRect(ax, ay + ah - nh, aw, nh);
    ctx.fillStyle = '#f4f2ec'; ctx.textAlign = 'center';
    setSpacing(.78 * u);
    fitText(NAME, aw - 52 * u, 13, u);
    ctx.fillText(NAME, ax + aw / 2, ay + ah - 30 * u);
    fitText(TAG_ID, aw - 52 * u, 13, u);
    ctx.fillText(TAG_ID, ax + aw / 2, ay + ah - 12 * u);
    setSpacing(0);
  }
  function face(sat: number, glowAmt: number) {
    const { w, h, u } = cardSize();
    const x = -w / 2, y = -h / 2, inset = 6 * u;
    ctx.save();
    if (glowAmt > 0) { ctx.shadowColor = sat ? RARITY : 'rgba(210,210,220,.25)'; ctx.shadowBlur = glowAmt * u; }
    bezel(x, y, w, h, u);
    ctx.restore();

    const ax = x + inset, ay = y + inset, aw = w - inset * 2, ah = h - inset * 2;
    ctx.save(); chamfer(ax, ay, aw, ah, 15 * u); ctx.clip();
    art(sat, ax, ay, aw, ah, u, sat ? rarityP : 0);
    ctx.restore();

    const pw = 13 * u, ph = 47 * u, px = x + w - 9 * u - pw, py = y + h * .15;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6 * u; ctx.shadowOffsetY = 2 * u;
    ctx.fillStyle = '#131319'; roundRect(px, py, pw, ph, 4 * u); ctx.fill();
    ctx.restore();
    (sat ? PIPS : PIPS_GREY).forEach((c, k) => { ctx.fillStyle = c; ctx.fillRect(px + 3 * u, py + 4 * u + k * 14 * u, 7 * u, 11 * u); });

    // rarity edge + chamfer brackets (the product card's hover state)
    if (sat && rarityP > 0) {
      ctx.save(); chamfer(x, y, w, h, 22 * u); ctx.clip();
      ctx.fillStyle = RARITY;
      const e = 7 * u * rarityP, b = 34 * u, bt = 4 * u * rarityP;
      ctx.fillRect(x, y, w, e); ctx.fillRect(x, y, e, h);
      ctx.fillRect(x + w - b, y, b, bt); ctx.fillRect(x + w - bt, y, bt, b);
      ctx.fillRect(x, y + h - bt, b, bt); ctx.fillRect(x, y + h - b, bt, b);
      ctx.restore();
    }
  }
  // Card back: same silhouette and bezel, dark field, [ P ] mark.
  function back() {
    const { w, h, u } = cardSize();
    const x = -w / 2, y = -h / 2, inset = 6 * u;
    ctx.save();
    ctx.shadowColor = 'rgba(255,176,0,.25)'; ctx.shadowBlur = 22 * u;
    bezel(x, y, w, h, u);
    ctx.restore();
    const ax = x + inset, ay = y + inset, aw = w - inset * 2, ah = h - inset * 2;
    ctx.save(); chamfer(ax, ay, aw, ah, 15 * u); ctx.clip();
    const g = ctx.createLinearGradient(ax, ay, ax + aw, ay + ah);
    g.addColorStop(0, '#1b1b21'); g.addColorStop(1, '#09090c');
    ctx.fillStyle = g; ctx.fillRect(ax, ay, aw, ah);
    ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 1 * u;
    for (let gx = ax + 24 * u; gx < ax + aw; gx += 24 * u) { ctx.beginPath(); ctx.moveTo(gx, ay); ctx.lineTo(gx, ay + ah); ctx.stroke(); }
    for (let gy = ay + 24 * u; gy < ay + ah; gy += 24 * u) { ctx.beginPath(); ctx.moveTo(ax, gy); ctx.lineTo(ax + aw, gy); ctx.stroke(); }
    ctx.save(); ctx.translate(0, ay + ah * .42); drawLogo(aw * .56); ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4f2ec'; ctx.font = `800 ${17 * u}px ${FONT}`;
    setSpacing(5 * u); ctx.fillText('PAPILLON', 2.5 * u, ay + ah - 42 * u);
    ctx.fillStyle = '#8a8a92'; ctx.font = `${9 * u}px ${FONT}`;
    setSpacing(1.6 * u); ctx.fillText(SET_LINE, .8 * u, ay + ah - 24 * u);
    setSpacing(0);
    ctx.fillStyle = LOGO.accent;
    ctx.beginPath(); ctx.moveTo(ax + aw, ay + ah - 22 * u); ctx.lineTo(ax + aw, ay + ah); ctx.lineTo(ax + aw - 22 * u, ay + ah); ctx.fill();
    ctx.restore();
  }
  // Clear foil sleeve with crimped seals.
  function sleeveBody(x0: number, y0: number, bw: number, bh: number, u: number) {
    ctx.fillStyle = 'rgba(206,216,234,.11)'; ctx.fillRect(x0, y0, bw, bh);
    const off = ((t * .18) % 1) * (bw + bh);
    const sh = ctx.createLinearGradient(x0 - bh + off - bw, y0, x0 + off, y0 + bh);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.45, 'rgba(255,255,255,.2)');
    sh.addColorStop(.5, 'rgba(210,240,255,.34)'); sh.addColorStop(.55, 'rgba(255,255,255,.2)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.fillRect(x0, y0, bw, bh);
    const ch = 17 * u, tooth = 7 * u;
    const crimp = (yy: number, dir: number) => {
      const cg = ctx.createLinearGradient(0, yy, 0, yy + ch * dir);
      cg.addColorStop(0, 'rgba(236,240,248,.8)'); cg.addColorStop(1, 'rgba(176,184,200,.7)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.moveTo(x0, yy + ch * dir);
      for (let xx = x0; xx <= x0 + bw + .1; xx += tooth) ctx.lineTo(xx, yy + ((Math.round((xx - x0) / tooth) % 2) ? 3 * u * dir : 0));
      ctx.lineTo(x0 + bw, yy + ch * dir); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(90,96,110,.35)'; ctx.lineWidth = 1 * u;
      for (let i = 1; i <= 3; i++) { const ly = yy + (4 + i * 3.2) * u * dir; ctx.beginPath(); ctx.moveTo(x0, ly); ctx.lineTo(x0 + bw, ly); ctx.stroke(); }
    };
    crimp(y0, 1); crimp(y0 + bh, -1);
    ctx.fillStyle = 'rgba(20,22,30,.75)'; ctx.textAlign = 'center';
    ctx.font = `700 ${7.5 * u}px ${FONT}`; setSpacing(1.2 * u);
    ctx.fillText('SEALED · ' + TAG_ID + ' · TEAR TO CLAIM', x0 + bw / 2, y0 + bh - 6.5 * u);
    setSpacing(0);
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.moveTo(x0 + 6 * u, y0 + ch); ctx.lineTo(x0 + 6 * u, y0 + bh - ch); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + bw - 6 * u, y0 + ch); ctx.lineTo(x0 + bw - 6 * u, y0 + bh - ch); ctx.stroke();
  }
  // The sleeve tears along the diagonal from the top-left; the torn flap
  // is the band just behind the tear front, mirrored across it.
  function drawSleeve() {
    const { w, h, u } = cardSize();
    const m = 14 * u, x0 = -w / 2 - m, y0 = -h / 2 - m, bw = w + m * 2, bh = h + m * 2;
    const L = Math.hypot(bw, bh), dx = bw / L, dy = bh / L, qx = -dy, qy = dx;
    const pf = tearP * L * 1.06 - 6 * u;
    const pt = (p: number, s: number): Pt => [x0 + dx * p + qx * s, y0 + dy * p + qy * s];
    const line = jag.map((j, k) => pt(pf + j * u * Math.min(1, tearP * 6), -L * .8 + (k / (jag.length - 1)) * L * 1.6));
    const trace = (pts: Pt[]) => { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
    const box = () => { ctx.beginPath(); ctx.rect(x0, y0, bw, bh); ctx.clip(); };
    const sEnd = L * .8;
    const torn = tearP > 0 && line.length > 1;
    const c = Math.min(32 * u, Math.max(6 * u, pf * .35));

    ctx.save(); box();
    if (torn) {
      ctx.beginPath(); trace(line);
      const a = pt(pf + L * 2, sEnd), b = pt(pf + L * 2, -sEnd);
      ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.clip();
    }
    sleeveBody(x0, y0, bw, bh, u);
    ctx.strokeStyle = state === VERIFY ? `rgba(61,240,255,${.5 + .25 * Math.sin(t * 8)})` : 'rgba(225,238,255,.5)';
    ctx.lineWidth = 2 * u; ctx.strokeRect(x0, y0, bw, bh);
    if (torn) {
      const [g0x, g0y] = pt(pf, 0), [g1x, g1y] = pt(pf + c * 1.3, 0);
      const shd = ctx.createLinearGradient(g0x, g0y, g1x, g1y);
      shd.addColorStop(0, 'rgba(0,0,0,.32)'); shd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shd; ctx.fillRect(x0, y0, bw, bh);
    }
    ctx.restore();

    if (!torn) {
      ctx.fillStyle = 'rgba(0,0,0,.85)';
      ctx.beginPath(); ctx.moveTo(x0, y0 + 20 * u); ctx.lineTo(x0 + 6 * u, y0 + 24 * u); ctx.lineTo(x0, y0 + 28 * u); ctx.fill();
      return;
    }

    ctx.save(); box();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.8 * u;
    ctx.beginPath(); trace(line); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 4 * u;
    ctx.beginPath(); trace(line); ctx.stroke();
    ctx.restore();

    const [p0x, p0y] = pt(pf, 0), nP = dx * p0x + dy * p0y;
    ctx.save();
    ctx.transform(1 - 2 * dx * dx, -2 * dx * dy, -2 * dx * dy, 1 - 2 * dy * dy, 2 * dx * nP, 2 * dy * nP);
    box();
    ctx.beginPath(); trace(line);
    const a = pt(pf - c, sEnd), b = pt(pf - c, -sEnd);
    ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.clip();
    const [f1x, f1y] = pt(pf - c, 0);
    const fg = ctx.createLinearGradient(p0x, p0y, f1x, f1y);
    fg.addColorStop(0, 'rgba(250,252,255,.78)'); fg.addColorStop(.55, 'rgba(206,214,228,.55)'); fg.addColorStop(1, 'rgba(150,160,178,.4)');
    ctx.fillStyle = fg; ctx.fillRect(x0, y0, bw, bh);
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.6 * u;
    ctx.beginPath(); trace(line); ctx.stroke();
    ctx.restore();
  }
  function drawCard() {
    const { w, h, u } = cardSize();
    ctx.save();
    ctx.translate(CX, cardY + floatY); ctx.rotate(rot); ctx.scale(scNow(), scNow());

    // turning over: squash on X, lift a touch at the edge-on moment
    const turn = Math.sin(flipA), lift = 1 + .07 * turn;
    ctx.save();
    ctx.scale(Math.max(.02, Math.abs(Math.cos(flipA))) * lift, lift);
    if (flipA < Math.PI / 2) back();
    else if (color <= 0) face(0, 22);
    else if (color >= 1) face(1, 34 + Math.sin(t * 2) * 12);
    else {
      face(0, 22);
      const ix = IMPACT.x * w, iy = IMPACT.y * h, R = easeOut(color) * Math.hypot(w, h) * 1.2;
      ctx.save(); ctx.beginPath(); ctx.arc(ix, iy, R, 0, Math.PI * 2); ctx.clip();
      face(1, 0);
      ctx.restore();
      ctx.save(); chamfer(-w / 2, -h / 2, w, h, 22 * u); ctx.clip();
      ctx.globalAlpha = 1 - color; ctx.strokeStyle = RARITY; ctx.lineWidth = 4 * u;
      ctx.beginPath(); ctx.arc(ix, iy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (turn > .01) {
      ctx.save(); chamfer(-w / 2, -h / 2, w, h, 22 * u); ctx.clip();
      ctx.fillStyle = `rgba(0,0,0,${.45 * turn})`; ctx.fillRect(-w / 2, -h / 2, w, h);
      const gx = -w / 2 + (flipA / Math.PI) * w * 1.4 - w * .2;
      const gl = ctx.createLinearGradient(gx - 40 * u, 0, gx + 40 * u, 0);
      gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(.5, `rgba(255,255,255,${.35 * turn})`); gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.restore();

    if (state === OPEN || state === SEALED || state === VERIFY) drawSleeve();
    ctx.restore();
  }
  function star4(x: number, y: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
  }

  // ---------- flow ----------
  function showUnclaimed() {
    el.unclaimed.hidden = false;
    requestAnimationFrame(() => el.unclaimed.classList.add('show'));
  }
  function refreshClaimButton() {
    if (state !== SEALED) return;
    const b = el.claim;
    b.disabled = !authReady;
    b.textContent = !authReady ? 'CONNECTING...' : !authed ? 'AUTHENTICATE TO CLAIM' : retry ? 'RETRY CLAIM' : 'CLAIM ARTIFACT';
  }
  type Line = [string, string, string?];
  const termLines = (): Line[] => [
    ['> NFC SIGNATURE ........ ', 'READ'],
    ['> REGISTRY ' + TAG_ID.padEnd(12, '.') + ' ', 'MATCH'],
    ['> TIER ' + '.'.repeat(17) + ' ', TIER],
    ['> BINDING TO PASSPORT .. ', 'OK'],
  ];
  function termWrite(lines: Line[], doneCount: number) {
    el.term.replaceChildren();
    lines.forEach((l, i) => {
      const row = document.createElement('div');
      row.append(l[0]);
      if (i < doneCount) { const s = document.createElement('span'); s.className = l[2] || 'ok'; s.textContent = l[1]; row.append(s); }
      el.term.append(row);
    });
  }
  function startClaim(claim: Promise<ClaimOutcome>) {
    if (state !== SEALED) return;
    state = VERIFY; verifyT = 0; tearP = 0; resolved = false; failed = false; failMsg = '';
    makeJag();
    el.claim.classList.add('busy'); el.claim.disabled = true; el.claim.textContent = 'VERIFYING';
    el.unclaimed.classList.add('verifying');
    el.term.hidden = false;
    fitTo(el.unclaimed);
    const lines = termLines(), shown: Line[] = [];
    lines.forEach((l, i) => later(() => {
      if (state !== VERIFY || failed) return;
      shown.push(l); termWrite(shown, i < 3 ? shown.length : shown.length - 1);
      buzz(8);
    }, 120 + i * 380));
    claim.then(
      res => { outcome = res; resolved = true; },
      err => { failMsg = (err instanceof Error && err.message) || 'CLAIM FAILED · SYSTEM ERROR'; failed = true; },
    );
    buzz([12, 30, 12]);
  }
  function claimFailed() {
    state = SEALED; retry = true;
    el.claim.classList.remove('busy');
    el.unclaimed.classList.remove('verifying');
    const lines = termLines().slice(0, 3);
    lines.push(['> ' + failMsg + ' ', '', 'err']);
    termWrite(lines, 4);
    refreshClaimButton();
  }
  function smash() {
    state = SMASH; smashT = 0; flipA = Math.PI; tearP = 1;
    termWrite(termLines(), 4);
    const ip = impactWorld();
    makeShreds(); spawnFlies();
    puff(ip.x, ip.y, 120, 380, 1); puff(ip.x, ip.y, 70, 240, 0);
    shocks.push({ x: ip.x, y: ip.y, r: 0, a: 1, c: '0,240,255', lag: 0 }, { x: ip.x, y: ip.y, r: 0, a: .8, c: '240,180,41', lag: .08 });
    later(() => el.unclaimed.classList.add('out'), 60);
    later(() => { el.unclaimed.hidden = true; }, 420);
    buzz([30, 20, 90]);
  }
  function typeText(target: HTMLElement, text: string, cps: number) {
    target.textContent = '';
    if (RM) { target.textContent = text; return; }
    [...text].forEach((ch, i) => later(() => { target.textContent += ch; }, i * (1000 / cps)));
  }
  function showClaimed() {
    claimedShown = true;
    el.claimed.hidden = false;
    el.banner.hidden = !outcome.premiumUnlocked;
    fitTo(el.claimed);
    requestAnimationFrame(() => el.claimed.classList.add('show'));
    typeText(el.kick, 'ARTIFACT ACTIVATED', 34);
    el.claimed.querySelectorAll<HTMLElement>('.rv[data-at]').forEach(n => later(() => n.classList.add('in'), Number(n.dataset.at)));
    later(() => startMotes(outcome.awarded), 620);
  }
  function setCounter(v: number) {
    el.wngs.textContent = String(v);
    el.wngsB.classList.remove('pop'); void el.wngsB.offsetWidth; el.wngsB.classList.add('pop');
  }
  function startMotes(total: number) {
    wngsTarget = total; moteArrived = 0;
    moteTotal = RM || total <= 0 ? 0 : Math.min(36, Math.max(12, total));
    if (!moteTotal) { setCounter(total); motesDone(); return; }
    const cy = cardY + floatY, sc = scNow(), { w, h } = cardSize();
    for (let i = 0; i < moteTotal; i++) {
      const sx = CX + (Math.random() - .5) * w * .5 * sc, sy = cy + (Math.random() - .5) * h * .5 * sc;
      motes.push({ sx, sy, c1x: sx + (Math.random() - .5) * 520 * S, c1y: sy - (60 + Math.random() * 220) * S, ex: 0, ey: 0, t0: i * .026 + Math.random() * .05, dur: .6 + Math.random() * .35, age: 0, e: -1 });
    }
  }
  function motesDone() {
    el.coin.classList.add('full', 'hit');
    later(() => el.coin.classList.remove('hit'), 380);
    buzz([20, 40, 20]);
    const bannerDelay = el.banner.hidden ? 0 : 260;
    if (!el.banner.hidden) later(() => el.banner.classList.add('in'), bannerDelay);
    later(() => typeText(el.note, 'THIS PIECE HAS BEEN LOGGED TO YOUR CLOSET.', 55), bannerDelay + 440);
    later(() => el.closet.classList.add('in'), bannerDelay + 990);
    later(() => el.pass.classList.add('in'), bannerDelay + 1140);
  }

  // ---------- main loop ----------
  let last = performance.now();
  function loop(now: number) {
    if (!alive) return;
    let dt = (now - last) / 1000; last = now; if (dt > .05) dt = .05; t += dt;

    if (state === OPEN) {
      openT += dt;
      pop = .6 + .4 * easeOutBack(clamp01(openT / .5));
      flash = RM ? 0 : Math.max(0, .6 - openT * 1.8);
      shake = RM ? 0 : Math.max(0, 6 * S * (1 - openT / .6));
      if (openT > .7) { state = SEALED; pop = 1; showUnclaimed(); refreshClaimButton(); }
    }
    if (state === SEALED || state === VERIFY) { floatY = Math.sin(t * 1.3) * 3 * S; rot = Math.sin(t * .8) * 0.015; color = 0; }
    if (state === VERIFY) {
      verifyT += dt;
      if (failed) {
        tearP = Math.max(0, tearP - dt * 1.4);
        if (tearP <= 0) claimFailed();
      } else {
        const go = resolved && verifyT >= MIN_VERIFY;
        // rip steadily toward 80% while the server works, then finish it
        tearP = go ? tearP + dt * 1.5 : Math.min(.8, tearP + dt * .42);
        shake = RM ? 0 : (go ? 2.5 * S : 0);
        if (go && tearP >= 1) smash();
      }
      if (state === VERIFY || state === SEALED) flipA = Math.PI * easeInOut(clamp01(tearP / .8));
    }
    if (state === SMASH) {
      smashT += dt;
      color = clamp01(smashT / .8);
      rarityP = easeOut(clamp01((smashT - .45) / .5));
      flash = RM ? 0 : Math.max(0, .4 - smashT * 1.6);
      shake = RM ? 0 : Math.max(0, 12 * S * (1 - smashT / .5));
      floatY = Math.sin(t * 1.6) * 6 * S;
      rot = Math.sin(t * 1.1) * 0.04;
      if (smashT > .5 && !claimedShown) showClaimed();
      if (smashT > 1.2) state = FLOAT;
    }
    if (state === FLOAT) {
      color = 1; rarityP = 1; floatY = Math.sin(t * 1.5) * 7 * S; rot = Math.sin(t * 1.05) * 0.045;
      sparkleT -= dt;
      if (sparkleT <= 0 && !RM) {
        sparkleT = .12 + Math.random() * .2;
        const { w, h } = cardSize(), a = Math.random() * Math.PI * 2, sc = scNow();
        sparkles.push({ x: CX + Math.cos(a) * w * .62 * sc, y: cardY + floatY + Math.sin(a) * h * .56 * sc, age: 0, life: .8 + Math.random() * .5, r: (4 + Math.random() * 6) * S, gold: Math.random() < .55 });
      }
    }
    if (state >= SEALED) {
      cardY += (targetY - cardY) * Math.min(1, dt * 3.2);
      cardSc += (targetSc - cardSc) * Math.min(1, dt * 3.2);
    }

    for (let i = dust.length - 1; i >= 0; i--) { const p = dust[i]; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.age >= p.life) dust.splice(i, 1); }
    for (let i = shards.length - 1; i >= 0; i--) { const s = shards[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 380 * S * dt; s.vx *= 1 - dt * .8; s.rot += s.vr * dt; s.a -= dt * .6; if (s.a <= 0) shards.splice(i, 1); }
    for (let i = shocks.length - 1; i >= 0; i--) { const k = shocks[i]; if (k.lag > 0) { k.lag -= dt; continue; } k.r += 1100 * S * dt; k.a -= dt * 1.5; if (k.a <= 0) shocks.splice(i, 1); }
    for (let i = flies.length - 1; i >= 0; i--) { const f = flies[i]; f.age += dt; f.x += f.vx * dt + Math.sin(f.age * 3 + f.ph) * 40 * S * dt; f.y += f.vy * dt; if (f.age >= f.life) flies.splice(i, 1); }
    for (let i = sparkles.length - 1; i >= 0; i--) { const s = sparkles[i]; s.age += dt; if (s.age >= s.life) sparkles.splice(i, 1); }

    if (motes.length) {
      const r = el.coin.getBoundingClientRect(), rr = root.getBoundingClientRect();
      const ex = (r.left - rr.left + r.width / 2) * dpr, ey = (r.top - rr.top + r.height / 2) * dpr;
      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i]; m.age += dt;
        const p = (m.age - m.t0) / m.dur;
        m.e = p <= 0 ? -1 : easeInOut(Math.min(1, p)); m.ex = ex; m.ey = ey;
        if (p >= 1) {
          motes.splice(i, 1); moteArrived++;
          setCounter(Math.round(wngsTarget * moteArrived / moteTotal));
          if (moteArrived % 6 === 0) { el.coin.classList.add('hit'); later(() => el.coin.classList.remove('hit'), 120); }
          if (moteArrived === moteTotal) motesDone();
        }
      }
    }

    // ---- render ----
    const cx = shake ? (Math.random() - .5) * shake : 0, cy = shake ? (Math.random() - .5) * shake * .5 : 0;
    ctx.setTransform(1, 0, 0, 1, cx, cy);
    ctx.fillStyle = '#000'; ctx.fillRect(-20, -20, W + 40, H + 40);
    if (state >= SMASH) {
      const neb = ctx.createRadialGradient(CX, cardY, 10, CX, cardY, Math.max(W, H) * .7);
      neb.addColorStop(0, `rgba(20,40,70,${0.35 * color})`); neb.addColorStop(1, '#000');
      ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(200,230,255,${(0.15 + (Math.sin(t + i) * .5 + .5) * .35) * color})`;
        ctx.fillRect((i * 97) % W, (i * 53) % (H * 0.7), 1.5 * S, 1.5 * S);
      }
    }
    drawCard();
    for (const k of shocks) {
      if (k.lag > 0) continue;
      ctx.strokeStyle = `rgba(${k.c},${Math.max(0, k.a)})`; ctx.lineWidth = 3 * S;
      ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (const s of shards) {
      ctx.save(); ctx.globalAlpha = Math.max(0, s.a);
      ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      ctx.fillStyle = s.crimp ? 'rgba(226,232,244,.9)' : 'rgba(214,224,240,.6)'; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-s.w / 2, -s.h / 2); ctx.lineTo(s.w / 2, -s.h / 2 + s.w * .4); ctx.lineTo(s.w / 3, s.h / 2); ctx.lineTo(-s.w / 2, s.h / 2 - s.w * .6); ctx.closePath();
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
    for (const p of dust) {
      const a = 1 - p.age / p.life;
      ctx.fillStyle = p.hue === 1 ? `rgba(61,240,255,${a})` : `rgba(240,180,41,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    for (const f of flies) {
      ctx.save(); ctx.globalAlpha = Math.min(1, f.age * 3) * (1 - f.age / f.life); ctx.translate(f.x, f.y);
      drawMark(.34 * S, t * 11 + f.ph, 1); ctx.restore();
    }
    for (const s of sparkles) {
      const a = Math.sin((s.age / s.life) * Math.PI);
      ctx.fillStyle = s.gold ? `rgba(255,214,110,${a})` : `rgba(160,250,255,${a})`;
      star4(s.x, s.y, s.r * a);
    }
    if (motes.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const m of motes) {
        if (m.e < 0) continue;
        for (let k = 0; k < 3; k++) {
          const e = Math.max(0, m.e - k * .035), v = 1 - e;
          const x = v * v * m.sx + 2 * v * e * m.c1x + e * e * m.ex;
          const y = v * v * m.sy + 2 * v * e * m.c1y + e * e * m.ey;
          ctx.fillStyle = `rgba(255,200,80,${k ? .25 / k : .95})`;
          ctx.beginPath(); ctx.arc(x, y, (k ? 2.2 : 3) * S, 0, Math.PI * 2); ctx.fill();
          if (!k) { ctx.fillStyle = 'rgba(240,180,41,.18)'; ctx.beginPath(); ctx.arc(x, y, 8 * S, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      ctx.restore();
    }
    if (flash > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(255,255,255,${flash * .7})`; ctx.fillRect(0, 0, W, H); }
    raf = requestAnimationFrame(loop);
  }

  // ---------- wiring ----------
  const onClaimClick = () => { if (state === SEALED && authReady) opts.onPress(); };
  const onCloset = () => opts.onCloset();
  const onPass = () => opts.onAscension();
  el.claim.addEventListener('click', onClaimClick);
  el.closet.addEventListener('click', onCloset);
  el.pass.addEventListener('click', onPass);
  window.addEventListener('resize', resize);

  resize();
  puff(CX, cardY, 90, 280, 0);
  buzz([18, 20, 70]);
  raf = requestAnimationFrame(loop);

  return {
    begin: startClaim,
    setAuthState(ready, authenticated) { authReady = ready; authed = authenticated; refreshClaimButton(); },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout); timers = [];
      window.removeEventListener('resize', resize);
      el.claim.removeEventListener('click', onClaimClick);
      el.closet.removeEventListener('click', onCloset);
      el.pass.removeEventListener('click', onPass);
      root.replaceChildren();
      root.classList.remove('mcs');
    },
  };
}
