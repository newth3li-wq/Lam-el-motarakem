import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import { navigate, useLocation, Link } from './router';
import { applyMotionPreference } from './motion';
import AppShell from './components/AppShell';
import Landing from './pages/Landing';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Backlog from './pages/Backlog';
import Planner from './pages/Planner';
import Progress from './pages/Progress';
import Subjects from './pages/Subjects';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

const APP_ROUTES = {
  '/app': Dashboard,
  '/app/backlog': Backlog,
  '/app/planner': Planner,
  '/app/progress': Progress,
  '/app/subjects': Subjects,
  '/app/notifications': Notifications,
  '/app/profile': Profile
};

function Splash() {
  return (
    <div className="splash" role="status" aria-label="جاري التحميل">
      <span className="spinner" />
    </div>
  );
}

const isAppPath = (path) => path === '/app' || path.startsWith('/app/');

function prefersReduced() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
      && !document.documentElement.classList.contains('motion-full');
  } catch {
    return false;
  }
}

/* The visible route lags the URL by one short exit beat, exactly like the
   original site: the old page leaves first, then the new one rises in. */
export default function App() {
  const { path: pathname } = useLocation();
  const { status } = useAuth();
  const [shown, setShown] = useState(pathname);
  const [phase, setPhase] = useState('in');
  const booted = useRef(false);

  // auth guards — one place, no flicker between pages
  useEffect(() => {
    if (status === 'loading') return;
    if (isAppPath(pathname) && status !== 'authed') navigate('/login', { replace: true });
    if ((pathname === '/login' || pathname === '/register') && status === 'authed') {
      navigate('/app', { replace: true });
    }
  }, [pathname, status]);

  useEffect(() => {
    booted.current = true;
    if (pathname === shown) return undefined;

    if (prefersReduced()) {
      setShown(pathname);
      setPhase('in');
      window.scrollTo(0, 0);
      return undefined;
    }

    setPhase('out');
    // 90ms matches the exit animation: navigation never waits on a long
    // crossfade, and the new page still rises in instead of popping.
    const timer = window.setTimeout(() => {
      setShown(pathname);
      setPhase('in');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }, 90);
    return () => window.clearTimeout(timer);
  }, [pathname, shown]);

  // Every route leaves with the motion budget the visitor chose. There is no
  // OS-level silent downgrade any more, so this only re-reads the saved
  // «حركة كاملة / حركة مخففة» choice when the route changes.
  useLayoutEffect(() => {
    applyMotionPreference();
  }, [shown]);

  const Page = APP_ROUTES[shown];
  let page;
  if (shown === '/') {
    page = <Landing />;
  } else if (shown === '/login') {
    page = status === 'authed' ? <Splash /> : <AuthPage mode="login" />;
  } else if (shown === '/register') {
    page = status === 'authed' ? <Splash /> : <AuthPage mode="register" />;
  } else if (isAppPath(shown)) {
    page = status === 'authed' ? (Page ? <Page /> : <NotFound inApp />) : <Splash />;
  } else {
    page = <NotFound />;
  }

  if (isAppPath(shown)) {
    return <AppShell phase={phase} pageKey={shown}>{page}</AppShell>;
  }

  return (
    <div className="page-frame" data-phase={phase} key={shown}>
      {page}
    </div>
  );
}

export { Link };
