import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import BrandMark from './components/BrandMark';

const ThemeCtx = createContext(null);

const canReduce = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  !document.documentElement.classList.contains('motion-full');

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => document.documentElement.dataset.theme || 'dark');

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }, [theme]);

  // keep tabs in sync
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'lam_theme' && (e.newValue === 'dark' || e.newValue === 'light')) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next, origin) => {
    if (next !== 'dark' && next !== 'light') return;
    const root = document.documentElement;
    if (root.dataset.theme === next) return;

    // Change the DOM in one synchronous pass so the view transition captures
    // the finished state, not a mid-render frame.
    const apply = () => {
      flushSync(() => setThemeState(next));
      root.dataset.theme = next;
      root.style.colorScheme = next;
      try { localStorage.setItem('lam_theme', next); } catch { /* private mode */ }
    };

    // Old-site behaviour: the new theme grows in a circle from the button.
    if (typeof document.startViewTransition !== 'function' || canReduce() || !origin) {
      apply();
      return;
    }

    const rect = origin.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = document.startViewTransition(apply);
    transition.ready
      .then(() => {
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`
            ]
          },
          {
            duration: 620,
            easing: 'cubic-bezier(.22, 1, .36, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      })
      .catch(() => { /* animation is cosmetic */ });
  }, []);

  const toggle = useCallback((origin) => {
    const current = document.documentElement.dataset.theme || theme;
    setTheme(current === 'dark' ? 'light' : 'dark', origin);
  }, [setTheme, theme]);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className={'theme-toggle theme-mode ' + className}
      onClick={(e) => toggle(e.currentTarget)}
      aria-label={dark ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن'}
      title={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
      aria-pressed={dark}
    >
      <span className="theme-ico" aria-hidden="true">
        {dark ? (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        )}
      </span>
      <span className="theme-text">{dark ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
    </button>
  );
}

/* The original landing / auth button: one square, two icons that rotate and
   cross-fade. The colour change still grows from the button centre. */
export function ThemeIconButton({ className = '' }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      className={'theme-btn ' + className}
      onClick={(e) => toggle(e.currentTarget)}
      aria-label="تغيير المظهر"
      title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
    >
      <svg className="ico i-moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
      <svg className="ico i-sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </svg>
    </button>
  );
}

export const ThemeButton = ThemeToggle;

export function Brand({ compact = false, tagline = '' }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        <BrandMark size={22} />
      </span>
      {!compact && (
        <span className="brand-copy">
          <strong>لم المتراكم</strong>
          {tagline ? <small>{tagline}</small> : null}
        </span>
      )}
    </span>
  );
}
