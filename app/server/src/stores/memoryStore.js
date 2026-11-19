'use strict';
// In-memory store: for tests and local dev without a database. Same behaviour contract as pgStore.
const crypto = require('node:crypto');
const err = code => Object.assign(new Error(code), { code });

function createMemoryStore() {
  const users = new Map(), byEmail = new Map(), sessions = new Map(), profiles = new Map(), avail = new Map();
  const subjects = new Map(), lessons = new Map(), userLessons = new Map(), userSubjects = new Map(), sessionsLog = [];
  const ul = (u, l) => userLessons.get(u + '|' + l);
  const visible = (userId, l) => {
    if (l.ownerId) return l.ownerId === userId;
    const s = subjects.get(l.subjectId), profile = profiles.get(userId), track = profile?.track ?? null;
    if (!s) return false;
    if (s.optional && profile?.secondLanguage !== s.id) return false;
    return track === null || s.track === null || s.track === track;
  };
  return {
    kind: 'memory',
    async seed({ subjects: ss = [], lessons: ls = [] }) {
      ss.forEach(s => subjects.set(s.id, { id: s.id, name: s.name, track: s.track ?? null, optional: !!s.optional }));
      ls.forEach(l => lessons.set(l.id, {
        id: l.id, subjectId: l.subjectId, title: l.title, ord: l.ord ?? 1,
        estMinutes: l.estMinutes ?? 45, releaseDate: l.releaseDate ?? null,
        unitTitle: l.unitTitle ?? null, page: l.page ?? null, ownerId: null
      }));
    },
    async createUser({ email, passwordHash, displayName = '' }) {
      const key = email.toLowerCase(); if (byEmail.has(key)) throw err('EMAIL_TAKEN');
      const u = { id: crypto.randomUUID(), email, passwordHash }; users.set(u.id, u); byEmail.set(key, u.id);
      profiles.set(u.id, { displayName, track: null, examDate: null, secondLanguage: null, avatar: null, onboarded: false });
      return { id: u.id, email };
    },
    async getUserByEmail(email) { const id = byEmail.get(email.toLowerCase()); return id ? { ...users.get(id) } : null; },
    async getUserById(id) { const u = users.get(id); return u ? { id: u.id, email: u.email } : null; },
    async createSession({ userId, tokenHash, expiresAt }) { sessions.set(tokenHash, { userId, expiresAt: new Date(expiresAt) }); },
    async getSession(tokenHash, now = new Date()) { const s = sessions.get(tokenHash); return s && s.expiresAt > now ? { userId: s.userId } : null; },
    async deleteSession(tokenHash) { sessions.delete(tokenHash); },
    async getProfile(userId) {
      const p = profiles.get(userId);
      return p && { displayName: p.displayName, track: p.track, examDate: p.examDate, secondLanguage: p.secondLanguage, hasAvatar: !!p.avatar, onboarded: p.onboarded };
    },
    async updateProfile(userId, patch) {
      const p = profiles.get(userId);
      if (patch.displayName !== undefined) p.displayName = patch.displayName;
      if (patch.track !== undefined) p.track = patch.track;
      if (patch.examDate !== undefined) p.examDate = patch.examDate;
      if (patch.secondLanguage !== undefined) p.secondLanguage = patch.secondLanguage;
      p.onboarded = p.onboarded || (!!p.track && !!p.examDate);
    },
    async setAvatar(userId, { data, mime }) { profiles.get(userId).avatar = { data: Buffer.from(data), mime }; },
    async getAvatar(userId) { return profiles.get(userId)?.avatar ?? null; },
    async getAvailability(userId) { const a = avail.get(userId) || { weekly: {}, overrides: {} }; return { weekly: { ...a.weekly }, overrides: { ...a.overrides } }; },
    async setAvailability(userId, { weekly, overrides }) { avail.set(userId, { weekly: { ...weekly }, overrides: { ...overrides } }); },
    async subjectExists(id) { return subjects.has(id); },
    async listSubjects(userId) {
      const profile = profiles.get(userId), track = profile?.track ?? null, lang = profile?.secondLanguage ?? null;
      return [...subjects.values()]
        .filter(s => (track === null || s.track === null || s.track === track) && (!s.optional || lang === s.id))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(s => { const us = userSubjects.get(userId + '|' + s.id); return { id: s.id, name: s.name, track: s.track, optional: s.optional, weakness: us?.weakness ?? 2, examDate: us?.examDate ?? null }; });
    },
    async setUserSubject(userId, subjectId, { weakness, examDate }) { userSubjects.set(userId + '|' + subjectId, { weakness, examDate }); },
    async listLessons(userId) {
      return [...lessons.values()].filter(l => visible(userId, l)).sort((a, b) => a.subjectId.localeCompare(b.subjectId) || a.ord - b.ord || a.id.localeCompare(b.id))
        .map(l => { const x = ul(userId, l.id); return { id: l.id, subjectId: l.subjectId, title: l.title, ord: l.ord, estMinutes: x?.estOverride ?? l.estMinutes, releaseDate: l.releaseDate, status: x?.status ?? 'not_started', custom: !!l.ownerId, unitTitle: l.unitTitle ?? null, page: l.page ?? null }; });
    },
    async createCustomLesson(userId, { subjectId, title, estMinutes, releaseDate }) {
      const ord = Math.max(0, ...[...lessons.values()].filter(l => l.ownerId === userId && l.subjectId === subjectId).map(l => l.ord)) + 1;
      const id = 'u_' + crypto.randomUUID(); lessons.set(id, { id, subjectId, title, ord, estMinutes, releaseDate: releaseDate ?? null, unitTitle: null, page: null, ownerId: userId }); return id;
    },
    async deleteCustomLesson(userId, id) { const l = lessons.get(id); if (!l || l.ownerId !== userId) return false; lessons.delete(id); return true; },
    async updateUserLesson(userId, lessonId, { status, estOverride }) {
      const l = lessons.get(lessonId); if (!l || !visible(userId, l)) return false;
      const k = userId + '|' + lessonId, cur = userLessons.get(k) || { status: 'not_started', estOverride: null, completedAt: null };
      if (status !== undefined) { cur.status = status; cur.completedAt = status === 'done' ? (cur.completedAt || new Date()) : null; }
      if (estOverride !== undefined) cur.estOverride = estOverride;
      userLessons.set(k, cur); return true;
    },
    async addStudySession(userId, { lessonId = null, minutes, studiedOn }) { sessionsLog.push({ userId, lessonId, minutes, studiedOn }); },
    async studyTotals(userId) { const m = sessionsLog.filter(s => s.userId === userId); return { totalMinutes: m.reduce((s, x) => s + x.minutes, 0), activeDays: new Set(m.map(x => x.studiedOn)).size }; },
    async close() {}
  };
}
module.exports = { createMemoryStore };
