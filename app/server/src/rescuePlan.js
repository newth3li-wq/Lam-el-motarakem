'use strict';
/**
 * Rescue-plan engine for "لم المتراكم".
 * Pure + deterministic: same input -> same plan. No I/O, no clock, no randomness.
 *
 * Idea:
 *  - NEW lessons (released by school from today on) are scheduled FIRST, inside a short
 *    window after their release, so they never turn into backlog.
 *  - BACKLOG lessons (released before today, or without a release date) use the remaining
 *    time, ordered by subject exam date -> weakness -> curriculum order, with interleaving
 *    so one subject cannot eat the whole day.
 *  - Re-planning = running it again with today's date and the current lesson statuses.
 *  - If time is not enough it SAYS SO: the unplaced part is returned as `deferred`.
 */
const DAY_MS = 86400000;
const MIN_BLOCK = 15, MAX_PER_LESSON_PER_DAY = 90, DEFAULT_EST = 45;
const DEFAULTS = { newShare: 0.6, subjectShare: 0.6, newWindowDays: 2 };
// How the backlog is ordered. Every mode still protects the new lessons first.
//  balanced: closest subject exam first, then the weakest subject, then book order
//  backlog:  the subject with the biggest remaining backlog first
//  nearest:  the next lesson in book order first
const FOCUS_MODES = ['balanced', 'backlog', 'nearest'];

const parse = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fmt = t => new Date(t).toISOString().slice(0, 10);
const addDays = (s, n) => fmt(parse(s) + n * DAY_MS);
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / DAY_MS);
const weekday = s => new Date(parse(s)).getUTCDay(); // 0 = Sunday

const METHOD_LABELS_AR = {
  summarize_after_class: 'لخّص الدرس بكلامك بعد الحصة',
  understand_then_recall: 'افهم الدرس ثم سمّعه لنفسك من غير ما تبص',
  practice_questions: 'كمّل بحل أسئلة على الدرس'
};
const methodFor = (l, kind) => kind === 'new' ? 'summarize_after_class'
  : (l.status === 'in_progress' ? 'practice_questions' : 'understand_then_recall');

function remainingMinutes(l) {
  if (l.status === 'done') return 0;
  const est = Math.max(1, Math.round(l.estMinutes ?? DEFAULT_EST));
  return l.status === 'in_progress' ? Math.max(Math.min(est, MIN_BLOCK), Math.round(est / 2)) : est;
}

