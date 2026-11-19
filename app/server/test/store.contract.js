'use strict';
// Behaviour contract every store must satisfy. Run against memory by default, and against PostgreSQL with DATABASE_URL.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

module.exports = function runContract(label, { make, seed, cleanup }) {
  const uid = () => crypto.randomBytes(4).toString('hex');
  const ids = { litSub: 'ct_lit_' + uid(), sciSub: 'ct_sci_' + uid(), litL: 'ct_ll_' + uid(), sciL: 'ct_sl_' + uid() };
  let store; const emails = [];
  const mkUser = async (tag = '') => { const email = `ct_${uid()}${tag}@example.com`; emails.push(email); return store.createUser({ email, passwordHash: 'h', displayName: 'x' }); };

  test(`[${label}] setup`, async () => { store = await make(); await seed(store, ids); });

  test(`[${label}] duplicate email is rejected, case-insensitively`, async () => {
    const u = await mkUser();
    await assert.rejects(store.createUser({ email: emails.at(-1).toUpperCase(), passwordHash: 'h' }), e => e.code === 'EMAIL_TAKEN');
    assert.equal((await store.getUserByEmail(emails.at(-1).toUpperCase())).id, u.id);
  });
  test(`[${label}] sessions respect expiry and deletion`, async () => {
    const u = await mkUser(), now = new Date();
    await store.createSession({ userId: u.id, tokenHash: 'ok_' + uid(), expiresAt: new Date(now.getTime() + 60000) });
    const h1 = 'a_' + uid(), h2 = 'b_' + uid();
    await store.createSession({ userId: u.id, tokenHash: h1, expiresAt: new Date(now.getTime() + 60000) });
    await store.createSession({ userId: u.id, tokenHash: h2, expiresAt: new Date(now.getTime() - 1000) });
    assert.equal((await store.getSession(h1, now)).userId, u.id);
    assert.equal(await store.getSession(h2, now), null);
    await store.deleteSession(h1); assert.equal(await store.getSession(h1, now), null);
  });
  test(`[${label}] profile: onboarded only when track and exam date are set; avatar round-trips`, async () => {
    const u = await mkUser();
    assert.equal((await store.getProfile(u.id)).onboarded, false);
    await store.updateProfile(u.id, { displayName: 'علي', track: 'literary', examDate: null });
    assert.equal((await store.getProfile(u.id)).onboarded, false);
    await store.updateProfile(u.id, { displayName: 'علي', track: 'literary', examDate: '2027-01-20' });
    const p = await store.getProfile(u.id);
    assert.deepEqual([p.displayName, p.track, p.examDate, p.onboarded, p.hasAvatar], ['علي', 'literary', '2027-01-20', true, false]);
    await store.setAvatar(u.id, { data: Buffer.from([1, 2, 3]), mime: 'image/png' });
    const a = await store.getAvatar(u.id); assert.equal(a.mime, 'image/png'); assert.deepEqual([...a.data], [1, 2, 3]);
  });
  test(`[${label}] availability is replaced as a whole`, async () => {
    const u = await mkUser();
    await store.setAvailability(u.id, { weekly: { 0: 120, 1: 60 }, overrides: { '2026-12-01': 0 } });
    await store.setAvailability(u.id, { weekly: { 2: 90 }, overrides: {} });
    const a = await store.getAvailability(u.id);
    assert.deepEqual(Object.fromEntries(Object.entries(a.weekly).map(([k, v]) => [k, v])), { 2: 90 }); assert.deepEqual(a.overrides, {});
  });
  test(`[${label}] lessons: visibility by track, custom lessons are private`, async () => {
    const a = await mkUser('a'), b = await mkUser('b');
    await store.updateProfile(a.id, { displayName: '', track: 'literary', examDate: null });
    await store.updateProfile(b.id, { displayName: '', track: 'science', examDate: null });
    const cid = await store.createCustomLesson(a.id, { subjectId: ids.litSub, title: 'درسي', estMinutes: 30, releaseDate: null });
    const la = (await store.listLessons(a.id)).map(l => l.id), lb = (await store.listLessons(b.id)).map(l => l.id);
    assert.ok(la.includes(ids.litL) && la.includes(cid) && !la.includes(ids.sciL));
    assert.ok(lb.includes(ids.sciL) && !lb.includes(ids.litL) && !lb.includes(cid));
    assert.equal(await store.updateUserLesson(b.id, cid, { status: 'done' }), false);
    assert.equal(await store.deleteCustomLesson(b.id, cid), false);
    assert.equal(await store.deleteCustomLesson(a.id, cid), true);
  });
  test(`[${label}] lesson progress: upsert, estimate override, clearing`, async () => {
    const u = await mkUser(); await store.updateProfile(u.id, { displayName: '', track: 'literary', examDate: null });
    const get = async () => (await store.listLessons(u.id)).find(l => l.id === ids.litL);
    assert.equal((await get()).status, 'not_started');
    assert.equal(await store.updateUserLesson(u.id, ids.litL, { status: 'in_progress' }), true);
    await store.updateUserLesson(u.id, ids.litL, { estOverride: 20 });
    let l = await get(); assert.deepEqual([l.status, l.estMinutes], ['in_progress', 20]);
    await store.updateUserLesson(u.id, ids.litL, { status: 'done' });
    l = await get(); assert.deepEqual([l.status, l.estMinutes], ['done', 20]);
    await store.updateUserLesson(u.id, ids.litL, { estOverride: null });
    assert.equal((await get()).estMinutes, 45);
    assert.equal(await store.updateUserLesson(u.id, 'does-not-exist', { status: 'done' }), false);
  });
  test(`[${label}] study totals`, async () => {
    const u = await mkUser();
    await store.addStudySession(u.id, { minutes: 25, studiedOn: '2026-11-14' });
    await store.addStudySession(u.id, { minutes: 35, studiedOn: '2026-11-14' });
    await store.addStudySession(u.id, { minutes: 10, studiedOn: '2026-11-15' });
    assert.deepEqual(await store.studyTotals(u.id), { totalMinutes: 70, activeDays: 2 });
  });
  test(`[${label}] teardown`, async () => { if (cleanup) await cleanup(store, ids, emails); await store.close(); });
};
