import { useCallback, useEffect, useState } from 'react';

const NAV_EVENT = 'lam:nav';

// GitHub Pages (وأي استضافة على مسار فرعي) بتشتغل تحت /<repo>/. الراوتر هنا هو
// المكان الوحيد اللي بيكتب وبيقرا الـ URL، فكل التطبيق بياخد الـ base من هنا.
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, ''); // '' أو '/Lam-el-motarakem'
const ABSOLUTE = /^[a-z][a-z0-9+.-]*:/i;

export function withBase(to) {
  if (!to || ABSOLUTE.test(to) || to.startsWith('#') || !to.startsWith('/')) return to;
  return BASE + to;
}

function stripBase(pathname) {
  const path = pathname || '/';
  if (!BASE) return path;
  if (path === BASE) return '/';
  if (path.startsWith(BASE + '/')) return path.slice(BASE.length);
  return path;
}

function currentLocation() {
  return {
    path: stripBase(location.pathname),
    search: location.search,
    hash: location.hash
  };
}

export function navigate(to, { replace = false, keepScroll = false } = {}) {
  let url;
  try {
    url = new URL(to, location.origin);
  } catch {
    return;
  }

  const samePath = stripBase(url.pathname) === stripBase(location.pathname) && url.search === location.search;

  // same page + hash: just move to the section
  if (samePath && url.hash) {
    const el = document.querySelector(url.hash);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (samePath && !url.hash) return;

  // remember where we were, so "back" can return there
  if (!replace) {
    try {
      history.replaceState({ ...(history.state || {}), scrollY: window.scrollY }, '', location.href);
    } catch { /* ignore */ }
  }

  history[replace ? 'replaceState' : 'pushState']({ scrollY: 0 }, '', withBase(to));
  window.dispatchEvent(new Event(NAV_EVENT));

  if (!keepScroll) {
    if (url.hash) {
      requestAnimationFrame(() => {
        const el = document.querySelector(url.hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else {
      window.scrollTo(0, 0);
    }
  }
}

export function useLocation() {
  const [loc, setLoc] = useState(currentLocation);

  useEffect(() => {
    const onNav = () => setLoc(currentLocation());
    const onPop = () => {
      setLoc(currentLocation());
      const y = history.state && typeof history.state.scrollY === 'number' ? history.state.scrollY : 0;
      // wait for the page transition to commit before restoring
      window.setTimeout(() => window.scrollTo(0, y), 0);
    };
    window.addEventListener(NAV_EVENT, onNav);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener(NAV_EVENT, onNav);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  return loc;
}

export function usePathname() {
  return useLocation().path;
}

export function Link({ to, children, onClick, replace = false, keepScroll = false, ...rest }) {
  const handleClick = useCallback((e) => {
    if (onClick) onClick(e);
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (rest.target && rest.target !== '_self') return;
    if (rest.download) return;
    const isExternal = /^[a-z][a-z0-9+.-]*:/i.test(to) && !to.startsWith(location.origin);
    if (isExternal) return;
    e.preventDefault();
    navigate(to, { replace, keepScroll });
  }, [to, onClick, replace, keepScroll, rest.target, rest.download]);

  return <a href={withBase(to)} onClick={handleClick} {...rest}>{children}</a>;
}
