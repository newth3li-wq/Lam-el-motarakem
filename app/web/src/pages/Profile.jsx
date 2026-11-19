import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { navigate } from '../router';
import { Reveal, useMotionMode } from '../motion';
import Avatar, { clearAvatarCache } from '../components/Avatar';
import Select from '../components/Select';
import DateField from '../components/DateField';
import { Alert, Check, Clock, Info, Logout, Mail, Shield, User } from '../components/Icons';
import { TRACK_LABELS, formatDay, hoursLabel } from '../lib/format';

const TRACKS = [
  ['literary', 'أدبي'],
  ['science', 'علمي علوم'],
  ['math', 'علمي رياضة']
];
const LANGUAGES = [
  ['', 'مش محددة'],
  ['lang2_french', 'فرنساوي'],
  ['lang2_german', 'ألماني'],
  ['lang2_italian', 'إيطالي'],
  ['lang2_spanish', 'إسباني']
];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MINUTES = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360];

// Same rule as the dashboard, so the numbers always agree: 50 XP per finished
// lesson, 2 XP per studied minute, a new level every 200 XP.
const BADGES = [
  ['🌱', 'أول درس', (s) => s.done >= 1],
  ['📘', '٥ دروس', (s) => s.done >= 5],
  ['🏆', '١٠ دروس', (s) => s.done >= 10],
  ['⏱️', 'ساعة مذاكرة', (s) => s.minutes >= 60],
  ['🔥', '٣ أيام مذاكرة', (s) => s.activeDays >= 3],
  ['⚡', 'أسبوع مذاكرة', (s) => s.activeDays >= 7]
];

function todayISO() {
  return new Date().toLocaleDateString('sv-SE');
}

