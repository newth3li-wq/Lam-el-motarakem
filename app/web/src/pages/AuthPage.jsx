import { useEffect, useState } from 'react';
import { Link, navigate } from '../router';
import { ThemeIconButton } from '../theme';
import { useAuth } from '../auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Eye({ open }) {
  return open ? (
    <svg className="ico i-off" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 4-.8" />
    </svg>
  ) : (
    <svg className="ico i-on" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function AuthPage({ mode }) {
  const isReg = mode === 'register';
  const { login, register } = useAuth();
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // a route change is a fresh form, but the theme and the URL stay put
  useEffect(() => { setError(''); setShow(false); }, [mode]);

  const submit = async (e) => {
    e.preventDefault(); setError('');
    const email = form.email.trim();
    if (!EMAIL_RE.test(email)) return setError('الإيميل مش مكتوب صح');
    if (isReg && form.password.length < 8) return setError('كلمة السر لازم تكون 8 حروف على الأقل');
    if (!form.password) return setError('اكتب كلمة السر');
    setBusy(true);
    try {
      if (isReg) await register(email, form.password, form.displayName.trim());
      else await login(email, form.password);
      navigate('/app', { replace: true });
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <main className="auth-page">
      <div className="glow" aria-hidden="true" />

      <div className="auth-top">
        <Link className="back" to="/"><span aria-hidden="true">→</span> الصفحة التعريفية</Link>
        <ThemeIconButton />
      </div>

      <form className="auth-card glass" onSubmit={submit} noValidate>
        <h1>أهلاً بيك</h1>
        <p className="sub">ادخل لمساحة مذاكرتك، أو اعمل حساب جديد</p>

        <div className="tabs" data-active={isReg ? 'signup' : 'login'} role="tablist" aria-label="تسجيل الدخول أو إنشاء حساب">
          <span className="tab-ind" aria-hidden="true" />
          <button
            type="button"
            className="tab"
            role="tab"
            aria-selected={!isReg}
            onClick={() => { if (isReg) navigate('/login'); }}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            className="tab"
            role="tab"
            aria-selected={isReg}
            onClick={() => { if (!isReg) navigate('/register'); }}
          >
            إنشاء حساب
          </button>
        </div>

        <div className="pane" key={isReg ? 'signup' : 'login'}>
          {isReg ? (
            <label className="field">
              <span>الاسم <small>(اختياري)</small></span>
              <input type="text" autoComplete="name" maxLength={60} value={form.displayName} onChange={set('displayName')} placeholder="اكتب اسمك" />
            </label>
          ) : null}

          <label className="field">
            <span>البريد الإلكتروني</span>
            <input type="email" inputMode="email" autoComplete="email" dir="ltr" value={form.email} onChange={set('email')} placeholder="name@example.com" required />
          </label>

          <label className="field">
            <span>كلمة السر {isReg ? <small>(8 حروف على الأقل)</small> : null}</span>
            <div className="pw">
              <input type={show ? 'text' : 'password'} autoComplete={isReg ? 'new-password' : 'current-password'} dir="ltr" value={form.password} onChange={set('password')} required />
              <button
                type="button"
                className="eye"
                onClick={() => setShow((s) => !s)}
                aria-pressed={show}
                aria-label={show ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
              >
                <Eye open={show} />
              </button>
            </div>
          </label>

          {error ? <p className="err" role="alert">{error}</p> : null}

          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'ثواني…' : isReg ? 'إنشاء الحساب' : 'تسجيل الدخول'}
          </button>
        </div>

        <p className="switch">
          {isReg ? <>عندك حساب؟ <Link to="/login">سجّل دخولك</Link></> : <>معندكش حساب؟ <Link to="/register">اعمل حساب جديد</Link></>}
        </p>
      </form>
    </main>
  );
}
