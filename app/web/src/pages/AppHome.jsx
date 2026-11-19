import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Brand, ThemeButton } from '../theme';
import Select from '../components/Select';
import DateField from '../components/DateField';

const TRACKS = [['literary', 'أدبي'], ['science', 'علمي علوم'], ['math', 'علمي رياضة']];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const todayLocal = () => new Date().toLocaleDateString('sv-SE');

function Onboarding({ onDone }) {
  const { token, user, setProfile } = useAuth();
  const p = user.profile;
  const [name, setName] = useState(p.displayName || '');
  const [track, setTrack] = useState(p.track || '');
  const [exam, setExam] = useState(p.examDate || '');
  const [minutes, setMinutes] = useState(120);
  const [rest, setRest] = useState([5]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleRest = d => setRest(r => (r.includes(d) ? r.filter(x => x !== d) : [...r, d]));
  const submit = async e => {
    e.preventDefault(); setError('');
    if (!track) return setError('اختار شعبتك');
    if (!exam) return setError('حدد المدة اللي عايز تخلص فيها المتراكم');
    setBusy(true);
    try {
      const weekly = Object.fromEntries(DAYS.map((_, d) => [d, rest.includes(d) ? 0 : Number(minutes)]));
      const prof = await api('/api/profile', { method: 'PUT', token, body: { displayName: name.trim(), track, examDate: exam } });
      await api('/api/availability', { method: 'PUT', token, body: { weekly } });
      setProfile(prof.profile); onDone();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <form className="card form-card" onSubmit={submit} noValidate>
      <h2>قولنا حالتك</h2>
      <p className="muted">دي بياناتك الأساسية، وتقدر تعدّلها بعدين</p>
      <label className="field"><span>اسمك</span><input type="text" maxLength={60} value={name} onChange={e => setName(e.target.value)} /></label>
      <fieldset className="field"><legend>شعبتك</legend>
        <div className="seg">{TRACKS.map(([v, l]) => (
          <label key={v} className={'seg-item' + (track === v ? ' on' : '')}><input type="radio" name="track" value={v} checked={track === v} onChange={() => setTrack(v)} />{l}</label>
        ))}</div>
      </fieldset>
      <label className="field"><span>المدة اللي عايز تخلص فيها المتراكم</span><DateField min={todayLocal()} value={exam} onChange={setExam} ariaLabel="تاريخ نهاية المدة" /></label>
      <label className="field"><span>تقدر تذاكر كام في اليوم؟</span>
        <Select
          value={minutes}
          onChange={setMinutes}
          options={[60, 90, 120, 150, 180, 240, 300, 360].map((m) => ({ value: m, label: `${m / 60} ساعة` }))}
        /></label>
      <fieldset className="field"><legend>أيام الراحة (مفيش مذاكرة فيها)</legend>
        <div className="days">{DAYS.map((d, i) => (
          <label key={d} className={'day' + (rest.includes(i) ? ' on' : '')}><input type="checkbox" checked={rest.includes(i)} onChange={() => toggleRest(i)} />{d}</label>
        ))}</div>
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'ثواني...' : 'حفظ'}</button>
    </form>
  );
}

function Overview({ onEdit }) {
  const { token, user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/api/plan', { token }).then(setPlan).catch(e => setError(e.message)); }, [token]);
  const trackName = TRACKS.find(([v]) => v === user.profile.track)?.[1] || '';
  const s = plan?.summary;
  return (
    <>
      <div className="stats">
        <div className="card stat"><span className="muted">أيام باقية على آخر المدة</span><strong>{s ? s.daysLeft : '...'}</strong></div>
        <div className="card stat"><span className="muted">وقت مذاكرتك المتاح</span><strong>{s ? Math.round(s.totalCapacity / 60) + ' ساعة' : '...'}</strong></div>
        <div className="card stat"><span className="muted">شعبتك</span><strong>{trackName}</strong></div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="card next">
        <h2>الخطوة الجاية: دروسك</h2>
        <p className="muted">هنضيف هنا قريبًا اختيار المتراكم عليك وخطة النهاردة، دلوقتي بياناتك الأساسية محفوظة</p>
        <button type="button" className="btn btn-ghost" onClick={onEdit}>تعديل بياناتي</button>
      </div>
    </>
  );
}

export default function AppHome() {
  const { user, logout } = useAuth();
  const done = !!user.profile.onboarded;
  const [editing, setEditing] = useState(!done);
  const name = user.profile.displayName;
  return (
    <div className="app-shell">
      <header className="app-top container"><Brand />
        <div className="nav-actions"><ThemeButton /><button type="button" className="btn btn-ghost btn-sm" onClick={logout}>تسجيل الخروج</button></div>
      </header>
      <main className="container app-main">
        <h1>{name ? `أهلًا يا ${name}` : 'أهلًا بيك'}</h1>
        <p className="muted email"><bdi dir="ltr">{user.email}</bdi></p>
        {editing ? <Onboarding onDone={() => setEditing(false)} /> : <Overview onEdit={() => setEditing(true)} />}
      </main>
    </div>
  );
}
