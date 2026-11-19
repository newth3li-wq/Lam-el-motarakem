import { Link } from '../router';
import { Brand } from '../theme';
import Avatar from './Avatar';
import BrandMark from './BrandMark';
import { Close } from './Icons';
import { NAV_ITEMS, isActive } from '../nav';
import { TRACK_LABELS } from '../lib/format';

export default function Sidebar({ open, onClose, isDesktop, pathname, user, closeRef }) {
  const profile = user?.profile || {};
  const name = profile.displayName || 'طالب تالتة ثانوي';
  const track = TRACK_LABELS[profile.track] ? `شعبة ${TRACK_LABELS[profile.track]}` : 'اختار شعبتك';

  return (
    <aside
      id="app-sidebar"
      className="sidebar"
      data-open={open ? 'true' : 'false'}
      aria-label="القائمة الجانبية"
      aria-hidden={open ? undefined : true}
      inert={open ? undefined : true}
    >
      <button
        type="button"
        className="sb-close icon-btn"
        onClick={onClose}
        ref={closeRef}
        aria-label="إغلاق القائمة"
      >
        <Close size={18} />
      </button>

      <Link to="/app" className="brand-link shell-brand" onClick={() => !isDesktop && onClose()}>
        <Brand tagline="خطوة بخطوة نلمّ اللي فات" />
      </Link>

      <Link to="/app/profile" className="profile-mini" onClick={() => !isDesktop && onClose()} title="ملفي الشخصي">
        <Avatar />
        <div>
          <b>{name}</b>
          <small>{track}</small>
        </div>
      </Link>

      <nav className="sb-nav" aria-label="أقسام التطبيق">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={'nav-item' + (active ? ' active' : '')}
              aria-current={active ? 'page' : undefined}
              onClick={() => !isDesktop && onClose()}
              title={item.label}
            >
              <span className="nav-icon" aria-hidden="true"><Icon size={19} /></span>
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-note">
        <span className="note-icon" aria-hidden="true"><BrandMark size={16} /></span>
        <b>ابدأ من مكانك</b>
        <p>مش لازم تخلص كل حاجة مرة واحدة، المهم تبدأ وتستمر</p>
      </div>

      <div className="sidebar-bottom">نسخة تجريبية شخصية · 2026/2027</div>
    </aside>
  );
}
