'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/app');
const { createMemoryStore } = require('../src/stores/memoryStore');

let clock = new Date('2026-11-15T10:00:00Z');
const baseConfig = () => ({ port: 0, allowedOrigins: [], tz: 'Africa/Cairo', sessionDays: 30, nodeEnv: 'test', trustProxy: false, now: () => clock, registerLimit: 1000 });
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);

async function boot(configOver = {}) {
  const store = createMemoryStore();
  await store.seed({ subjects: [{ id: 'arabic', name: 'العربي', track: 'literary' }, { id: 'physics', name: 'ف', track: 'science' }], lessons: [{ id: 'ar1', subjectId: 'arabic', title: 'درس رسمي', ord: 1 }] });
  const server = createServer({ store, config: { ...baseConfig(), ...configOver } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { token, body, headers = {}, raw } = {}) => {
    const res = await fetch(base + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    const text = await res.text(); let json; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, headers: res.headers, buf: Buffer.from(text, 'binary') };
  };
  let n = 0;
  const signup = async (over = {}) => { const r = await call('POST', '/api/auth/register', { body: { email: `s${++n}@example.com`, password: 'correct-horse-9', displayName: 'علي', ...over } }); return { ...r, token: r.json?.token }; };
  return { call, signup, store, close: () => new Promise(r => server.close(r)) };
}
const ctx = {};
test.before(async () => { ctx.a = await boot(); });
test.after(async () => { await ctx.a.close(); });

test('health is public', async () => { const r = await ctx.a.call('GET', '/api/health'); assert.deepEqual([r.status, r.json.ok], [200, true]); });

test('register: ok, duplicate (case-insensitive), validation', async () => {
  const { call } = ctx.a;
  const ok = await call('POST', '/api/auth/register', { body: { email: 'Ali@Example.com', password: 'correct-horse-9', displayName: 'علي' } });
  assert.equal(ok.status, 201); assert.ok(ok.json.token.length > 30); assert.equal(ok.json.user.profile.displayName, 'علي');
  assert.ok(!JSON.stringify(ok.json).includes('passwordHash'));
  assert.equal((await call('POST', '/api/auth/register', { body: { email: 'ali@example.com', password: 'correct-horse-9' } })).status, 409);
  assert.equal((await call('POST', '/api/auth/register', { body: { email: 'bad', password: 'correct-horse-9' } })).json.error.code, 'BAD_EMAIL');
  assert.equal((await call('POST', '/api/auth/register', { body: { email: 'x@y.com', password: 'short' } })).json.error.code, 'BAD_PASSWORD');
  assert.equal((await call('POST', '/api/auth/register', { body: { email: 'same@y.com', password: 'same@y.com' } })).json.error.code, 'BAD_PASSWORD');
});

test('login: success, and the same error for wrong password and unknown email', async () => {
  const { call, signup } = ctx.a; const u = await signup({ email: 'login@example.com' });
  assert.equal(u.status, 201);
  const good = await call('POST', '/api/auth/login', { body: { email: 'LOGIN@example.com', password: 'correct-horse-9' } });
  assert.equal(good.status, 200); assert.ok(good.json.token);
  const wrong = await call('POST', '/api/auth/login', { body: { email: 'login@example.com', password: 'nope-nope-nope' } });
  const none = await call('POST', '/api/auth/login', { body: { email: 'ghost@example.com', password: 'nope-nope-nope' } });
  assert.deepEqual([wrong.status, none.status], [401, 401]); assert.deepEqual(wrong.json, none.json);
});

test('auth: /api/me needs a token; logout revokes it; sessions expire', async () => {
  const { call, signup } = ctx.a; const u = await signup();
  assert.equal((await call('GET', '/api/me')).status, 401);
  assert.equal((await call('GET', '/api/me', { token: 'garbage' })).status, 401);
  assert.equal((await call('GET', '/api/me', { token: u.token })).status, 200);
  assert.equal((await call('POST', '/api/auth/logout', { token: u.token })).status, 204);
  assert.equal((await call('GET', '/api/me', { token: u.token })).status, 401);
  const v = await signup(); const saved = clock;
  clock = new Date(clock.getTime() + 31 * 86400000);
  assert.equal((await call('GET', '/api/me', { token: v.token })).status, 401);
  clock = saved;
});

test('rate limit: repeated failed logins get 429', async () => {
  const b = await boot({ registerLimit: 5 }); await b.signup({ email: 'rl@example.com' });
  let last; for (let i = 0; i < 9; i++) last = await b.call('POST', '/api/auth/login', { body: { email: 'rl@example.com', password: 'wrong-wrong-1' } });
  assert.equal(last.status, 429); await b.close();
});

test('profile: validation and update', async () => {
  const { call, signup } = ctx.a; const { token } = await signup();
  assert.equal((await call('PUT', '/api/profile', { token, body: { examDate: '2026-11-01' } })).json.error.code, 'DATE_IN_PAST');
  assert.equal((await call('PUT', '/api/profile', { token, body: { examDate: '2027-02-30' } })).json.error.code, 'BAD_DATE');
  assert.equal((await call('PUT', '/api/profile', { token, body: { track: 'cooking' } })).json.error.code, 'BAD_TRACK');
  const ok = await call('PUT', '/api/profile', { token, body: { displayName: 'Newt', track: 'literary', examDate: '2027-01-20' } });
  assert.deepEqual([ok.status, ok.json.profile.onboarded, ok.json.profile.examDate], [200, true, '2027-01-20']);
});

test('avatar: accepts a real image, rejects fakes and oversize', async () => {
  const { call, signup } = ctx.a; const { token } = await signup();
  const url = 'data:image/png;base64,' + PNG.toString('base64');
  assert.equal((await call('PUT', '/api/profile/avatar', { token, body: { dataUrl: url } })).status, 204);
  const got = await call('GET', '/api/profile/avatar', { token }); assert.equal(got.status, 200); assert.equal(got.headers.get('content-type'), 'image/png');
  const fake = 'data:image/png;base64,' + Buffer.from('this is not an image').toString('base64');
  assert.equal((await call('PUT', '/api/profile/avatar', { token, body: { dataUrl: fake } })).json.error.code, 'BAD_IMAGE');
  assert.equal((await call('PUT', '/api/profile/avatar', { token, body: { dataUrl: 'data:image/svg+xml;base64,AAAA' } })).json.error.code, 'BAD_IMAGE');
  const big = 'data:image/png;base64,' + Buffer.concat([PNG, Buffer.alloc(250000)]).toString('base64');
  assert.equal((await call('PUT', '/api/profile/avatar', { token, body: { dataUrl: big } })).json.error.code, 'IMAGE_TOO_LARGE');
  const huge = 'data:image/png;base64,' + Buffer.concat([PNG, Buffer.alloc(500000)]).toString('base64');
  assert.equal((await call('PUT', '/api/profile/avatar', { token, body: { dataUrl: huge } })).status, 413);
});

test('availability: validated and stored', async () => {
  const { call, signup } = ctx.a; const { token } = await signup();
  assert.equal((await call('PUT', '/api/availability', { token, body: { weekly: { 9: 60 } } })).status, 400);
  assert.equal((await call('PUT', '/api/availability', { token, body: { weekly: { 1: 5000 } } })).status, 400);
  assert.equal((await call('PUT', '/api/availability', { token, body: { weekly: { 1: 60 }, overrides: { 'nope': 10 } } })).status, 400);
  const ok = await call('PUT', '/api/availability', { token, body: { weekly: { 0: 120, 1: 90 }, overrides: { '2026-11-20': 0 } } });
  assert.equal(ok.status, 200); assert.deepEqual(ok.json.weekly, { 0: 120, 1: 90 }); assert.deepEqual((await call('GET', '/api/availability', { token })).json.overrides, { '2026-11-20': 0 });
});

test('lessons: private custom lessons, progress, and track filtering', async () => {
  const { call, signup } = ctx.a; const a = await signup(), b = await signup();
  await call('PUT', '/api/profile', { token: a.token, body: { track: 'literary' } });
  await call('PUT', '/api/profile', { token: b.token, body: { track: 'science' } });
  const made = await call('POST', '/api/lessons', { token: a.token, body: { subjectId: 'arabic', title: 'درسي الخاص', estMinutes: 30 } });
  assert.equal(made.status, 201);
  assert.equal((await call('POST', '/api/lessons', { token: a.token, body: { subjectId: 'nope', title: 'x' } })).json.error.code, 'BAD_SUBJECT');
  assert.equal((await call('POST', '/api/lessons', { token: a.token, body: { subjectId: 'arabic', title: 'x', estMinutes: 1 } })).json.error.code, 'BAD_ESTIMATE');
  const la = (await call('GET', '/api/lessons', { token: a.token })).json.lessons.map(l => l.id), lb = (await call('GET', '/api/lessons', { token: b.token })).json.lessons.map(l => l.id);
  assert.ok(la.includes('ar1') && la.includes(made.json.id)); assert.deepEqual(lb, []);
  assert.equal((await call('PATCH', `/api/lessons/${made.json.id}`, { token: b.token, body: { status: 'done' } })).status, 404);
  assert.equal((await call('DELETE', `/api/lessons/${made.json.id}`, { token: b.token })).status, 404);
  assert.equal((await call('PATCH', '/api/lessons/ar1', { token: a.token, body: { status: 'weird' } })).json.error.code, 'BAD_STATUS');
  assert.equal((await call('PATCH', '/api/lessons/ar1', { token: a.token, body: { status: 'done' } })).status, 204);
  assert.equal((await call('GET', '/api/lessons', { token: a.token })).json.lessons.find(l => l.id === 'ar1').status, 'done');
  assert.equal((await call('DELETE', `/api/lessons/${made.json.id}`, { token: a.token })).status, 204);
});

test('plan: needs an exam date, then builds a real plan from the student data', async () => {
  const { call, signup } = ctx.a; const { token } = await signup();
  assert.equal((await call('GET', '/api/plan', { token })).json.error.code, 'EXAM_DATE_REQUIRED');
  await call('PUT', '/api/profile', { token, body: { track: 'literary', examDate: '2027-01-20' } });
  await call('PUT', '/api/availability', { token, body: { weekly: { 0: 120, 1: 120, 2: 120, 3: 120, 4: 120, 5: 0, 6: 60 } } });
  const mine = await call('POST', '/api/lessons', { token, body: { subjectId: 'arabic', title: 'درس متراكم', estMinutes: 60 } });
  await call('PATCH', '/api/lessons/ar1', { token, body: { status: 'done' } });
  const plan = await call('GET', '/api/plan', { token });
  assert.equal(plan.status, 200); assert.equal(plan.json.days[0].date, '2026-11-15'); assert.equal(plan.json.feasible, true);
  const ids = plan.json.days.flatMap(d => d.sessions.map(s => s.lessonId));
  assert.ok(ids.includes(mine.json.id)); assert.ok(!ids.includes('ar1'), 'done lessons are not planned');
  assert.equal(plan.json.focus, 'balanced');
  assert.equal((await call('GET', '/api/plan?focus=whatever', { token })).json.error.code, 'BAD_FOCUS');
  const nearest = await call('GET', '/api/plan?focus=nearest', { token });
  assert.equal(nearest.status, 200); assert.equal(nearest.json.focus, 'nearest');
  assert.deepEqual([...new Set(nearest.json.days.flatMap(d => d.sessions.map(s => s.lessonId)))].sort(), [...new Set(ids)].sort(), 'same lessons, different order');
});

test('study sessions: validated, totals returned', async () => {
  const { call, signup } = ctx.a; const { token } = await signup();
  assert.equal((await call('POST', '/api/study-sessions', { token, body: { minutes: 0 } })).status, 400);
  assert.equal((await call('POST', '/api/study-sessions', { token, body: { minutes: 25, studiedOn: '2026-11-20' } })).json.error.code, 'BAD_DATE');
  const ok = await call('POST', '/api/study-sessions', { token, body: { minutes: 25 } });
  assert.deepEqual([ok.status, ok.json.totalMinutes, ok.json.activeDays], [201, 25, 1]);
});

test('http hygiene: 404/405, content-type, body size, bad json, no stack leaks', async () => {
  const { call, signup } = ctx.a; const { token } = await signup();
  assert.equal((await call('GET', '/api/nothing', { token })).status, 404);
  assert.equal((await call('DELETE', '/api/me', { token })).status, 405);
  assert.equal((await call('PUT', '/api/profile', { token, raw: '{"displayName":"x"}', headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await call('PUT', '/api/profile', { token, raw: '{oops', headers: { 'Content-Type': 'application/json' } })).json.error.code, 'BAD_JSON');
  assert.equal((await call('PUT', '/api/profile', { token, body: { displayName: 'x'.repeat(40000) } })).status, 413);
  const r = await call('GET', '/api/me', { token }); assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('CORS: production only allows listed origins', async () => {
  const b = await boot({ nodeEnv: 'production', allowedOrigins: ['https://lam.pages.dev'] });
  const good = await b.call('OPTIONS', '/api/me', { headers: { Origin: 'https://lam.pages.dev' } });
  assert.equal(good.status, 204); assert.equal(good.headers.get('access-control-allow-origin'), 'https://lam.pages.dev');
  const evil = await b.call('OPTIONS', '/api/me', { headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null); await b.close();
});

test('rate limit: too many registrations from one address get 429', async () => {
  const b = await boot({ registerLimit: 5 }); let last;
  for (let i = 0; i < 6; i++) last = await b.call('POST', '/api/auth/register', { body: { email: `r${i}@example.com`, password: 'correct-horse-9' } });
  assert.equal(last.status, 429); await b.close();
});
