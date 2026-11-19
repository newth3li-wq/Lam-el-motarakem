import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Reveal } from '../motion';
import { Link } from '../router';
import { ArrowRight, Check, Clock, Inbox, Layers } from '../components/Icons';
import { STATUS_LABELS, pct } from '../lib/format';

const FILTERS = [
  ['all', 'الكل'],
  ['not_started', 'لسه'],
  ['in_progress', 'شغّال'],
  ['done', 'خلصت']
];

export default function Backlog() {
  const { token, user } = useAuth();
  const [state, setState] = useState({ loading: true, lessons: [], subjects: [], error: '' });
  const [filter, setFilter] = useState('all');
  const [activeSubject, setActiveSubject] = useState(null);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      const [lessonsRes, subjectsRes] = await Promise.allSettled([
        api('/api/lessons', { token }),
        api('/api/subjects', { token })
      ]);
      if (!live) return;
      setState({
        loading: false,
        lessons: lessonsRes.status === 'fulfilled' ? lessonsRes.value.lessons || [] : [],
        subjects: subjectsRes.status === 'fulfilled' ? subjectsRes.value.subjects || [] : [],
        error: lessonsRes.status === 'rejected' ? lessonsRes.reason?.message || 'مش قادرين نجيب الدروس' : ''
      });
    })();
    return () => { live = false; };
  }, [token, user.profile?.track]);

  const subjectNames = useMemo(
    () => Object.fromEntries(state.subjects.map((s) => [s.id, s.name])),
    [state.subjects]
  );

  const counts = useMemo(() => ({
    all: state.lessons.length,
    not_started: state.lessons.filter((l) => l.status === 'not_started').length,
    in_progress: state.lessons.filter((l) => l.status === 'in_progress').length,
    done: state.lessons.filter((l) => l.status === 'done').length
  }), [state.lessons]);

  /* One row per subject that actually has lessons on this student's track. */
  const subjectRows = useMemo(() => {
    const map = new Map();
    for (const lesson of state.lessons) {
      if (!map.has(lesson.subjectId)) map.set(lesson.subjectId, []);
      map.get(lesson.subjectId).push(lesson);
    }
    return [...map.entries()].map(([id, list]) => {
      const done = list.filter((l) => l.status === 'done').length;
      return {
        id,
        name: subjectNames[id] || id,
        total: list.length,
        done,
        open: list.length - done,
        percent: pct(done, list.length)
      };
    });
  }, [state.lessons, subjectNames]);

  const active = activeSubject ? subjectRows.find((row) => row.id === activeSubject) || null : null;

  const subjectLessons = useMemo(
    () => (active ? state.lessons.filter((l) => l.subjectId === active.id) : []),
    [state.lessons, active]
  );

  const subjectCounts = useMemo(() => ({
    all: subjectLessons.length,
    not_started: subjectLessons.filter((l) => l.status === 'not_started').length,
    in_progress: subjectLessons.filter((l) => l.status === 'in_progress').length,
    done: subjectLessons.filter((l) => l.status === 'done').length
  }), [subjectLessons]);

  const shownLessons = useMemo(
    () => (filter === 'all' ? subjectLessons : subjectLessons.filter((l) => l.status === filter)),
    [subjectLessons, filter]
  );

  const openSubject = (id) => {
    setActiveSubject(id);
    setFilter('all');
    window.scrollTo({ top: 0 });
  };

  const backToSubjects = () => {
    setActiveSubject(null);
    setFilter('all');
    window.scrollTo({ top: 0 });
  };

  const updateStatus = async (lesson, status) => {
    if (pending) return;
    setError('');
    setPending(lesson.id);
    const prev = state.lessons;
    setState((s) => ({ ...s, lessons: s.lessons.map((l) => (l.id === lesson.id ? { ...l, status } : l)) }));
    try {
      await api(`/api/lessons/${encodeURIComponent(lesson.id)}`, { method: 'PATCH', token, body: { status } });
    } catch (err) {
      setState((s) => ({ ...s, lessons: prev }));
      setError(err.message);
    } finally {
      setPending(null);
    }
  };

  const lessonList = (lessons) => (
    <div className="sessions">
      {lessons.map((lesson, i) => (
        <div className="session" key={lesson.id} style={{ '--i': Math.min(i, 9) }}>
          <span className={`tag ${lesson.status === 'done' ? 'tag-done' : lesson.status === 'in_progress' ? 'tag-progress' : ''}`}>
            {STATUS_LABELS[lesson.status]}
          </span>
          <div className="session-title">
            <strong>{lesson.title}</strong>
            <span>
              {lesson.estMinutes} دقيقة
              {lesson.custom ? ' · درس خاص بيك' : ''}
            </span>
          </div>
          <div className="row" style={{ gap: 6, gridColumn: 'auto' }}>
            {lesson.status !== 'done' ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={pending === lesson.id}
                onClick={() => updateStatus(lesson, 'done')}
                aria-label={`تم إنهاء ${lesson.title}`}
              >
                <Check size={15} /> خلّصت
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={pending === lesson.id}
                onClick={() => updateStatus(lesson, 'in_progress')}
                aria-label={`إرجاع ${lesson.title} لقيد المذاكرة`}
              >
                رجّع
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="eyebrow"><Layers size={15} /> دروسك</span>
          <h1>إنقاذ المتراكم</h1>
          <p>اختار مادة تشوف دروسها لوحدها، وحدّث حالة كل درس</p>
        </div>
        <Link className="btn btn-ghost" to="/app/planner">شوف الخطة</Link>
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {state.error ? <p className="error" role="alert">{state.error}</p> : null}

      {state.loading ? (
        <Reveal key="loading" className="panel">
          <div className="panel-body">
            <div className="stack">
              {[0, 1, 2].map((i) => <div key={i} className="skeleton skeleton-block" />)}
            </div>
          </div>
        </Reveal>
      ) : state.lessons.length === 0 ? (
        <Reveal key="empty" className="panel">
          <div className="panel-body">
            <div className="empty">
              <div className="empty-icon"><Inbox size={24} /></div>
              <h3>مفيش دروس متاحة لشعبتك لحد دلوقتي</h3>
              <p>
                المحتوى الرسمي بيتضاف من الكتب، أول ما دروس شعبتك تتوفر هتلاقيها هنا،
                وتقدر تبدأ تحدد المتراكم عليك
              </p>
              <Link className="btn btn-ghost btn-sm" to="/app">ارجع للرئيسية</Link>
            </div>
          </div>
        </Reveal>
      ) : !active ? (
        <Reveal key="subjects" className="panel view-swap">
          <div className="panel-head">
            <h2>المواد</h2>
            <span className="small muted">{counts.done} من {counts.all} درس خلصت</span>
          </div>
          <div className="panel-body">
            <div className="subject-picker">
              {subjectRows.map((row, i) => (
                <button
                  key={row.id}
                  type="button"
                  className="subject-tile"
                  style={{ '--i': Math.min(i, 9) }}
                  onClick={() => openSubject(row.id)}
                  aria-label={`افتح دروس ${row.name}`}
                >
                  <span className="subject-tile-head">
                    <b>{row.name}</b>
                    <small>{row.open === 0 ? 'خلصت' : `باقي ${row.open}`}</small>
                  </span>
                  <span className="small muted">{row.done} من {row.total} درس</span>
                  <span className="track" style={{ display: 'block' }}>
                    <i style={{ width: `${row.percent}%` }} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      ) : (
        <Reveal key={`subject-${active.id}`} className="panel view-swap">
          <div className="panel-head" style={{ flexWrap: 'wrap' }}>
            <div className="row" style={{ gap: 10, minWidth: 0 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={backToSubjects}>
                <ArrowRight size={15} /> كل المواد
              </button>
              <h2 style={{ margin: 0 }}>{active.name}</h2>
            </div>
            <span className="small muted">{active.done} من {active.total} خلصت</span>
          </div>

          <div className="panel-body">
            <div className="row" style={{ gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={'chip' + (filter === key ? ' chip-active' : '')}
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  style={{ cursor: 'pointer', background: filter === key ? 'var(--accent)' : 'transparent', color: filter === key ? 'var(--accent-ink)' : undefined, borderColor: filter === key ? 'transparent' : undefined }}
                >
                  {label} {subjectCounts[key] ? `· ${subjectCounts[key]}` : ''}
                </button>
              ))}
            </div>

            {shownLessons.length ? lessonList(shownLessons) : (
              <div className="empty">
                <div className="empty-icon"><Inbox size={24} /></div>
                <h3>مفيش دروس بالحالة دي في {active.name}</h3>
                <p>جرّب فلتر تاني، أو ارجع لكل دروس المادة</p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilter('all')}>اعرض كل الدروس</button>
              </div>
            )}
          </div>
        </Reveal>
      )}

      <Reveal className="note">
        <Clock size={18} />
        <p>لما تعلّم درس إنه خلص، بيتشال من الخطة الجديدة تلقائيًا، تقدر ترجّعه في أي وقت</p>
      </Reveal>
    </div>
  );
}
