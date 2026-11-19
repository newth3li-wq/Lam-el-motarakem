export const TRACK_LABELS = {
  literary: 'أدبي',
  science: 'علمي علوم',
  math: 'علمي رياضة'
};

export const STATUS_LABELS = {
  not_started: 'لسه مابدأتش',
  in_progress: 'شغّال عليه',
  done: 'خلصته'
};

export const METHOD_LABELS = {
  summarize_after_class: 'لخّص الدرس بكلامك بعد الحصة',
  understand_then_recall: 'افهم الدرس ثم سمّعه لنفسك من غير ما تبص',
  practice_questions: 'كمّل بحل أسئلة على الدرس'
};

export const WEAKNESS_LABELS = {
  1: 'متمكن',
  2: 'متوسط',
  3: 'محتاج شغل'
};

export function hoursLabel(minutes) {
  if (!minutes) return '0 ساعة';
  const h = minutes / 60;
  if (h < 1) return `${Math.round(minutes)} دقيقة`;
  const rounded = Math.round(h * 10) / 10;
  return `${rounded} ساعة`;
}

export function pct(part, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export function formatDay(dateStr, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  try {
    return new Intl.DateTimeFormat('ar-EG-u-nu-latn', opts).format(d);
  } catch {
    return dateStr;
  }
}

export function formatDate(dateStr) {
  return formatDay(dateStr, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function todayISO() {
  return new Date().toLocaleDateString('sv-SE');
}

export function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('sv-SE');
}

export function subjectMap(subjects = []) {
  return Object.fromEntries(subjects.map((s) => [s.id, s]));
}