async function fileToDataUrl(file) {
  if (!file.type.startsWith('image/')) throw new Error('اختار صورة PNG أو JPEG أو WEBP');
  if (file.size > 8 * 1024 * 1024) throw new Error('الصورة كبيرة جدًا، اختار صورة أقل من 8 ميجا');

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('مش قادرين نقرا الصورة دي'));
      image.src = url;
    });

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

    let quality = 0.88;
    let data = canvas.toDataURL('image/jpeg', quality);
    while (data.length * 0.75 > 200 * 1024 && quality > 0.4) {
      quality -= 0.08;
      data = canvas.toDataURL('image/jpeg', quality);
    }
    if (data.length * 0.75 > 200 * 1024) throw new Error('الصورة كبيرة بعد الضغط، جرّب صورة تانية');
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function Profile() {
  const { token, user, setProfile, logout } = useAuth();
  const profile = user.profile || {};
  const [form, setForm] = useState({
    displayName: profile.displayName || '',
    track: profile.track || '',
    examDate: profile.examDate || '',
    secondLanguage: profile.secondLanguage || ''
  });
  const [weekly, setWeekly] = useState(() => Array(7).fill(120));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTime, setSavingTime] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [uploading, setUploading] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [score, setScore] = useState({ done: 0, minutes: 0, activeDays: 0 });
  const [planNote, setPlanNote] = useState(null);
  const fileRef = useRef(null);
  const { prefersReduced, full, toggle: toggleMotion } = useMotionMode();

  useEffect(() => {
    let live = true;
    api('/api/availability', { token })
      .then((data) => {
        if (!live) return;
        setWeekly(DAYS.map((_, i) => Number(data.weekly?.[i] ?? (i === 5 ? 0 : 120))));
      })
      .catch(() => { /* keep the defaults, the student can still save */ })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token]);

  useEffect(() => {
    let live = true;
    Promise.allSettled([
      api('/api/stats', { token }),
      api('/api/lessons', { token })
    ]).then(([statsRes, lessonsRes]) => {
      if (!live) return;
      const lessons = lessonsRes.status === 'fulfilled' ? lessonsRes.value.lessons || [] : [];
      setScore({
        done: lessons.filter((l) => l.status === 'done').length,
        minutes: statsRes.status === 'fulfilled' ? Number(statsRes.value.totalMinutes || 0) : 0,
        activeDays: statsRes.status === 'fulfilled' ? Number(statsRes.value.activeDays || 0) : 0
      });
    });
    return () => { live = false; };
  }, [token]);

  const xp = score.done * 50 + score.minutes * 2;
  const level = Math.floor(xp / 200) + 1;
  const earned = useMemo(() => BADGES.filter(([, , test]) => test(score)).length, [score]);

  const totalWeekly = useMemo(() => weekly.reduce((a, b) => a + Number(b || 0), 0), [weekly]);
  const studyDays = weekly.filter((m) => Number(m) > 0).length;
  const daysLeft = form.examDate
    ? Math.round((new Date(`${form.examDate}T12:00:00`) - new Date(`${todayISO()}T12:00:00`)) / 86400000)
    : 0;
  const daysWord = daysLeft === 1 ? 'يوم' : daysLeft === 2 ? 'يومين' : daysLeft <= 10 ? 'أيام' : 'يوم';

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setError(''); setSaved('');
    if (!form.track) return setError('اختار شعبتك');
    if (form.examDate && form.examDate < todayISO()) return setError('نهاية المدة لازم تكون النهاردة أو بعدها');
    setSaving(true);
    try {
      const data = await api('/api/profile', {
        method: 'PUT', token,
        body: {
          displayName: form.displayName.trim(),
          track: form.track,
          examDate: form.examDate || null,
          secondLanguage: form.secondLanguage || null
        }
      });
      setProfile(data.profile);
      setSaved('اتحفظت بياناتك');
      setPlanNote(null);
      if (form.examDate) {
        // real check from the server: is this duration actually enough for the backlog?
        try {
          const plan = await api('/api/plan', { token });
          const short = Math.ceil((plan.summary?.shortfall || 0) / 60);
          setPlanNote(plan.feasible
            ? { ok: true, text: `المدة كافية: ${plan.summary.studyDays} يوم مذاكرة تكفي الدروس المفتوحة` }
            : { ok: false, text: `المدة مش كافية للمتراكم اللي عليك — ناقص حوالي ${short} ساعة، مدّد المدة أو زوّد وقت المذاكرة` });
        } catch { setPlanNote(null); }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  };

  const saveAvailability = async () => {
    setError(''); setSaved('');
    if (!weekly.some((m) => Number(m) > 0)) return setError('لازم يكون عندك يوم مذاكرة واحد على الأقل');
    setSavingTime(true);
    try {
      const body = { weekly: Object.fromEntries(weekly.map((m, i) => [i, Number(m) || 0])) };
      await api('/api/availability', { method: 'PUT', token, body });
      setSaved('اتحفظ جدول وقتك، والخطة هتتحدّث');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingTime('');
    }
  };

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setSaved('');
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await api('/api/profile/avatar', { method: 'PUT', token, body: { dataUrl } });
      clearAvatarCache();
      setAvatarVersion((v) => v + 1);
      setProfile({ ...profile, hasAvatar: true });
      setSaved('اتحدّثت صورتك');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const doLogout = async () => {
    clearAvatarCache();
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="stack profile-page">
      <div className="page-head">
        <div>
          <span className="eyebrow"><User size={15} /> مساحتك الشخصية</span>
          <h1>ملفي الشخصي</h1>
          <p>بياناتك وإنجازاتك ومستواك في مكان واحد، أي تعديل هنا بيغيّر الخطة من اليوم اللي بعده</p>
        </div>
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {saved ? <p className="saved-note" role="status"><Check size={15} /> {saved}</p> : null}
      {planNote ? (
        <p className={planNote.ok ? 'saved-note' : 'error'} role="status">
          {planNote.ok ? <Check size={15} /> : <Alert size={16} />} {planNote.text}
        </p>
      ) : null}

      <Reveal className="panel profile-card">
        <div className="profile-card-side">
          <Avatar key={avatarVersion} size="lg" alt="صورتك الشخصية" />
          <div className="profile-card-id">
            <strong>{profile.displayName || 'حسابي'}</strong>
            <small><Mail size={13} /> {user.email}</small>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'بترفع…' : profile.hasAvatar ? 'غيّر الصورة' : 'ارفع صورة'}
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onPickAvatar} />
          <p className="small muted" style={{ margin: 0 }}>صورة مربعة، أقل من 200 كيلوبايت بعد الضغط</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={doLogout}>
            <Logout size={16} /> تسجيل الخروج
          </button>
        </div>

        <form className="profile-fields" onSubmit={saveProfile} noValidate>
          <div className="profile-fields-grid">
            <label className="field">
              <span>الاسم</span>
              <input type="text" maxLength={60} autoComplete="name" value={form.displayName} onChange={set('displayName')} placeholder="اسمك اللي تحب نناديك بيه" />
            </label>

            <label className="field">
              <span>شعبتك</span>
              <Select
                value={form.track}
                onChange={(v) => setForm((f) => ({ ...f, track: v }))}
                placeholder="اختار شعبتك"
                options={[{ value: '', label: 'اختار شعبتك' }, ...TRACKS.map(([value, label]) => ({ value, label }))]}
              />
            </label>

            <label className="field">
              <span>اللغة التانية</span>
              <Select
                value={form.secondLanguage}
                onChange={(v) => setForm((f) => ({ ...f, secondLanguage: v }))}
                options={LANGUAGES.map(([value, label]) => ({ value, label }))}
              />
            </label>

            <label className="field">
              <span>المدة اللي عايز تخلص فيها المتراكم</span>
              <DateField min={todayISO()} value={form.examDate} onChange={(v) => setForm((f) => ({ ...f, examDate: v }))} ariaLabel="تاريخ نهاية المدة" />
              <small className="muted">
                {form.examDate && daysLeft > 0
                  ? `آخر المدة ${formatDay(form.examDate)} — فاضل ${daysLeft} ${daysWord} من النهاردة`
                  : 'محددش المدة — الخطة مش هتشتغل من غيرها'}
              </small>
              <small className="small" style={{ color: form.examDate && daysLeft > 0 && daysLeft < 14 ? 'var(--warn)' : 'var(--muted)', lineHeight: 1.8 }}>
                لازم تكون المدة كافية للمتراكم اللي عليك، لو المدة قصيرة أوي، الخطة هتقولك إن الوقت
                مش كافي وهتأجل دروس — مش هتكدب عليك
              </small>
            </label>
          </div>

          <div className="row spread">
            <span className="small muted">{TRACK_LABELS[form.track] || 'اختار شعبتك'}</span>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'بيحفظ…' : 'حفظ البيانات'}</button>
          </div>
        </form>
      </Reveal>

      <div className="stats-grid">
        <Reveal className="stat-card" delay={0}>
          <span className="stat-icon" aria-hidden="true">★</span>
          <div><small>المستوى</small><strong>{level}</strong></div>
        </Reveal>
        <Reveal className="stat-card" delay={60}>
          <span className="stat-icon" aria-hidden="true">✦</span>
          <div><small>النقاط</small><strong>{xp}</strong></div>
        </Reveal>
        <Reveal className="stat-card" delay={120}>
          <span className="stat-icon" aria-hidden="true">🔥</span>
          <div><small>أيام مذاكرة</small><strong>{score.activeDays}</strong></div>
        </Reveal>
        <Reveal className="stat-card" delay={180}>
          <span className="stat-icon" aria-hidden="true">◷</span>
          <div><small>دقايق المذاكرة</small><strong>{score.minutes}</strong></div>
        </Reveal>
      </div>

      <Reveal className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">إنجازاتك</p>
            <h2>الأوسمة</h2>
          </div>
          <span className="chip">{earned} من {BADGES.length}</span>
        </div>
        <div className="panel-body">
          <div className="badge-grid">
            {BADGES.map(([icon, name, test]) => (
              <div className={'badge' + (test(score) ? ' earned' : '')} key={name}>
                <span aria-hidden="true">{icon}</span>
                <b>{name}</b>
              </div>
            ))}
          </div>
          <p className="helper">كل درس مكتمل = 50 نقطة، وكل دقيقة مذاكرة = دقيقتان نقاط، كل 200 نقطة = مستوى جديد</p>
        </div>
      </Reveal>

      {prefersReduced ? (
        <Reveal className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">الحركة</p>
              <h2>حركة كاملة</h2>
            </div>
            <span className="chip">{full ? 'مفعّلة' : 'مخففة'}</span>
          </div>
          <div className="panel-body">
            <p className="small muted" style={{ marginTop: 0 }}>
              جهازك مفعّل عليه تقليل الحركة، فالموقع بيعرض حركة مخففة (fade خفيف)، فعّل الخيار ده لو عايز الحركة الكاملة
            </p>
            <label className="switch-row">
              <input type="checkbox" checked={full} onChange={() => toggleMotion()} />
              تفعيل الحركة الكاملة
            </label>
          </div>
        </Reveal>
      ) : null}

      <Reveal className="panel" delay={60}>
        <div className="panel-head">
          <div>
            <p className="eyebrow">وقتك</p>
            <h2>وقت المذاكرة الأسبوعي</h2>
          </div>
          <span className="chip">{hoursLabel(totalWeekly)} أسبوعيًا</span>
        </div>
        <div className="panel-body stack">
          <p className="small muted" style={{ margin: 0 }}>
            حدد دقايق المذاكرة الحقيقية لكل يوم، خلّي اليوم صفر لو راحة
          </p>

          {loading ? (
            <div className="skeleton skeleton-block" />
          ) : (
            <div className="week-editor">
              {DAYS.map((day, i) => (
                <label className={'week-row' + (Number(weekly[i]) === 0 ? ' is-rest' : '')} key={day}>
                  <span>{day}</span>
                  <Select
                    value={weekly[i]}
                    onChange={(v) => setWeekly((w) => w.map((m, idx) => (idx === i ? Number(v) : m)))}
                    ariaLabel={`وقت ${day}`}
                    options={MINUTES.map((m) => ({ value: m, label: m === 0 ? 'راحة' : `${m} دقيقة` }))}
                  />
                </label>
              ))}
            </div>
          )}

          <div className="row spread">
            <span className="small muted"><Clock size={14} /> {studyDays} يوم مذاكرة في الأسبوع</span>
            <button type="button" className="btn btn-primary" onClick={saveAvailability} disabled={savingTime || loading}>
              {savingTime ? 'بيحفظ…' : 'حفظ الوقت'}
            </button>
          </div>
        </div>
      </Reveal>

      <Reveal className="note" delay={80}>
        <Shield size={18} />
        <p>كلمة السر بتتخزن مشفّرة، ومش بنقدر نشوفها، مفيش استرجاع بكلمة السر لسه، فخلي بالك منها</p>
      </Reveal>

      <Reveal className="note" delay={120}>
        <Info size={18} />
        <p>لو غيّرت شعبتك، موادك هتتغيّر وتقدّمك القديم هيفضل محفوظ لو رجعت لنفس الشعبة</p>
      </Reveal>
    </div>
  );
}
