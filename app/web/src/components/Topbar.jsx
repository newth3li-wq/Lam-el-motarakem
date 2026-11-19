import { ThemeToggle } from '../theme';
import { useMotionMode } from '../motion';
import { Menu } from './Icons';
import GlobalSearch from './GlobalSearch';

function SidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M15 4v16" />
    </svg>
  );
}

export default function Topbar({ title, open, onMenu, menuRef }) {
  const today = new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());

  const label = open ? 'إخفاء القائمة الجانبية' : 'إظهار القائمة الجانبية';

  // Same as the original: the motion switch only appears for people whose
  // system asks for reduced motion, and it is their call to opt back in.
  const { prefersReduced, full, toggle: toggleMotion } = useMotionMode();

  return (
    <header className="topbar">
      <button
        type="button"
        className="menu-btn"
        onClick={onMenu}
        ref={menuRef}
        aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
        aria-expanded={open}
        aria-controls="app-sidebar"
      >
        <Menu size={20} />
      </button>

      <button
        type="button"
        className="sidebar-toggle"
        onClick={onMenu}
        aria-label={label}
        aria-expanded={open}
        aria-controls="app-sidebar"
        title={label}
      >
        <SidebarIcon />
      </button>

      <div className="breadcrumb">
        مساحتك <span aria-hidden="true">/</span> <b>{title}</b>
      </div>

      <GlobalSearch />

      <div className="top-actions">
        <span className="today-label">{today}</span>
        {prefersReduced ? (
          <button
            type="button"
            className="theme-toggle motion-toggle"
            onClick={toggleMotion}
            aria-pressed={full}
            title={full ? 'رجوع لتقليل الحركة' : 'تشغيل كل الحركة والانتقالات'}
          >
            <span className="theme-ico" aria-hidden="true">✦</span>
            <span className="theme-text">{full ? 'حركة كاملة' : 'حركة مخففة'}</span>
          </button>
        ) : null}
        <ThemeToggle />
      </div>
    </header>
  );
}
