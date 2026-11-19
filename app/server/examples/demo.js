'use strict';
// DEMO DATA ONLY: placeholder lessons, NOT the real curriculum. Exam date is made up.
const { planRescue, addDays, METHOD_LABELS_AR } = require('../src/rescuePlan');
const names = { stat: 'الإحصاء', hist: 'التاريخ', eng: 'الإنجليزي', geo: 'الجغرافيا', ar: 'العربي' };
const TODAY = '2026-11-15';
const lessons = [];
for (const s of Object.keys(names)) for (let i = 1; i <= 10; i++) {
  lessons.push({ id: `${s}-b${i}`, subject: s, title: `${names[s]} - درس تجريبي ${i}`, status: i <= 2 ? 'in_progress' : 'not_started', estMinutes: 45, order: i, releaseDate: addDays('2026-10-01', i * 3) });
  if (i <= 6) lessons.push({ id: `${s}-n${i}`, subject: s, title: `${names[s]} - درس جديد ${i}`, status: 'not_started', estMinutes: 45, order: 10 + i, releaseDate: addDays(TODAY, i * 7) });
}
const subjects = { stat: { weakness: 3 }, eng: { weakness: 3 } };
const base = { today: TODAY, examDate: '2027-01-20', overrides: {}, lessons, subjects };
const show = (title, input) => {
  const p = planRescue(input), s = p.summary;
  console.log(`\n=== ${title} ===`);
  console.log(`الأيام المتبقية: ${s.daysLeft} | المتراكم: ${Math.round(s.backlogMinutes / 60)} ساعة | الجديد: ${Math.round(s.newMinutes / 60)} ساعة | وقتك: ${Math.round(s.totalCapacity / 60)} ساعة`);
  console.log(p.feasible ? 'النتيجة: الخطة كفاية وكل حاجة متغطية' : `النتيجة: ناقص ${Math.ceil(s.shortfall / 60)} ساعة، اتأجل ${p.deferred.length} درس`);
  p.warnings.forEach(w => console.log('تنبيه:', w));
  for (const d of p.days.slice(0, 3)) {
    console.log(`  ${d.date} (${d.used}/${d.capacity} دقيقة)`);
    d.sessions.forEach(x => console.log(`    ${x.kind === 'new' ? '[جديد]' : '[متراكم]'} ${x.title} — ${x.minutes} د — ${METHOD_LABELS_AR[x.method]}`));
  }
};
show('وقت كافي: 2.5 ساعة يوميًا', { ...base, weekly: { 0: 150, 1: 150, 2: 150, 3: 150, 4: 150, 5: 0, 6: 90 } });
show('وقت قليل: ساعة يوميًا', { ...base, weekly: { 0: 60, 1: 60, 2: 60, 3: 60, 4: 60, 5: 0, 6: 0 } });
