import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------
   Shared reveal observer.
   - reveals while scrolling down AND re-arms while scrolling up
   - direction aware (comes from above when returning from above)
   - never leaves content invisible if IntersectionObserver is missing
   ------------------------------------------------------------------ */

const motionFull = () =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('motion-full');

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  !motionFull();

export function isReducedMotion() {
  return reduced();
}

let observer = null;
const wired = new WeakSet();
const fallbacks = new WeakMap();

/* If the observer never delivers (throttled tab, bfcache resume, a browser
   quirk), the element must not stay invisible forever. One timer per element:
   it only reveals what is actually on screen, and it is cancelled as soon as
   the observer reports the element. */
function armFallback(el) {
  if (fallbacks.has(el)) return;
  const id = setTimeout(() => {
    fallbacks.delete(el);
    if (!el.isConnected || el.classList.contains('in')) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) el.classList.add('in');
  }, 1400);
  fallbacks.set(el, id);
}

function clearFallback(el) {
  const id = fallbacks.get(el);
  if (id) clearTimeout(id);
  fallbacks.delete(el);
}

function ensureObserver() {
  if (observer) return observer;
  if (typeof IntersectionObserver === 'undefined') return null;

  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target;
      if (!el.isConnected) continue;

      clearFallback(el);

      if (entry.isIntersecting) {
        el.classList.add('in');
        continue;
      }

      // only re-arm once the element is fully outside the viewport,
      // otherwise the card flickers at the edge
      const rect = entry.boundingClientRect;
      const fullyOut = rect.bottom <= 0 || rect.top >= window.innerHeight;
      if (!fullyOut) continue;
      if (el.dataset.revealOnce !== undefined) continue;

      el.style.setProperty('--ry', rect.top < 0 ? '-16px' : '16px');
      el.classList.remove('in');
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

  return observer;
}

export function registerReveal(el) {
  if (!el || wired.has(el)) return;
  wired.add(el);

  if (reduced() || !ensureObserver()) {
    el.classList.add('in');
    return;
  }
  observer.observe(el);
  armFallback(el);
}

export function unregisterReveal(el) {
  if (!el || !wired.has(el)) return;
  wired.delete(el);
  clearFallback(el);
  if (observer) observer.unobserve(el);
}

/* ------------------------------------------------------------------ */

export function usePrefersReducedMotion() {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setValue(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return value;
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/* The original site offered a "حركة كاملة / حركة مخففة" switch to anyone
   whose system asks for reduced motion. Same behaviour here.

   The switch appears in the topbar and on the profile page, so both copies
   share one state instead of drifting apart. */
const motionSubs = new Set();
let motionFallback = false;

/* 'full' | 'auto' when the visitor picked one, otherwise null (no choice yet). */
export function readMotionSaved() {
  try {
    const saved = localStorage.getItem('lam_motion');
    if (saved === 'full' || saved === 'auto') return saved;
  } catch { /* private mode */ }
  return null;
}

function readMotion() {
  const saved = readMotionSaved();
  if (saved) return saved === 'full';
  return true;
}

/* One place that decides how much motion a route gets.
   Motion is part of the product, so the landing AND the app start with the
   full-motion version. A visitor whose system asks for less is not silently
   downgraded to a still page: they get the «حركة كاملة / حركة مخففة» switch
   and their explicit choice is what turns motion off (`lam_motion = auto`).
   Without this the whole app inherited the OS setting, which killed every
   transition — the sidebar closed in a single frame and the content jumped. */
export function applyMotionPreference() {
  if (typeof document === 'undefined') return;
  const full = readMotionSaved() !== 'auto';
  const root = document.documentElement;
  root.classList.toggle('motion-full', full);
  // `motion-ready` is what arms the reveal/entrance animations. Without it
  // everything stays visible but static.
  root.classList.toggle('motion-ready', true);
}

export function setMotionFull(next) {
  motionFallback = !!next;
  try { localStorage.setItem('lam_motion', next ? 'full' : 'auto'); } catch { /* ignore */ }
  document.documentElement.classList.toggle('motion-full', !!next);
  // turning full motion on must also arm the reveal animations
  if (next) document.documentElement.classList.add('motion-ready');
  motionSubs.forEach((fn) => fn(!!next));
}

export function useMotionMode() {
  const prefersReduced = usePrefersReducedMotion();
  const [full, setFull] = useState(readMotion);

  useEffect(() => {
    motionSubs.add(setFull);
    return () => { motionSubs.delete(setFull); };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('motion-full', full);
  }, [full]);

  const toggle = () => setMotionFull(!readMotion());

  return { prefersReduced, full, toggle, effectiveReduced: prefersReduced && !full };
}
/* ------------------------------------------------------------------
   <Reveal> — one element with an optional stagger delay
   ------------------------------------------------------------------ */
export function Reveal({
  as: Tag = 'div',
  className = '',
  delay = 0,
  once = false,
  children,
  style,
  ...rest
}) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.style.setProperty('--d', `${Math.max(0, delay)}ms`);
    if (once) el.dataset.revealOnce = '';
    registerReveal(el);
    return () => unregisterReveal(el);
  }, [delay, once]);

  return (
    <Tag ref={ref} className={`reveal ${className}`.trim()} style={style} {...rest}>
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------
   useRevealGroup — for pages that already render `.reveal` elements
   (landing). Finds them after mount and staggers by DOM order.
   ------------------------------------------------------------------ */
export function useRevealGroup(rootRef, deps = []) {
  useEffect(() => {
    const root = rootRef?.current || document;
    const els = [...root.querySelectorAll('.reveal')];
    els.forEach((el, i) => {
      if (!el.style.getPropertyValue('--d')) {
        el.style.setProperty('--d', `${Math.min(i * 55, 220)}ms`);
      }
      registerReveal(el);
    });
    return () => els.forEach(unregisterReveal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
