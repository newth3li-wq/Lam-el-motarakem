import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useLocation } from '../router';
import { Reveal } from '../motion';
import Select from '../components/Select';
import DateField from '../components/DateField';
import curriculum from '../../../shared/curriculum.json';
import { Alert, Book, Check, ChevronRight, Clock, Info, Layers, Plus } from '../components/Icons';
import { STATUS_LABELS, WEAKNESS_LABELS, formatDay, pct } from '../lib/format';

const BOOKS = Object.fromEntries(curriculum.subjects.map((s) => [s.id, s]));
const SUBJECT_ICONS = {
  arabic: '✒️',
  english: '🔤',
  history: '🏛️',
  geography: '🌍',
  statistics: '📊',
  physics_science: '⚛️',
  physics_math: '⚛️',
  chemistry_science: '🧪',
  chemistry_math: '🧪',
  pure_math: '📐',
  applied_math: '📏',
  biology_science: '🧬',
  lang2_french: '🇫🇷',
  lang2_german: '🇩🇪',
  lang2_spanish: '🇪🇸',
  lang2_italian: '🇮🇹'
};
const iconFor = (subject) => SUBJECT_ICONS[subject.id] || subject.name.trim().charAt(0);
const WEAKNESS = [
  [1, 'متمكن'],
  [2, 'متوسط'],
  [3, 'محتاج شغل']
];

