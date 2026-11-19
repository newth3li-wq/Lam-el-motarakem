import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Link } from '../router';
import { Reveal } from '../motion';
import Select from '../components/Select';
import { Alert, Calendar, Check, Clock, Inbox, Layers, Refresh, Settings, Target } from '../components/Icons';
import { METHOD_LABELS, formatDay, hoursLabel, pct, TRACK_LABELS } from '../lib/format';

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MINUTES = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360];
const FOCUS_KEY = 'lam_focus';
const FOCUS_OPTIONS = [
  ['balanced', 'متوازن بين المواد', 'المادة الأقرب امتحانًا الأول، وبعدها أضعف مادة عندك'],
  ['backlog', 'الأولوية للمتراكم الأكبر', 'المادة اللي وراك فيها أكبر وقت مذاكرة هي اللي تبدأ'],
  ['nearest', 'الأولوية لترتيب المنهج', 'الدرس اللي بعده في الكتاب الأول، مادة ورا مادة']
];

function readFocus() {
  try {
    const v = localStorage.getItem(FOCUS_KEY);
    return FOCUS_OPTIONS.some(([value]) => value === v) ? v : 'balanced';
  } catch { return 'balanced'; }
}

function dayLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return { weekday: WEEKDAYS[d.getDay()], day: d.getDate(), month: d.getMonth() + 1 };
}