function planRescue(input) {
  const { today, examDate, weekly = {}, overrides = {}, lessons = [], subjects = {} } = input;
  const opt = { ...DEFAULTS, ...(input.options || {}) };
  const focus = FOCUS_MODES.includes(input.focus) ? input.focus : 'balanced';
  const daysLeft = diffDays(today, examDate);
  if (!(daysLeft > 0)) return { error: 'EXAM_NOT_IN_FUTURE' };

  const reviewDays = input.reviewDays ?? (daysLeft >= 10 ? 2 : 0);
  const dates = Array.from({ length: daysLeft }, (_, i) => addDays(today, i));
  const studyDates = dates.slice(0, dates.length - reviewDays);
  const reviewDates = dates.slice(dates.length - reviewDays);
  const cap = d => Math.max(0, Math.floor(overrides[d] ?? weekly[weekday(d)] ?? 0));
  const days = new Map(studyDates.map(d => [d, { date: d, capacity: cap(d), used: 0, newUsed: 0, sessions: [] }]));
  const subj = id => ({ weakness: 2, examDate, ...(subjects[id] || {}) });
  const subjEnd = id => subj(id).examDate;

  const open = lessons.filter(l => l.status !== 'done' && remainingMinutes(l) > 0);
  const isNew = l => !!l.releaseDate && l.releaseDate >= today;
  const news = open.filter(isNew).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id)));
  const backlogBySubject = {};
  for (const l of open) if (!isNew(l)) backlogBySubject[l.subject] = (backlogBySubject[l.subject] || 0) + remainingMinutes(l);
  const back = open.filter(l => !isNew(l)).map(l => ({ l, rem: remainingMinutes(l) })).sort((a, b) => {
    const A = subj(a.l.subject), B = subj(b.l.subject);
    const byBook = (a.l.order ?? 0) - (b.l.order ?? 0) || String(a.l.id).localeCompare(String(b.l.id));
    if (focus === 'nearest') return (A.priority ?? 0) - (B.priority ?? 0) || byBook;
    if (focus === 'backlog') {
      return (backlogBySubject[b.l.subject] || 0) - (backlogBySubject[a.l.subject] || 0)
        || A.examDate.localeCompare(B.examDate) || B.weakness - A.weakness || byBook;
    }
    return A.examDate.localeCompare(B.examDate) || B.weakness - A.weakness || byBook;
  });
  const backlogTotal = back.reduce((s, x) => s + x.rem, 0);
  const newTotal = news.reduce((s, l) => s + remainingMinutes(l), 0);

  const put = (day, l, minutes, kind, late) => {
    const ex = day.sessions.find(s => s.lessonId === l.id);
    if (ex) ex.minutes += minutes;
    else day.sessions.push({ lessonId: l.id, subject: l.subject, title: l.title, kind, minutes, late: !!late, method: methodFor(l, kind) });
    day.used += minutes;
    if (kind === 'new') day.newUsed += minutes;
  };
  const doneToday = (day, l) => (day.sessions.find(s => s.lessonId === l.id) || { minutes: 0 }).minutes;

  // Pass A — protect the new
  const deferredNew = [];
  for (const l of news) {
    let rem = remainingMinutes(l);
    for (const d of studyDates) {
      if (rem <= 0) break;
      if (d < l.releaseDate || d >= subjEnd(l.subject)) continue;
      const day = days.get(d);
      let free = day.capacity - day.used;
      if (backlogTotal > 0) free = Math.min(free, Math.floor(day.capacity * opt.newShare) - day.newUsed);
      const late = diffDays(l.releaseDate, d) > opt.newWindowDays;
      while (rem > 0) {
        const take = Math.min(rem, free, MAX_PER_LESSON_PER_DAY - doneToday(day, l));
        if (take <= 0 || (take < MIN_BLOCK && take < rem)) break;
        put(day, l, take, 'new', late); rem -= take; free -= take;
      }
    }
    if (rem > 0) deferredNew.push({ l, rem });
  }

  // Pass B — rescue the backlog
  for (const d of studyDates) {
    const day = days.get(d);
    const live = back.filter(x => x.rem > 0 && d < subjEnd(x.l.subject));
    if (!live.length) continue;
    const startFree = day.capacity - day.used;
    const nSubj = new Set(live.map(x => x.l.subject)).size;
    const perSubject = nSubj > 2 ? Math.ceil(startFree * Math.min(opt.subjectShare, 0.4)) : nSubj > 1 ? Math.ceil(startFree * opt.subjectShare) : startFree;
    const usedBy = {};
    for (const capped of [true, false]) {
      for (const x of live) {
        if (x.rem <= 0) continue;
        const free = day.capacity - day.used;
        const room = capped ? perSubject - (usedBy[x.l.subject] || 0) : free;
        const take = Math.min(x.rem, free, room, MAX_PER_LESSON_PER_DAY - doneToday(day, x.l));
        if (take <= 0 || (take < MIN_BLOCK && take < x.rem)) continue;
        put(day, x.l, take, 'backlog', false);
        x.rem -= take; usedBy[x.l.subject] = (usedBy[x.l.subject] || 0) + take;
      }
    }
  }

  const deferred = [...deferredNew, ...back.filter(x => x.rem > 0)].map(x => ({ lessonId: x.l.id, subject: x.l.subject, title: x.l.title, kind: isNew(x.l) ? 'new' : 'backlog', minutes: x.rem }));
  const planDays = studyDates.map(d => days.get(d)).map(({ newUsed, ...rest }) => ({ ...rest, sessions: rest.sessions.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'new' ? -1 : 1)) }));
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const scheduled = kind => sum(planDays, d => sum(d.sessions.filter(s => s.kind === kind), s => s.minutes));
  const shortfall = sum(deferred, x => x.minutes);
  const lateNew = new Set(planDays.flatMap(d => d.sessions.filter(s => s.late).map(s => s.lessonId))).size;
  const totalCapacity = sum(planDays, d => d.capacity);

  const warnings = [];
  if (totalCapacity === 0) warnings.push('مفيش وقت مذاكرة محدد، حدد ساعاتك اليومية الأول');
  if (shortfall > 0) warnings.push(`الوقت المتاح مش كفاية لكل حاجة: ناقص حوالي ${Math.ceil(shortfall / 60)} ساعة، رتّبنا الأهم الأول وأجّلنا ${deferred.length} درس، زوّد ساعاتك أو أجّل مواد`);
  if (lateNew > 0) warnings.push(`${lateNew} من الدروس الجديدة اتأخرت عن موعدها لأن الأيام كانت ممتلئة`);
  if (daysLeft < 7) warnings.push('فاضل أقل من أسبوع على نهاية المدة');

  return {
    feasible: shortfall === 0,
    focus,
    summary: {
      today, examDate, daysLeft, studyDays: studyDates.length, reviewDates,
      totalCapacity, backlogMinutes: backlogTotal, newMinutes: newTotal,
      scheduledBacklog: scheduled('backlog'), scheduledNew: scheduled('new'),
      shortfall, coverage: backlogTotal + newTotal === 0 ? 1 : (backlogTotal + newTotal - shortfall) / (backlogTotal + newTotal)
    },
    days: planDays, deferred, warnings
  };
}

module.exports = { planRescue, remainingMinutes, METHOD_LABELS_AR, addDays, diffDays, DEFAULTS, FOCUS_MODES };
