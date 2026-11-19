import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Reveal } from '../motion';
import Select from './Select';
import DateField from './DateField';

const TRACKS = [
  ['literary', 'أدبي'],
  ['science', 'علمي علوم'],
  ['math', 'علمي رياضة']
];
const LANGUAGES = [
  ['lang2_french', 'فرنساوي'],
  ['lang2_german', 'ألماني'],
  ['lang2_italian', 'إيطالي'],
  ['lang2_spanish', 'إسباني']
];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('sv-SE');
}

export default function Onboarding({ onDone }) {
  const { token, user, setProfile } = useAuth();
  const p = user.profile || {};
  const [name, setName] = useState(p.displayName || '');
  const [track, setTrack] = useState(p.track || '');
  const [language, setLanguage] = useState(p.secondLanguage || '');
  const [exam, setExam] = useState(p.examDate || '');
  const [minutes, setMinutes] = useState(120);
  const [rest, setRest] = useState([5]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleRest = (d) => setRest((r) => (r.includes(d) ? r.filter((x) => x !== d) : [...r, d]));

  const daysLeft = exam
    ? Math.round((new Date(`${exam}T12:00:00`) - new Date(`${isoDay()}T12:00:00`)) / 86400000)
    : 0;
  const daysWord = daysLeft === 1 ? 'يوم' : daysLeft === 2 ? 'يومين' : daysLeft <= 10 ? 'أيام' : 'يوم';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!track) return setError('اختار شعبتك');
    if (!exam) return setError('حدد المدة اللي عايز تخلص فيها المتراكم');
    if (exam <= isoDay()) return setError('نهاية المدة لازم تكون بعد النهاردة');
    if (rest.length === 7) return setError('لازم يكون عندك يوم مذاكرة واحد على الأقل');

    setBusy(true);
    try {
      const weekly = Object.fromEntries(DAYS.map((_, d) => [d, rest.includes(d) ? 0 : Number(minutes)]));
      const prof = await api('/api/profile', {
        method: 'PUT',
        token,
        body: { displayName: name.trim(), track, examDate: exam, secondLanguage: language || null }
      });
      await api('/api/availability', { method: 'PUT', token, body: { weekly } });
      setProfile(prof.profile);
      onDone?.();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Reveal className="panel" style={{ maxWidth: 700 }}>
      <form onSubmit={submit} noValidate>
        <div className="panel-head">
          <h2>قولنا حالتك</h2>
          <span className="chip">خطوة واحدة</span>
        </div>
        <div className="panel-body stack">
          <p className="muted" style={{ margin: 0 }}>
            البيانات دي هي أساس الخطة، تقدر تعدّلها في أي وقت من «الملف الشخصي»
          </p>

          <label className="field">
            <span>اسمك</span>
            <input type="text" maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك اللي تحب نناديك بيه" />
          </label>

          <fieldset className="field">
            <legend>شعبتك</legend>
            <div className="seg">
              {TRACKS.map(([value, label]) => (
                <label key={value} className={'seg-item' + (track === value ? ' on' : '')}>
                  <input type="radio" name="track" value={value} checked={track === value} onChange={() => setTrack(value)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend>لغتك التانية</legend>
            <div className="seg seg-wrap">
              {LANGUAGES.map(([value, label]) => (
                <label key={value} className={'seg-item' + (language === value ? ' on' : '')}>
                  <input type="radio" name="language" value={value} checked={language === value} onChange={() => setLanguage(value)} />
                  {label}
                </label>
              ))}
              <label className={'seg-item' + (!language ? ' on' : '')}>
                <input type="radio" name="language" value="" checked={!language} onChange={() => setLanguage('')} />
                مش محددة
              </label>
            </div>
            <small className="muted">هي اللي هتظهر في موادك بدل باقي اللغات</small>
          </fieldset>

          <label className="field">
            <span>المدة اللي عايز تخلص فيها المتراكم</span>
            <DateField min={isoDay(1)} value={exam} onChange={setExam} ariaLabel="تاريخ نهاية المدة" />
            <small className="muted">
              {exam && daysLeft > 0
                ? `آخر المدة ${new Date(`${exam}T12:00:00`).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })} — فاضل ${daysLeft} ${daysWord} من النهاردة`
                : 'اختار تاريخ واقعي تقدر تخلص فيه اللي وراك'}
            </small>
            <small className="small" style={{ color: exam && daysLeft > 0 && daysLeft < 14 ? 'var(--warn)' : 'var(--muted)', lineHeight: 1.8 }}>
              لازم تكون المدة كافية للمتراكم اللي عليك، لو حطيت يوم أو يومين وإنت وراك منهج كبير،
              الخطة هتقولك إن الوقت مش كافي وهتأجل دروس — مش هتكدب عليك
            </small>
          </label>

          <label className="field">
            <span>تقدر تذاكر كام في اليوم؟</span>
            <Select
              value={minutes}
              onChange={setMinutes}
              options={[60, 90, 120, 150, 180, 240, 300, 360].map((m) => ({ value: m, label: `${m / 60} ساعة` }))}
            />
          </label>

          <fieldset className="field">
            <legend>أيام الراحة (مفيش مذاكرة فيها)</legend>
            <div className="days">
              {DAYS.map((d, i) => (
                <label key={d} className={'day' + (rest.includes(i) ? ' on' : '')}>
                  <input type="checkbox" checked={rest.includes(i)} onChange={() => toggleRest(i)} />
                  {d}
                </label>
              ))}
            </div>
          </fieldset>

          {error ? <p className="error" role="alert">{error}</p> : null}

          <div className="row spread">
            <span className="small muted">هنحسب الخطة على الأيام المتاحة لحد آخر المدة</span>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'ثواني…' : 'احسب خطتي'}</button>
          </div>
        </div>
      </form>
    </Reveal>
  );
}
