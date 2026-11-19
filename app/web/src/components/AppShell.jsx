import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from '../router';
import { useMediaQuery } from '../motion';
import { useAuth } from '../auth';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { metaFor } from '../nav';

export default function AppShell({ children, phase = 'in', pageKey = '' }) {
  const { path: pathname } = useLocation();
  const { user } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (!window.matchMedia('(min-width: 1024px)').matches) return false;
    try { return localStorage.getItem('lam_sidebar') !== 'closed'; } catch { return true; }
  });

  const menuRef = useRef(null);
  const closeRef = useRef(null);
  const firstRun = useRef(true);

  // desktop/mobile switch: drawer on mobile, remembered state on desktop
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (!isDesktop) {
      setOpen(false);
    } else {
      try { setOpen(localStorage.getItem('lam_sidebar') !== 'closed'); } catch { setOpen(true); }
    }
  }, [isDesktop]);

  // close the drawer after navigating on mobile
  useEffect(() => {
    if (!isDesktop) setOpen(false);
  }, [pathname, isDesktop]);

  // lock background scrolling while the mobile drawer is open
  useEffect(() => {
    if (isDesktop || !open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isDesktop, open]);

  // focus moves with the drawer, keyboard users are never lost
  useEffect(() => {
    if (isDesktop || !open) return undefined;
    const t = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(t);
  }, [isDesktop, open]);

  const close = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => menuRef.current?.focus({ preventScroll: true }), 30);
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (isDesktop) {
        try { localStorage.setItem('lam_sidebar', next ? 'open' : 'closed'); } catch { /* ignore */ }
      }
      return next;
    });
  }, [isDesktop]);

  // Esc closes the drawer / collapses the sidebar
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || !open) return;
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const meta = metaFor(pathname);

  return (
    <div className="shell" data-open={open ? 'true' : 'false'}>
      <a className="skip-link" href="#main">تخطَّ إلى المحتوى</a>

      <Sidebar
        open={open}
        onClose={isDesktop ? toggle : close}
        isDesktop={isDesktop}
        pathname={pathname}
        user={user}
        closeRef={closeRef}
      />

      <button
        type="button"
        className="scrim"
        tabIndex={-1}
        aria-label="إغلاق القائمة"
        onClick={close}
      />

      <div className="shell-body">
        <div className="shell-inner">
          <Topbar
            title={meta.title}
            open={open}
            onMenu={toggle}
            menuRef={menuRef}
          />
          <main id="main" className="shell-main" tabIndex={-1}>
            <div className="page-frame" data-phase={phase} key={pageKey}>
              {children}
            </div>
          </main>
          <footer className="app-footer">
            <span>لم المتراكم © نسخة 2026/2027</span>
            <span>بياناتك محفوظة على حسابك</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