function isLatin(text) {
  return /^[A-Za-zÀ-ÿ0-9¡¿'’\s…:—–.!?()\-]+$/.test(text || '');
}

function UnitBlock({ unit, lessons, onToggle, onDelete, pending, focusLesson }) {
  const official = unit.lessons;
  const present = official.filter((l) => lessons.some((x) => x.id === l.id));
  const done = present.filter((l) => lessons.find((x) => x.id === l.id)?.status === 'done').length;
  const hasFocus = official.some((l) => l.id === focusLesson);

  return (
    <details className="unit" open={hasFocus || undefined}>
      <summary>
        <span className="unit-arrow"><ChevronRight size={16} /></span>
        <span className="unit-title" dir={isLatin(unit.title) ? 'ltr' : undefined}>{unit.title}</span>
        <span className="unit-meta">
          {present.length ? `${done}/${present.length}` : `${official.length} درس`}
        </span>
        <span className="unit-mini" aria-hidden="true"><i style={{ width: `${pct(done, present.length)}%` }} /></span>
      </summary>
      <div className="unit-body">
        {official.map((lesson) => {
          const live = lessons.find((x) => x.id === lesson.id);
          const status = live?.status || 'not_started';
          return (
            <div
              className={'lesson-line' + (lesson.id === focusLesson ? ' is-focus' : '')}
              key={lesson.id}
              id={`lesson-${lesson.id}`}
            >
              <span className={'dot ' + (status === 'done' ? 'dot-done' : status === 'in_progress' ? 'dot-progress' : '')} aria-hidden="true" />
              <div className="lesson-line-main">
                <strong dir={isLatin(lesson.title) ? 'ltr' : undefined}>{lesson.title}</strong>
                <span>
                  {lesson.page ? `صفحة ${lesson.page}` : 'من الفهرس الرسمي'}
                  {live ? ` · ${live.estMinutes} دقيقة تقديرية` : ' · لسه ما اتحمّلش على السيرفر'}
                </span>
              </div>
              {live ? (
                <button
                  type="button"
                  className={'btn btn-ghost btn-sm lesson-btn' + (status === 'done' ? ' is-done' : '')}
                  disabled={pending === live.id}
                  onClick={() => onToggle(live, status === 'done' ? 'in_progress' : 'done')}
                >
                  {status === 'done' ? <><Check size={14} /> رجّع</> : 'خلّصت'}
                </button>
              ) : (
                <span className="tag">مش محمّل</span>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

export default function Subjects() {
  const { token, user } = useAuth();
  const { search } = useLocation();
  const profile = user.profile || {};
  const focusLesson = useMemo(() => new URLSearchParams(search).get('lesson') || '', [search]);
  const [state, setState] = useState({ loading: true, subjects: [], lessons: [], error: '' });
  const [openId, setOpenId] = useState('');
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState('');
  const [pendingLesson, setPendingLesson] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  // add-a-lesson dialog
  const dialogRef = useRef(null);
  const [form, setForm] = useState({ subjectId: '', title: '', estMinutes: 45 });
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    const [subjectsRes, lessonsRes] = await Promise.allSettled([
      api('/api/subjects', { token }),
      api('/api/lessons', { token })
    ]);
    setState({
      loading: false,
      subjects: subjectsRes.status === 'fulfilled' ? subjectsRes.value.subjects || [] : [],
      lessons: lessonsRes.status === 'fulfilled' ? lessonsRes.value.lessons || [] : [],
      error: lessonsRes.status === 'rejected' ? lessonsRes.reason?.message || 'مش قادرين نجيب الدروس' : ''
    });
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, profile.track, profile.secondLanguage]);

  const rows = useMemo(() => {
    return state.subjects.map((subject) => {
      const list = state.lessons.filter((l) => l.subjectId === subject.id);
      const done = list.filter((l) => l.status === 'done').length;
      return { subject, list, done, percent: pct(done, list.length), book: BOOKS[subject.id] };
    });
  }, [state.subjects, state.lessons]);

  // old behaviour: the filter row is «كل المواد» plus one chip per subject
  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => r.subject.id === filter);
  }, [rows, filter]);

  // deep link from the global search: open the subject and reveal the lesson once
  const focusDone = useRef('');
  useEffect(() => {
    if (!focusLesson) return;
    const lesson = state.lessons.find((l) => l.id === focusLesson);
    if (!lesson) return;
    if (focusDone.current === focusLesson) return;
    focusDone.current = focusLesson;
    setFilter('all');
    setOpenId(lesson.subjectId);
    const t = window.setTimeout(() => {
      document.getElementById(`lesson-${focusLesson}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 220);
    return () => window.clearTimeout(t);
  }, [focusLesson, state.lessons]);

  const toggleLesson = async (lesson, status) => {
    if (pendingLesson) return;
    setError(''); setMessage('');
    setPendingLesson(lesson.id);
    const prev = state.lessons;
    setState((s) => ({ ...s, lessons: s.lessons.map((l) => (l.id === lesson.id ? { ...l, status } : l)) }));
    try {
      await api(`/api/lessons/${encodeURIComponent(lesson.id)}`, { method: 'PATCH', token, body: { status } });
    } catch (err) {
      setState((s) => ({ ...s, lessons: prev }));
      setError(err.message);
    } finally {
      setPendingLesson('');
    }
  };

  const removeLesson = async (lesson) => {
    if (!window.confirm(`تحذف «${lesson.title}» من دروسك؟`)) return;
    setError(''); setMessage('');
    try {
      await api(`/api/lessons/${encodeURIComponent(lesson.id)}`, { method: 'DELETE', token });
      setState((s) => ({ ...s, lessons: s.lessons.filter((l) => l.id !== lesson.id) }));
      setMessage('اتحذف الدرس');
    } catch (err) {
      setError(err.message);
    }
  };

  const changeEdit = (id, patch) => {
    const row = rows.find((r) => r.subject.id === id);
    const base = edits[id] || { weakness: row?.subject.weakness ?? 2, examDate: row?.subject.examDate || '' };
    setEdits((e) => ({ ...e, [id]: { ...base, ...patch } }));
  };

  const saveSubject = async (subject) => {
    const edit = edits[subject.id];
    if (!edit) return;
    setSaving(subject.id); setError(''); setMessage('');
    try {
      await api(`/api/subjects/${encodeURIComponent(subject.id)}`, {
        method: 'PUT', token,
        body: { weakness: Number(edit.weakness), examDate: edit.examDate || null }
      });
      setState((s) => ({
        ...s,
        subjects: s.subjects.map((x) => (x.id === subject.id ? { ...x, weakness: Number(edit.weakness), examDate: edit.examDate || null } : x))
      }));
      setEdits((e) => { const next = { ...e }; delete next[subject.id]; return next; });
      setMessage('اتحفظت بيانات المادة');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  };

  const openDialog = (subjectId = '') => {
    setForm({ subjectId: subjectId || state.subjects[0]?.id || '', title: '', estMinutes: 45 });
    setFormError('');
    dialogRef.current?.showModal();
    window.requestAnimationFrame(() => dialogRef.current?.querySelector('#addTitle')?.focus());
  };

  const closeDialog = () => dialogRef.current?.close();

  const submitLesson = async (e) => {
    e.preventDefault();
    if (formBusy) return;
    const title = form.title.trim();
    if (!form.subjectId) return setFormError('اختار المادة الأول');
    if (!title) return setFormError('اكتب اسم الدرس');
    setFormBusy(true); setFormError('');
    try {
      await api('/api/lessons', {
        method: 'POST', token,
        body: { subjectId: form.subjectId, title, estMinutes: Number(form.estMinutes) }
      });
      await load();
      setOpenId(form.subjectId);
      setFilter('all');
      setMessage('اتضاف الدرس وظهر في خطتك');
      closeDialog();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormBusy(false);
    }
  };

  if (state.loading) {
    return (
      <div className="stack">
        <div className="page-head"><div><h1>المواد والمنهج</h1><p>بنقرأ الفهرس الرسمي لكل مادة</p></div></div>
        {[0, 1].map((i) => <div key={i} className="skeleton skeleton-block" style={{ height: 120 }} />)}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="eyebrow"><Book size={15} /> فهرس رسمي</span>
          <h1>المواد والمنهج</h1>
          <p>
            الوحدات والدروس هنا منقولة من فهرس كتب الوزارة، علّم أي درس خلصته، وعدّل مستوى المادة
            وتاريخ امتحانها عشان الخطة تبقى أدق
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => openDialog()}>
          <Plus size={15} /> أضف درس
        </button>
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {message ? <p className="saved-note" role="status">{message}</p> : null}
      {state.error ? <p className="error" role="alert">{state.error}</p> : null}

      {!profile.track ? (
        <Reveal className="note">
          <Info size={18} />
          <p>اختار شعبتك من الملف الشخصي عشان تظهر موادك، دلوقتي كل المواد المشتركة ظاهرة بس</p>
        </Reveal>
      ) : null}

      <div className="filter-row" role="group" aria-label="فلترة المواد">
        <button
          type="button"
          className={'filter-chip' + (filter === 'all' ? ' active' : '')}
          onClick={() => setFilter('all')}
          aria-pressed={filter === 'all'}
        >
          كل المواد
        </button>
        {state.subjects.map((subject) => (
          <button
            key={subject.id}
            type="button"
            className={'filter-chip' + (filter === subject.id ? ' active' : '')}
            onClick={() => { setFilter(subject.id); setOpenId(subject.id); }}
            aria-pressed={filter === subject.id}
          >
            {subject.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Reveal className="panel">
          <div className="empty">
            <div className="empty-icon"><Layers size={24} /></div>
            <h3>مفيش مواد لسه</h3>
            <p>راجع شعبتك من الملف الشخصي، أو أضف درس خاص بيك</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilter('all')}>اعرض الكل</button>
          </div>
        </Reveal>
      ) : (
        <div className="subject-cards">
          {filtered.map(({ subject, list, done, percent, book }, index) => {
            const open = openId === subject.id;
            const edit = edits[subject.id];
            const value = edit || { weakness: subject.weakness, examDate: subject.examDate || '' };
            const dirty = !!edit;
            const custom = list.filter((l) => l.custom);
            const officialCount = book ? book.units.reduce((n, u) => n + u.lessons.length, 0) : 0;
            const loaded = list.length;
            const subline = loaded
              ? `${done} من ${loaded} درس خلصتهم`
              : officialCount
                ? `${officialCount} درس في الفهرس — لسه ما اتحمّلش على السيرفر`
                : 'المنهج بيتضاف أول ما يوصل';

            return (
              <Reveal
                className={'subject-card' + (open ? ' is-open' : '')}
                key={subject.id}
                delay={Math.min(index * 30, 180)}
              >
                <button
                  type="button"
                  className="subject-card-head"
                  onClick={() => setOpenId(open ? '' : subject.id)}
                  aria-expanded={open}
                >
                  <span className="subject-symbol" aria-hidden="true">{iconFor(subject)}</span>
                  <span className="subject-title-wrap">
                    <h3>
                      {subject.name}
                      {subject.optional ? <span className="chip">لغة تانية</span> : null}
                    </h3>
                    <small>{subline}</small>
                  </span>
                  <span className="subject-percent">{loaded ? `${percent}%` : '—'}</span>
                </button>

                <div className="subject-card-progress" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </div>

                {open ? (
                  <div className="subject-body">
                    {book?.note ? <p className="note-inline"><Alert size={16} /> {book.note}</p> : null}
                    {subject.note && !book?.note ? <p className="note-inline"><Alert size={16} /> {subject.note}</p> : null}

                    <div className="subject-settings">
                      <div className="field">
                        <span>مستواك في المادة</span>
                        <div className="weakness-row">
                          {WEAKNESS.map(([level, label]) => (
                            <button
                              key={level}
                              type="button"
                              className={'chip' + (Number(value.weakness) === level ? ' chip-active' : '')}
                              onClick={() => changeEdit(subject.id, { weakness: level })}
                              aria-pressed={Number(value.weakness) === level}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="field">
                        <span>امتحان المادة</span>
                        <DateField
                          value={value.examDate}
                          onChange={(v) => changeEdit(subject.id, { examDate: v })}
                          ariaLabel={`تاريخ امتحان ${subject.name}`}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!dirty || saving === subject.id}
                        onClick={() => saveSubject(subject)}
                      >
                        {saving === subject.id ? 'بيحفظ…' : 'حفظ'}
                      </button>
                    </div>
                    {value.examDate ? (
                      <p className="small muted" style={{ margin: 0 }}>
                        امتحان المادة: {formatDay(value.examDate)} · {WEAKNESS_LABELS[Number(value.weakness)]}
                      </p>
                    ) : null}

                    {book && book.units.length ? (
                      <div className="units">
                        {book.units.map((unit) => (
                          <UnitBlock
                            key={unit.id}
                            unit={unit}
                            lessons={list}
                            onToggle={toggleLesson}
                            onDelete={removeLesson}
                            pending={pendingLesson}
                            focusLesson={focusLesson}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="empty" style={{ paddingBlock: 22 }}>
                        <div className="empty-icon"><Book size={22} /></div>
                        <h3>فهرس المادة لسه مش متاح</h3>
                        <p>{book?.note || 'هنضيف الوحدات الرسمية أول ما توصل'}</p>
                      </div>
                    )}

                    {custom.length ? (
                      <div className="custom-lessons">
                        <h4>دروس خاصة بيك</h4>
                        {custom.map((lesson) => (
                          <div className="lesson-line" key={lesson.id}>
                            <span className={'dot ' + (lesson.status === 'done' ? 'dot-done' : lesson.status === 'in_progress' ? 'dot-progress' : '')} />
                            <div className="lesson-line-main">
                              <strong>{lesson.title}</strong>
                              <span>{lesson.estMinutes} دقيقة · {STATUS_LABELS[lesson.status]}</span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={pendingLesson === lesson.id}
                              onClick={() => toggleLesson(lesson, lesson.status === 'done' ? 'in_progress' : 'done')}
                            >
                              {lesson.status === 'done' ? 'رجّع' : 'خلّصت'}
                            </button>
                            <button
                              type="button"
                              className="lesson-del"
                              onClick={() => removeLesson(lesson)}
                              aria-label={`حذف ${lesson.title}`}
                              title="حذف الدرس"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <button type="button" className="subject-add-link" onClick={() => openDialog(subject.id)}>
                  + أضف درس للمادة
                </button>
              </Reveal>
            );
          })}
        </div>
      )}

      <Reveal className="note" delay={80}>
        <Clock size={18} />
        <p>
          أرقام الصفحات من الفهرس الرسمي، الوقت التقديري لكل درس محسوب من عدد صفحاته، وتقدر تعدّله
          من «المتراكم» لو الدرس محتاج وقت أكتر
        </p>
      </Reveal>

      <dialog className="modal lesson-modal" ref={dialogRef} aria-labelledby="addLessonTitle">
        <form method="dialog" onSubmit={submitLesson}>
          <div className="modal-head">
            <div>
              <p className="eyebrow">درس جديد</p>
              <h2 id="addLessonTitle">أضف درس للمتراكم</h2>
            </div>
            <button type="button" className="close-btn" onClick={closeDialog} aria-label="إغلاق">×</button>
          </div>

          <label className="field-label" htmlFor="addSubject">المادة</label>
          <Select
            className="field"
            id="addSubject"
            value={form.subjectId}
            onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
            options={state.subjects.map((s) => ({ value: s.id, label: s.name }))}
          />

          <label className="field-label" htmlFor="addTitle">اسم الدرس</label>
          <input
            className="field"
            id="addTitle"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="مثال: الوحدة الرابعة — الدرس التالت"
            maxLength={120}
          />

          <label className="field-label" htmlFor="addMinutes">وقت الدرس التقديري</label>
          <Select
            className="field"
            id="addMinutes"
            value={form.estMinutes}
            onChange={(v) => setForm((f) => ({ ...f, estMinutes: Number(v) }))}
            options={[20, 30, 45, 60, 75, 90, 120].map((m) => ({ value: m, label: `${m} دقيقة` }))}
          />

          {formError ? <p className="error" role="alert">{formError}</p> : null}

          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={formBusy}>
              {formBusy ? 'بيضيف…' : 'أضف الدرس'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={closeDialog}>إلغاء</button>
          </div>
          <p className="helper">الدرس بيتحسب في خطتك زي أي درس تاني، وتقدر تحذفه في أي وقت</p>
        </form>
      </dialog>
    </div>
  );
}
