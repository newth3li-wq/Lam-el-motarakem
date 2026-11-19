'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { planRescue, addDays, remainingMinutes } = require('../src/rescuePlan');

const TODAY = '2026-11-15';
const weekly = n => ({ 0: n, 1: n, 2: n, 3: n, 4: n, 5: n, 6: n });
const L = (id, subject, o = {}) => ({ id, subject, title: id, status: 'not_started', estMinutes: 45, order: 1, ...o });
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const sessions = p => p.days.flatMap(d => d.sessions.map(s => ({ ...s, date: d.date })));

function checkInvariants(p, input) {
  for (const d of p.days) assert.ok(d.used <= d.capacity, `day ${d.date} over capacity`);
  for (const d of p.days) assert.equal(d.used, sum(d.sessions, s => s.minutes));
  const demand = p.summary.backlogMinutes + p.summary.newMinutes;
  assert.equal(p.summary.scheduledBacklog + p.summary.scheduledNew + p.summary.shortfall, demand, 'minutes must be conserved');
  const byId = Object.fromEntries(input.lessons.map(l => [l.id, l]));
  for (const s of sessions(p)) {
    if (s.kind === 'new') assert.ok(s.date >= byId[s.lessonId].releaseDate, 'new lesson placed before release');
    const end = (input.subjects?.[s.subject]?.examDate) || input.examDate;
    assert.ok(s.date < end, 'session on/after exam date');
  }
}

test('enough time: everything is scheduled, nothing deferred', () => {
  const input = { today: TODAY, examDate: '2027-01-15', weekly: weekly(120), lessons: [L('a', 'math'), L('b', 'math'), L('c', 'arabic')] };
  const p = planRescue(input);
  assert.equal(p.feasible, true); assert.equal(p.deferred.length, 0); assert.equal(p.warnings.length, 0);
  checkInvariants(p, input);
});

test('new lessons are protected even with a huge backlog', () => {
  const backlog = Array.from({ length: 200 }, (_, i) => L('b' + i, i % 2 ? 'a' : 'b', { order: i }));
  const release = addDays(TODAY, 3);
  const input = { today: TODAY, examDate: '2027-03-01', weekly: weekly(150), lessons: [...backlog, L('new1', 'a', { releaseDate: release })] };
  const p = planRescue(input);
  const s = sessions(p).find(x => x.lessonId === 'new1');
  assert.ok(s, 'new lesson must be scheduled'); assert.equal(s.kind, 'new'); assert.equal(s.late, false);
  assert.ok(s.date >= release && s.date <= addDays(release, 2));
  checkInvariants(p, input);
});

test('not enough time: reports the shortfall honestly, still protects the new', () => {
  const backlog = Array.from({ length: 100 }, (_, i) => L('b' + i, 'a', { order: i }));
  const input = { today: TODAY, examDate: addDays(TODAY, 20), weekly: weekly(30), lessons: [...backlog, L('n', 'a', { releaseDate: addDays(TODAY, 2) })] };
  const p = planRescue(input);
  assert.equal(p.feasible, false); assert.ok(p.summary.shortfall > 0);
  assert.ok(p.deferred.length > 0); assert.ok(p.warnings.some(w => w.includes('مش كفاية')));
  assert.ok(sessions(p).some(s => s.lessonId === 'n' && s.kind === 'new'), 'new lesson still scheduled');
  checkInvariants(p, input);
});

test('re-plan after missed days: the plan restarts from the new today', () => {
  const lessons = [L('b1', 'a'), L('b2', 'b'), L('n1', 'a', { releaseDate: addDays(TODAY, 1) })];
  const base = { examDate: '2027-02-01', weekly: weekly(120), lessons };
  const later = addDays(TODAY, 3);
  const p = planRescue({ ...base, today: later });
  assert.equal(p.days[0].date, later);
  assert.ok(sessions(p).every(s => s.date >= later));
  assert.equal(sessions(p).find(s => s.lessonId === 'n1').kind, 'backlog', 'missed new lesson becomes backlog');
  checkInvariants(p, { ...base, today: later });
});

test('interleaving: two subjects with backlog both appear on day one', () => {
  const lessons = [...Array.from({ length: 20 }, (_, i) => L('x' + i, 'x', { order: i })), ...Array.from({ length: 20 }, (_, i) => L('y' + i, 'y', { order: i }))];
  const p = planRescue({ today: TODAY, examDate: '2027-03-01', weekly: weekly(120), lessons });
  assert.deepEqual([...new Set(p.days[0].sessions.map(s => s.subject))].sort(), ['x', 'y']);
});

