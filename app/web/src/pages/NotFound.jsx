import { Link } from '../router';
import { Brand, ThemeButton } from '../theme';
import { ArrowLeft, Compass, Home } from '../components/Icons';
import Mascot from '../components/Mascot';

function Card({ inApp }) {
  return (
    <div className="empty notfound">
      <span className="notfound-code" aria-hidden="true">404</span>
      <Mascot mood="worried" size={168} className="notfound-mascot" />
      <h3>الصفحة دي مش موجودة</h3>
      <p>
        يمكن الرابط قديم أو مكتوب غلط، مفيش مشكلة، كل حاجة تانية في مكانها
      </p>
      <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
        <Link className="btn btn-primary btn-sm" to={inApp ? '/app' : '/'}>
          <Home size={16} />
          {inApp ? 'ارجع للرئيسية' : 'ارجع للصفحة الرئيسية'}
        </Link>
        {inApp ? (
          <Link className="btn btn-ghost btn-sm" to="/app/planner">
            افتح جدولي
            <ArrowLeft size={16} />
          </Link>
        ) : (
          <Link className="btn btn-ghost btn-sm" to="/login">
            تسجيل الدخول
            <ArrowLeft size={16} />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function NotFound({ inApp = false }) {
  if (inApp) {
    return (
      <div className="stack">
        <div className="page-head">
          <div>
            <span className="eyebrow"><Compass size={15} /> صفحة مش موجودة</span>
            <h1>وصلت لطريق مسدود</h1>
            <p>الرابط ده مش جزء من حسابك، جرّب ترجع من القائمة الجانبية</p>
          </div>
        </div>
        <div className="panel"><Card inApp /></div>
      </div>
    );
  }

  return (
    <main className="center-page notfound-page">
      <div className="glow" aria-hidden="true" />
      <div className="notfound-top">
        <Link to="/" className="brand-link"><Brand /></Link>
        <ThemeButton />
      </div>
      <div className="panel notfound-panel">
        <Card inApp={false} />
      </div>
    </main>
  );
}