export default function Planner() {
  const { token, user } = useAuth();
  const profile = user.profile || {};
  const [state, setState] = useState({ loading: true, plan: null, error: '', subjects: [] });
  const [selected, setSelected] = useState(0);
  const [version, setVersion] = useState(0);
  const [focus, setFocus] = useState(readFocus);
  const [availability, setAvailability] = useState(null);
  const [savingTime, setSavingTime] = useState(false);
  const [timeNote, setTimeNote] = useState('');
  const [timeError, setTimeError] = useState('');

  useEffect(() => {
    let live = true;
    api('/api/availability', { token })
      .then((a) => {
        if (!live) return;
        setAvailability({
          weekly: WEEKDAYS.map((_, i) => Number(a.weekly?.[i] ?? a.weekly?.[String(i)] ?? 0)),
          overrides: a.overrides || {}
        });
      })
      .catch(() => { if (live) setAvailability({ weekly: WEEKDAYS.map(() => 0), overrides: {} }); });
    return () => { live = false; };
  }, [token]);

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    (async () => {
      const [planRes, subjectsRes] = await Promise.allSettled([
        api(`/api/plan?focus=${encodeURIComponent(focus)}`, { token }),
        api('/api/subjects', { token })
      ]);
      if (!live) return;
      setState({
        loading: false,
        plan: planRes.status === 'fulfilled' ? planRes.value : null,
        error: planRes.status === 'rejected' ? planRes.reason?.message || 'مش قادرين نجيب الخطة دلوقتي' : '',
        subjects: subjectsRes.status === 'fulfilled' ? subjectsRes.value.subjects || [] : []
      });
    })();
    return () => { live = false; };
  }, [token, version, focus, profile.examDate, profile.track]);

  const subjectNames = useMemo(
    () => Object.fromEntries(state.subjects.map((s) => [s.id, s.name])),
    [state.subjects]
  );

  const plan = state.plan;
  const days = plan?.days || [];
  const current = days[Math.min(selected, Math.max(0, days.length - 1))] || null;
  const s = plan?.summary;

  useEffect(() => {
    if (selected > 0 && selected >= days.length) setSelected(0);
  }, [days.length, selected]);

  const totalWeekly = availability ? availability.weekly.reduce((a, b) => a + Number(b || 0), 0) : 0;
  const activeMinutes = availability ? availability.weekly.filter((m) => Number(m) > 0) : [];
  const uniformHours = activeMinutes.length && activeMinutes.every((m) => m === activeMinutes[0]) && activeMinutes[0] % 60 === 0
    ? String(activeMinutes[0] / 60)
    : '';
  const studyDaysWeek = availability ? availability.weekly.filter((m) => Number(m) > 0).length : 0;

  const setDayMinutes = (index, value) => setAvailability((a) => (
    a ? { ...a, weekly: a.weekly.map((m, i) => (i === index ? Number(value) : m)) } : a
  ));

  const applyDailyHours = (hours) => {
    if (!hours) return;
    setAvailability((a) => (
      a ? { ...a, weekly: a.weekly.map((m) => (Number(m) > 0 ? Math.round(Number(hours) * 60) : 0)) } : a
    ));
  };

  const changeFocus = (value) => {
    setFocus(value);
    try { localStorage.setItem(FOCUS_KEY, value); } catch { /* private mode */ }
  };

  const saveSettings = async () => {
    setTimeError(''); setTimeNote('');
    if (!availability || !availability.weekly.some((m) => Number(m) > 0)) {
      return setTimeError('لازم يكون عندك يوم مذاكرة واحد على الأقل');
    }
    setSavingTime(true);
    try {
      const body = {
        weekly: Object.fromEntries(availability.weekly.map((m, i) => [i, Number(m) || 0])),
        overrides: availability.overrides || {}
      };
      await api('/api/availability', { method: 'PUT', token, body });
      setTimeNote('اتحفظ وقتك، والخطة اتحسبت من جديد');
      setVersion((v) => v + 1);
    } catch (err) {
      setTimeError(err.message);
    } finally {
      setSavingTime(false);
    }
  };

  if (!profile.onboarded) {
    return (
      <div className="stack">
        <div className="page-head">
          <div>
            <span className="eyebrow"><Calendar size={15} /> جدولك</span>
            <h1>جدولي</h1>
            <p>قبل ما نوزّع الأيام، محتاجين نعرف شعبتك ووقتك والمدة اللي عايز تخلص فيها المتراكم</p>
          </div>
        </div>
        <Reveal className="panel">
          <div className="empty">
            <div className="empty-icon"><Target size={24} /></div>
            <h3>لسه محتاجين بياناتك الأساسية</h3>
            <p>كمّل خطوة البداية من الرئيسية، وبعدها هتلاقي جدول كامل بأيام المذاكرة والدروس</p>
            <Link className="btn btn-primary btn-sm" to="/app">ابدأ من الرئيسية</Link>
          </div>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="eyebrow"><Calendar size={15} /> {TRACK_LABELS[profile.track] || 'شعبتك'}</span>
          <h1>جدولي</h1>
          <p>
            الخطة بتتوزّع على الأيام المتاحة لحد آخر المدة اللي حددتها، الجديد بياخد أولوية، والمتراكم
            بياخد الباقي، ولو المدة مش كافية بنقولك ناقص كام ساعة بدل ما نكدب عليك
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setVersion((v) => v + 1)} disabled={state.loading}>
          <Refresh size={17} />
          {state.loading ? 'بيحدّث…' : 'حدّث الخطة'}
        </button>
      </div>

      <div className="grid planner-grid">
        <Reveal className="panel" delay={0}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">وقتك الحقيقي</p>
              <h2>وقت المذاكرة الأسبوعي</h2>
            </div>
            <span className="chip">{hoursLabel(totalWeekly)} أسبوعيًا</span>
          </div>
          <div className="panel-body stack">
            <p className="small muted" style={{ margin: 0 }}>
              حدد دقايق المذاكرة الحقيقية لكل يوم، خلّي اليوم «راحة» لو مش هتقدر تذاكر فيه فعلًا،
              عشان الخطة متوعدكش بوقت مش موجود
            </p>

            {availability ? (
              <div className="schedule-editor">
                {WEEKDAYS.map((day, i) => {
                  const minutes = Number(availability.weekly[i]) || 0;
                  return (
                    <label className={'schedule-edit-row' + (minutes === 0 ? ' is-rest' : '')} key={day}>
                      <span>{day}</span>
                      <Select
                        value={minutes}
                        onChange={(v) => setDayMinutes(i, v)}
                        ariaLabel={`وقت ${day}`}
                        options={MINUTES.map((m) => ({
                          value: m,
                          label: m === 0 ? 'راحة' : m % 60 === 0 ? `${m / 60} ساعة` : `${m} دقيقة`
                        }))}
                      />
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="skeleton skeleton-block" />
            )}

            <div className="row spread">
              <span className="small muted"><Clock size={14} /> {studyDaysWeek} يوم مذاكرة في الأسبوع</span>
            </div>
          </div>
        </Reveal>

        <Reveal className="panel" delay={60}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">إعدادات</p>
              <h2>تركيز الخطة</h2>
            </div>
            <Settings size={18} />
          </div>
          <div className="panel-body stack">
            <label className="field">
              <span>ساعات المذاكرة اليومية</span>
              <Select
                value={uniformHours}
                onChange={applyDailyHours}
                disabled={!availability}
                options={[
                  ...(uniformHours === '' ? [{ value: '', label: 'مخصص (من الجدول اللي جنبك)' }] : []),
                  ...[1, 2, 3, 4, 5, 6].map((h) => ({ value: h, label: `${h} ${h === 1 ? 'ساعة' : 'ساعات'}` }))
                ]}
              />
              <small className="muted">بتتطبّق على أيام المذاكرة بس، وأيام الراحة بتفضل راحة</small>
            </label>

            <label className="field">
              <span>تركيز الخطة</span>
              <Select
                value={focus}
                onChange={changeFocus}
                options={FOCUS_OPTIONS.map(([value, label]) => ({ value, label }))}
              />
              <small className="muted">{FOCUS_OPTIONS.find(([value]) => value === focus)?.[2]}</small>
            </label>

            {timeError ? <p className="error" role="alert">{timeError}</p> : null}
            {timeNote ? <p className="saved-note" role="status"><Check size={15} /> {timeNote}</p> : null}

            <button type="button" className="btn btn-primary btn-block" onClick={saveSettings} disabled={savingTime || !availability}>
              {savingTime ? 'بيحفظ…' : 'احفظ واعمل الخطة'}
            </button>
            <p className="helper" style={{ margin: 0 }}>
              الحفظ بيعيد حساب الخطة على طول من وقتك ودروسك، الترتيب بيغيّر أول درس في اليوم،
              مش عدد الدروس، والدروس الجديدة بتفضل محمية في كل الحالات
            </p>
          </div>
        </Reveal>
      </div>

      {state.loading ? (
        <div className="grid grid-stats">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-block" />)}
        </div>
      ) : state.error ? (
        <Reveal className="panel">
          <div className="empty">
            <div className="empty-icon"><Alert size={24} /></div>
            <h3>الخطة مش جاهزة</h3>
            <p>{state.error}</p>
            <Link className="btn btn-ghost btn-sm" to="/app/profile">راجع بياناتك</Link>
          </div>
        </Reveal>
      ) : !plan ? null : (
        <>
          <div className="grid grid-stats">
            <Reveal className="stat-card" delay={0}>
              <span className="label">أيام باقية</span>
              <strong className="value">{s.daysLeft}</strong>
              <span className="hint">لحد {formatDay(s.examDate)}</span>
            </Reveal>
            <Reveal className="stat-card" delay={60}>
              <span className="label">وقت متاح</span>
              <strong className="value">{hoursLabel(s.totalCapacity)}</strong>
              <span className="hint">{s.studyDays} يوم مذاكرة</span>
            </Reveal>
            <Reveal className="stat-card" delay={120}>
              <span className="label">مخطّط فعليًا</span>
              <strong className="value">{hoursLabel(s.scheduledBacklog + s.scheduledNew)}</strong>
              <span className="hint">{Math.round((s.coverage || 0) * 100)}% من المتراكم</span>
            </Reveal>
            <Reveal className="stat-card" delay={180}>
              <span className="label">دروس مؤجلة</span>
              <strong className="value">{plan.deferred.length}</strong>
              <span className="hint">{plan.feasible ? 'الوقت كافي' : hoursLabel(s.shortfall) + ' ناقصة'}</span>
            </Reveal>
          </div>

          <div className="grid grid-main">
            <Reveal className="panel" delay={60}>
              <div className="panel-head" style={{ flexWrap: 'wrap', gap: 10 }}>
                <h2>أيام المذاكرة</h2>
                <span className="small muted">{days.length} يوم متاح لحد آخر المدة</span>
              </div>

              {days.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon"><Calendar size={24} /></div>
                  <h3>مفيش أيام مذاكرة</h3>
                  <p>كل الأيام محددة كراحة، عدّل أيامك من الملف الشخصي عشان نوزّع الدروس</p>
                  <Link className="btn btn-ghost btn-sm" to="/app/profile">عدّل أيامك</Link>
                </div>
              ) : (
                <>
                  <div className="day-strip" role="tablist" aria-label="أيام الخطة">
                    {days.map((d, i) => {
                      const lab = dayLabel(d.date);
                      const on = i === selected;
                      return (
                        <button
                          key={d.date}
                          type="button"
                          role="tab"
                          aria-selected={on}
                          className={on ? 'on' : ''}
                          onClick={() => setSelected(i)}
                          title={formatDay(d.date)}
                        >
                          <span>{lab.weekday}</span>
                          <b>{lab.day}</b>
                        </button>
                      );
                    })}
                  </div>

                  {current ? (
                    <div className="panel-body">
                      <div className="row spread" style={{ marginBottom: 12 }}>
                        <div>
                          <strong>{formatDay(current.date, { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                          <div className="small muted">
                            {current.sessions.length ? `${current.sessions.length} جلسة` : 'يوم فاضي'}
                          </div>
                        </div>
                        <span className="small mono">{Math.round(current.used)} / {Math.round(current.capacity)} دقيقة</span>
                      </div>
                      <div className="track" style={{ marginBottom: 16 }}>
                        <i style={{ width: `${pct(current.used, current.capacity)}%` }} />
                      </div>

                      {current.sessions.length === 0 ? (
                        <div className="empty" style={{ paddingBlock: 26 }}>
                          <div className="empty-icon"><Clock size={22} /></div>
                          <h3>مفيش دروس في اليوم ده</h3>
                          <p>لو اليوم ده مش مناسب، غيّره من أيام الراحة في الملف الشخصي</p>
                        </div>
                      ) : (
                        <div className="sessions">
                          {current.sessions.map((session, i) => (
                            <div className="session" key={`${session.lessonId}-${i}`}>
                              <span className={'tag ' + (session.kind === 'new' ? 'tag-new' : '')}>
                                {session.kind === 'new' ? 'جديد' : 'متراكم'}
                              </span>
                              <div className="session-title">
                                <strong>{session.title}</strong>
                                <span>{subjectNames[session.subject] || session.subject} · {METHOD_LABELS[session.method] || 'ذاكر الدرس'}</span>
                              </div>
                              <span className="session-time">{session.minutes} د</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="row spread" style={{ marginTop: 16 }}>
                        <span className="small muted">دروس اليوم بتتحدّث تلقائيًا لما تعلّم أي درس إنه خلص</span>
                        <Link className="small" to="/app/backlog" style={{ fontWeight: 600 }}>افتح المتراكم</Link>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </Reveal>

            <div className="stack">
              {plan.warnings.length ? (
                <Reveal className="panel" delay={120}>
                  <div className="panel-head"><h2>محتاج تعرف</h2></div>
                  <div className="panel-body">
                    <ul className="warn-list">
                      {plan.warnings.map((w, i) => <li key={i}><Alert size={16} /><span>{w}</span></li>)}
                    </ul>
                  </div>
                </Reveal>
              ) : null}

              <Reveal className="panel" delay={180}>
                <div className="panel-head">
                  <h2>دروس مؤجلة</h2>
                  <span className="chip">{plan.deferred.length}</span>
                </div>
                <div className="panel-body">
                  {plan.deferred.length === 0 ? (
                    <div className="row" style={{ gap: 8, color: 'var(--ok)' }}>
                      <Layers size={18} />
                      <span className="small">كل الدروس المفتوحة اتوزّعت</span>
                    </div>
                  ) : (
                    <div className="sessions">
                      {plan.deferred.slice(0, 8).map((d) => (
                        <div className="session" key={d.lessonId}>
                          <span className={'tag ' + (d.kind === 'new' ? 'tag-new' : 'tag-late')}>
                            {d.kind === 'new' ? 'جديد' : 'مؤجل'}
                          </span>
                          <div className="session-title">
                            <strong>{d.title}</strong>
                            <span>{subjectNames[d.subject] || d.subject}</span>
                          </div>
                          <span className="session-time">{d.minutes} د</span>
                        </div>
                      ))}
                      {plan.deferred.length > 8 ? (
                        <Link className="small muted" to="/app/backlog">و{plan.deferred.length - 8} درس كمان…</Link>
                      ) : null}
                    </div>
                  )}
                </div>
              </Reveal>

              <Reveal className="note" delay={220}>
                <Clock size={18} />
                <p>وقتك الحالي {hoursLabel(s.totalCapacity)} على {s.studyDays} يوم، زوّد ساعاتك أو قلّل أيام الراحة لو عايز مساحة أكبر</p>
              </Reveal>
            </div>
          </div>
        </>
      )}

      <Reveal className="note" delay={80}>
        <Inbox size={18} />
        <p>الخطة دي حساب حقيقي من دروسك ووقتك، مش جدول ثابت، أي تعديل في حالة درس أو وقتك بيتحسب من جديد</p>
      </Reveal>
    </div>
  );
}