test('priority: earlier subject exam date comes first', () => {
  const input = { today: TODAY, examDate: '2027-03-01', weekly: weekly(45), subjects: { early: { examDate: '2026-12-20' } }, lessons: [L('late1', 'late'), L('early1', 'early')] };
  const p = planRescue(input);
  assert.equal(p.days[0].sessions[0].subject, 'early');
});

test('focus=nearest follows the book order instead of the exam date', () => {
  const subjects = { first: { priority: 0, examDate: '2027-02-20' }, second: { priority: 1, examDate: '2026-12-01' } };
  const lessons = [L('s1', 'second'), L('f1', 'first')];
  const balanced = planRescue({ today: TODAY, examDate: '2027-03-01', weekly: weekly(45), subjects, lessons });
  const nearest = planRescue({ today: TODAY, examDate: '2027-03-01', weekly: weekly(45), subjects, lessons, focus: 'nearest' });
  assert.equal(balanced.days[0].sessions[0].subject, 'second', 'balanced starts with the earlier exam');
  assert.equal(nearest.days[0].sessions[0].subject, 'first', 'nearest starts with the earlier subject in the book');
  assert.equal(nearest.focus, 'nearest');
});

test('focus=backlog starts with the subject that has the biggest backlog', () => {
  const subjects = { big: { priority: 0, examDate: '2027-02-20' }, small: { priority: 1, examDate: '2026-12-01' } };
  const lessons = [
    ...Array.from({ length: 8 }, (_, i) => L('big' + i, 'big', { order: i, estMinutes: 60 })),
    L('small1', 'small')
  ];
  const balanced = planRescue({ today: TODAY, examDate: '2027-03-01', weekly: weekly(45), subjects, lessons });
  const backlog = planRescue({ today: TODAY, examDate: '2027-03-01', weekly: weekly(45), subjects, lessons, focus: 'backlog' });
  assert.equal(balanced.days[0].sessions[0].subject, 'small', 'balanced starts with the earlier exam');
  assert.equal(backlog.days[0].sessions[0].subject, 'big', 'backlog starts with the heaviest subject');
  assert.equal(backlog.focus, 'backlog');
});

test('unknown focus falls back to balanced, and every mode is deterministic', () => {
  const input = { today: TODAY, examDate: '2027-03-01', weekly: weekly(120), lessons: [L('a1', 'a', { order: 0 }), L('b1', 'b', { order: 0 })] };
  assert.equal(planRescue({ ...input, focus: 'whatever' }).focus, 'balanced');
  for (const focus of ['balanced', 'backlog', 'nearest']) {
    assert.deepEqual(planRescue({ ...input, focus }), planRescue({ ...input, focus }));
  }
});

test('done lessons cost nothing; in-progress cost about half', () => {
  assert.equal(remainingMinutes(L('d', 's', { status: 'done' })), 0);
  assert.equal(remainingMinutes(L('p', 's', { status: 'in_progress', estMinutes: 60 })), 30);
});

test('exam not in the future returns an error, no plan', () => {
  assert.equal(planRescue({ today: TODAY, examDate: TODAY, lessons: [] }).error, 'EXAM_NOT_IN_FUTURE');
});

test('zero availability: warns instead of pretending', () => {
  const p = planRescue({ today: TODAY, examDate: '2027-01-01', weekly: {}, lessons: [L('a', 's')] });
  assert.equal(p.feasible, false); assert.ok(p.warnings[0].includes('وقت'));
});

test('property: 300 random scenarios keep every invariant', () => {
  let seed = 12345; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  for (let i = 0; i < 300; i++) {
    const subjectsList = ['a', 'b', 'c', 'd'].slice(0, ri(1, 4));
    const examIn = ri(2, 120);
    const lessons = Array.from({ length: ri(0, 60) }, (_, k) => L('l' + k, subjectsList[ri(0, subjectsList.length - 1)], {
      order: k, estMinutes: ri(10, 150), status: ['not_started', 'in_progress', 'done'][ri(0, 2)],
      releaseDate: rnd() < 0.5 ? addDays(TODAY, ri(-30, examIn + 5)) : undefined
    }));
    const subjects = {}; for (const s of subjectsList) if (rnd() < 0.3) subjects[s] = { weakness: ri(1, 3), examDate: addDays(TODAY, ri(1, examIn)) };
    const w = {}; for (let d = 0; d < 7; d++) w[d] = ri(0, 240);
    const input = { today: TODAY, examDate: addDays(TODAY, examIn), weekly: w, lessons, subjects, overrides: rnd() < 0.3 ? { [addDays(TODAY, 1)]: 0 } : {}, focus: ['balanced', 'backlog', 'nearest'][ri(0, 2)] };
    const p = planRescue(input);
    if (p.error) continue;
    checkInvariants(p, input);
  }
});
