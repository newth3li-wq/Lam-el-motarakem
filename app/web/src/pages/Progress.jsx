import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Link } from '../router';
import { Reveal } from '../motion';
import { Alert, ArrowLeft, Chart, CheckCircle, Clock, Flame, Layers, Target } from '../components/Icons';
import { STATUS_LABELS, WEAKNESS_LABELS, hoursLabel, pct } from '../lib/format';

const R = 40;
const CIRC = 2 * Math.PI * R;
const POMO_SECONDS = 1500;

export default function Progress() {
  const { token, user } = useAuth();
  const profile = user.profile || {};
  const [state, setState] = useState({ loading: true, lessons: [], subjects: [], stats: null, plan: null });

  useEffect(() => {
    let live = true;
    (async () => {
      const [lessonsRes, subjectsRes, statsRes, planRes] = await Promise.allSettled([
        api('/api/lessons', { token }),
        api('/api/subjects', { token }),
        api('/api/stats', { token }),
        api('/api/plan', { token })
      ]);
      if (!live) return;
      setState({
        loading: false,
        lessons: lessonsRes.status === 'fulfilled' ? lessonsRes.value.lessons || [] : [],
        subjects: subjectsRes.status === 'fulfilled' ? subjectsRes.value.subjects || [] : [],
        stats: statsRes.status === 'fulfilled' ? statsRes.value : null,
        plan: planRes.status === 'fulfilled' ? planRes.value : null
      });
    })();
    return () => { live = false; };
  }, [token, profile.examDate, profile.track]);

  const done = state.lessons.filter((l) => l.status === 'done').length;
  const started = state.lessons.filter((l) => l.status === 'in_progress').length;
  const total = state.lessons.length;
  const percent = pct(done, total);

  const bySubject = useMemo(() => {
    return state.subjects.map((subject) => {
      const list = state.lessons.filter((l) => l.subjectId === subject.id);
      const d = list.filter((l) => l.status === 'done').length;
      return { ...subject, total: list.length, done: d, percent: pct(d, list.length) };
    }).sort((a, b) => a.percent - b.percent || a.name.localeCompare(b.name));
  }, [state.subjects, state.lessons]);

  const s = state.plan?.summary;

  /* ---- focus timer (old progress page): only completed minutes are posted ---- */
  const [secondsLeft, setSecondsLeft] = useState(POMO_SECONDS);
  const [running, setRunning] = useState(false);
  const [timerNote, setTimerNote] = useState('');
  const unloggedRef = useRef(0);
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const flushFocus = async () => {
    const minutes = unloggedRef.current;
    if (minutes <= 0) return;
    unloggedRef.current = 0;
    try {
      const stats = await api('/api/study-sessions', { method: 'POST', token: tokenRef.current, body: { minutes } });
      setState((prev) => ({ ...prev, stats }));
    } catch (err) {
      unloggedRef.current += minutes;
      setTimerNote(err.message);
    }
  };

  useEffect(() => {
    if (!running) return undefined;
    const id = window.setTimeout(() => {
      setSecondsLeft((value) => {
        const next = Math.max(0, value - 1);
        if ((POMO_SECONDS - next) % 60 === 0) unloggedRef.current += 1;
        return next;
      });
    }, 1000);
    return () => window.clearTimeout(id);
  }, [running, secondsLeft]);

  useEffect(() => {
    if (secondsLeft !== 0) return;
    setRunning(false);
    flushFocus().then(() => {
      setTimerNote((note) => note || 'خلصت جلسة التركيز! اتسجلت ٢٥ دقيقة مذاكرة');
      setSecondsLeft(POMO_SECONDS);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const startFocus = () => { setTimerNote(''); setRunning(true); };
  const pauseFocus = () => {
    const hadMinutes = unloggedRef.current > 0;
    setRunning(false);
    flushFocus().then(() => {
      if (hadMinutes) setTimerNote((note) => note || 'تم إيقاف المؤقت وتسجيل الوقت اللي خلص');
    });
  };
  const resetFocus = () => {
    setRunning(false);
    flushFocus().then(() => {
      unloggedRef.current = 0;
      setTimerNote('تمت إعادة المؤقت');
      setSecondsLeft(POMO_SECONDS);
    });
  };

  const timerText = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  if (state.loading) {
    return (
      <div className="stack">
        <div className="page-head"><div><h1>تقدمي</h1><p>بنحسب أرقامك من دروسك الفعلية</p></div></div>
        <div className="grid grid-stats">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-block" />)}</div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="stack">
        <div className="page-head">
          <div>
            <span className="eyebrow"><Chart size={15} /> أرقامك</span>
            <h1>تقدمي</h1>
            <p>أول ما يبدأ عندك دروس، هنا هتشوف نسبة الإنجاز الحقيقية</p>
          </div>
        </div>
        <Reveal className="panel">
          <div className="empty">
            <div className="empty-icon"><Layers size={24} /></div>
            <h3>لسه مفيش دروس على حسابك</h3>
            <p>
              {profile.track
                ? 'تأكد إن منهج شعبتك اتحمّل على السيرفر، أو أضف درس من المتراكم'
                : 'اختار شعبتك والمدة اللي عايز تخلص فيها المتراكم الأول، وبعدها هنحمّل منهجك الرسمي'}
            </p>
            <Link className="btn btn-primary btn-sm" to={profile.track ? '/app/backlog' : '/app'}>
              {profile.track ? 'افتح المتراكم' : 'ابدأ من الرئيسية'}
            </Link>
          </div>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="eyebrow"><Chart size={15} /> أرقام حقيقية</span>
          <h1>تقدمي</h1>
          <p>كل رقم هنا جاي من حالة دروسك ووقت مذاكرتك المسجّل، مفيش أرقام تقديرية</p>
        </div>
        <Link className="btn btn-ghost" to="/app/planner">شوف الخطة <ArrowLeft size={17} /></Link>
      </div>

      <div className="grid grid-stats">
        <Reveal className="stat-card" delay={0}>
          <span className="label">خلصت</span>
          <strong className="value">{done}</strong>
          <span className="hint">من {total} درس</span>
        </Reveal>
        <Reveal className="stat-card" delay={60}>
          <span className="label">شغّال عليه</span>
          <strong className="value">{started}</strong>
          <span className="hint">{STATUS_LABELS.in_progress}</span>
        </Reveal>
        <Reveal className="stat-card" delay={120}>
          <span className="label">فاضل</span>
          <strong className="value">{total - done}</strong>
          <span className="hint">درس لسه ما خلصش</span>
        </Reveal>
        <Reveal className="stat-card" delay={180}>
          <span className="label">وقت مذاكرة مسجّل</span>
          <strong className="value">{hoursLabel(state.stats?.totalMinutes || 0)}</strong>
          <span className="hint">{state.stats?.activeDays || 0} يوم نشاط</span>
        </Reveal>
      </div>

      <div className="grid grid-main">
        <Reveal className="panel" delay={60}>
          <div className="panel-head">
            <h2>نسبة الإنجاز</h2>
            <span className="chip">{percent}%</span>
          </div>
          <div className="panel-body">
            <div className="ring-wrap">
              <svg className="ring" viewBox="0 0 92 92" role="img" aria-label={`نسبة الإنجاز ${percent}%`}>
                <circle className="track" cx="46" cy="46" r={R} />
                <circle
                  className="fill"
                  cx="46"
                  cy="46"
                  r={R}
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - percent / 100)}
                />
              </svg>
              <div className="ring-meta">
                <strong>{percent}%</strong>
                <span>{done} من {total} درس خلصت</span>
                <div className="small muted" style={{ marginTop: 4 }}>
                  {total - done === 0 ? 'خلصت المنهج كله' : `فاضل ${total - done} درس`}
                </div>
              </div>
            </div>

            <hr className="divider" style={{ margin: '20px 0 16px' }} />

            <div className="bars">
              {[
                ['خلصته', done, 'var(--ok)'],
                ['شغّال عليه', started, 'var(--warn)'],
                ['لسه مابدأتش', total - done - started, 'var(--line-strong)']
              ].map(([label, count, color]) => (
                <div className="bar-row" key={label}>
                  <div className="top">
                    <span>{label}</span>
                    <span>{count} · {pct(count, total)}%</span>
                  </div>
                  <div className="track"><i style={{ width: `${pct(count, total)}%`, background: color }} /></div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="stack">
          <Reveal className="panel" delay={120}>
            <div className="panel-head"><h2>الخطة</h2></div>
            <div className="panel-body stack" style={{ gap: 12 }}>
              {s ? (
                <>
                  <div className="row spread">
                    <span className="muted small">تغطية المتراكم</span>
                    <strong>{Math.round((s.coverage || 0) * 100)}%</strong>
                  </div>
                  <hr className="divider" />
                  <div className="row spread">
                    <span className="muted small">وقت المتراكم</span>
                    <strong>{hoursLabel(s.backlogMinutes)}</strong>
                  </div>
                  <hr className="divider" />
                  <div className="row spread">
                    <span className="muted small">دروس مؤجلة</span>
                    <strong>{state.plan.deferred.length}</strong>
                  </div>
                  <hr className="divider" />
                  <div className="row spread">
                    <span className="muted small">أيام باقية</span>
                    <strong>{s.daysLeft}</strong>
                  </div>
                </>
              ) : (
                <p className="small muted" style={{ margin: 0 }}>
                  محتاج تحدد المدة اللي عايز تخلص فيها المتراكم عشان نحسب تغطية الخطة
                </p>
              )}
              <Link className="btn btn-ghost btn-sm" to="/app/planner">افتح الجدول</Link>
            </div>
          </Reveal>

          <Reveal className="note" delay={180}>
            <Flame size={18} />
            <p>الاستمرار أهم من الجلسة الطويلة، حتى ٢٥ دقيقة تركيز بتتحسب وتقرّبك من هدفك</p>
          </Reveal>
        </div>
      </div>

      <Reveal className="panel" delay={80}>
        <div className="panel-head">
          <h2>تقدمك في كل مادة</h2>
          <span className="small muted">{bySubject.filter((x) => x.total).length} مادة</span>
        </div>
        <div className="panel-body">
          {bySubject.length === 0 ? (
            <div className="empty" style={{ paddingBlock: 24 }}>
              <div className="empty-icon"><Alert size={22} /></div>
              <h3>مفيش مواد ظاهرة</h3>
              <p>اختار شعبتك من الملف الشخصي عشان تظهر موادك</p>
            </div>
          ) : (
            <div className="bars">
              {bySubject.map((subject) => (
                <div className="bar-row" key={subject.id}>
                  <div className="top">
                    <span>
                      <strong style={{ fontWeight: 600 }}>{subject.name}</strong>
                      {subject.weakness === 3 ? <span className="small muted"> · {WEAKNESS_LABELS[3]}</span> : null}
                    </span>
                    <span>{subject.done} / {subject.total} · {subject.percent}%</span>
                  </div>
                  <div className="track">
                    <i style={{ width: `${subject.percent}%`, opacity: subject.total ? 1 : .35 }} />
                  </div>
                  {subject.total === 0 ? (
                    <span className="small muted">
                      {subject.note || 'مفيش دروس متاحة للمادة دي لحد دلوقتي'}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>

      <Reveal className="panel focus-panel" delay={90}>
        <div className="panel-head">
          <div>
            <p className="eyebrow">جلسة تركيز</p>
            <h2>مؤقت المذاكرة</h2>
          </div>
          <span className="chip">{running ? 'شغّال' : secondsLeft === POMO_SECONDS ? '٢٥ دقيقة' : 'متوقف'}</span>
        </div>
        <div className="panel-body focus-body">
          <div className="focus-time" role="timer" aria-live="off" dir="ltr">{timerText}</div>
          <div className="focus-copy">
            <strong>٢٥ دقيقة تركيز</strong>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              {timerNote || 'ابدأ جلسة، وأي دقيقة كاملة بتتسجل في وقت مذاكرتك على السيرفر'}
            </p>
          </div>
          <div className="focus-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={startFocus} disabled={running}>ابدأ</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={pauseFocus} disabled={!running}>إيقاف مؤقت</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetFocus}>إعادة</button>
          </div>
        </div>
      </Reveal>

      <Reveal className="note" delay={100}>
        <CheckCircle size={18} />
        <p>علّم أي درس إنه خلص من «المتراكم»، والأرقام هنا هتتحدّث في نفس اللحظة</p>
      </Reveal>
    </div>
  );
}
