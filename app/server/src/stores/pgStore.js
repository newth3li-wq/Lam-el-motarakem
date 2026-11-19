'use strict';
// PostgreSQL store (Neon / Supabase / any Postgres 13+). Tables: db/schema.sql
const err = code => Object.assign(new Error(code), { code });
const VISIBLE = `(l.owner_id is null and ($2::track is null or s.track is null or s.track = $2::track) and (not s.optional or s.id = $3)) or l.owner_id = $1`;

function createPgStore(databaseUrl) {
  const pg = require('pg');
  pg.types.setTypeParser(1082, v => v);               // DATE -> 'YYYY-MM-DD' string, no timezone shifting
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
  const q = (text, params) => pool.query(text, params);
  const profileOf = async userId => (await q('select track, second_language as "secondLanguage" from profiles where user_id=$1', [userId])).rows[0] || { track: null, secondLanguage: null };

  return {
    kind: 'pg', _pool: pool,
    async createUser({ email, passwordHash, displayName = '' }) {
      try {
        const { rows } = await q(`with u as (insert into users(email,password_hash) values ($1,$2) returning id,email),
          p as (insert into profiles(user_id,display_name) select id,$3 from u) select id,email from u`, [email, passwordHash, displayName]);
        return rows[0];
      } catch (e) { if (e.code === '23505') throw err('EMAIL_TAKEN'); throw e; }
    },
    async getUserByEmail(email) { const { rows } = await q('select id,email,password_hash as "passwordHash" from users where lower(email)=lower($1)', [email]); return rows[0] || null; },
    async getUserById(id) { const { rows } = await q('select id,email from users where id=$1', [id]); return rows[0] || null; },
    async createSession({ userId, tokenHash, expiresAt }) { await q('insert into auth_sessions(user_id,token_hash,expires_at) values ($1,$2,$3)', [userId, tokenHash, expiresAt]); },
    async getSession(tokenHash, now = new Date()) { const { rows } = await q('select user_id as "userId" from auth_sessions where token_hash=$1 and expires_at>$2', [tokenHash, now]); return rows[0] || null; },
    async deleteSession(tokenHash) { await q('delete from auth_sessions where token_hash=$1', [tokenHash]); },
    async getProfile(userId) {
      const { rows } = await q('select display_name as "displayName", track, exam_date as "examDate", second_language as "secondLanguage", (avatar_data is not null) as "hasAvatar", (onboarded_at is not null) as onboarded from profiles where user_id=$1', [userId]);
      return rows[0] || null;
    },
    async updateProfile(userId, { displayName, track, examDate, secondLanguage }) {
      await q(`update profiles set display_name=$2, track=$3::track, exam_date=$4::date, second_language=$5,
        onboarded_at = coalesce(onboarded_at, case when $3::track is not null and $4::date is not null then now() end), updated_at=now() where user_id=$1`, [userId, displayName, track, examDate, secondLanguage]);
    },
    async setAvatar(userId, { data, mime }) { await q('update profiles set avatar_data=$2, avatar_mime=$3, updated_at=now() where user_id=$1', [userId, data, mime]); },
    async getAvatar(userId) { const { rows } = await q('select avatar_data as data, avatar_mime as mime from profiles where user_id=$1 and avatar_data is not null', [userId]); return rows[0] || null; },
    async getAvailability(userId) {
      const [w, o] = await Promise.all([q('select weekday,minutes from availability where user_id=$1', [userId]), q('select day,minutes from availability_overrides where user_id=$1', [userId])]);
      return { weekly: Object.fromEntries(w.rows.map(r => [r.weekday, r.minutes])), overrides: Object.fromEntries(o.rows.map(r => [r.day, r.minutes])) };
    },
    async setAvailability(userId, { weekly, overrides }) {
      const c = await pool.connect();
      try {
        await c.query('begin');
        await c.query('delete from availability where user_id=$1', [userId]);
        await c.query('delete from availability_overrides where user_id=$1', [userId]);
        const wk = Object.keys(weekly), od = Object.keys(overrides);
        if (wk.length) await c.query('insert into availability(user_id,weekday,minutes) select $1, * from unnest($2::smallint[], $3::int[])', [userId, wk.map(Number), wk.map(k => weekly[k])]);
        if (od.length) await c.query('insert into availability_overrides(user_id,day,minutes) select $1, * from unnest($2::date[], $3::int[])', [userId, od, od.map(k => overrides[k])]);
        await c.query('commit');
      } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
    },
    async subjectExists(id) { return (await q('select 1 from subjects where id=$1', [id])).rowCount > 0; },
    async listSubjects(userId) {
      const { track, secondLanguage } = await profileOf(userId);
      const { rows } = await q(`select s.id, s.name, s.track, s.optional, coalesce(us.weakness,2) as weakness, us.exam_date as "examDate"
        from subjects s left join user_subjects us on us.subject_id=s.id and us.user_id=$1
        where ($2::track is null or s.track is null or s.track=$2::track)
          and (not s.optional or s.id=$3) order by s.id`, [userId, track, secondLanguage]);
      return rows;
    },
    async setUserSubject(userId, subjectId, { weakness, examDate }) {
      await q(`insert into user_subjects(user_id,subject_id,weakness,exam_date) values ($1,$2,$3,$4::date)
        on conflict (user_id,subject_id) do update set weakness=excluded.weakness, exam_date=excluded.exam_date`, [userId, subjectId, weakness, examDate]);
    },
    async listLessons(userId) {
      const { track, secondLanguage } = await profileOf(userId);
      const { rows } = await q(`select l.id, l.subject_id as "subjectId", l.title, l.ord, coalesce(ul.est_override,l.est_minutes) as "estMinutes",
          l.release_date as "releaseDate", l.book_page as page, coalesce(ul.status,'not_started')::text as status,
          (l.owner_id is not null) as custom, u.title as "unitTitle"
        from lessons l join subjects s on s.id=l.subject_id
        left join units u on u.id=l.unit_id
        left join user_lessons ul on ul.lesson_id=l.id and ul.user_id=$1
        where ${VISIBLE} order by l.subject_id, l.ord, l.id`, [userId, track, secondLanguage]);
      return rows;
    },
    async createCustomLesson(userId, { subjectId, title, estMinutes, releaseDate }) {
      const { rows } = await q(`insert into lessons(id,subject_id,title,ord,est_minutes,release_date,owner_id)
        values ('u_'||gen_random_uuid()::text, $2, $3, coalesce((select max(ord)+1 from lessons where subject_id=$2 and owner_id=$1),1), $4, $5::date, $1) returning id`,
        [userId, subjectId, title, estMinutes, releaseDate]);
      return rows[0].id;
    },
    async deleteCustomLesson(userId, id) { return (await q('delete from lessons where id=$2 and owner_id=$1', [userId, id])).rowCount > 0; },
    async updateUserLesson(userId, lessonId, { status, estOverride }) {
      const { track, secondLanguage } = await profileOf(userId);
      const vis = await q(`select 1 from lessons l join subjects s on s.id=l.subject_id where l.id=$4 and
        ((l.owner_id is null and ($2::track is null or s.track is null or s.track=$2::track) and (not s.optional or s.id=$3)) or l.owner_id=$1)`,
      [userId, track, secondLanguage, lessonId]);
      if (!vis.rowCount) return false;
      await q(`insert into user_lessons(user_id,lesson_id,status,est_override,completed_at)
        values ($1,$2, coalesce($3::lesson_status,'not_started'), $4::int, case when $3::lesson_status='done' then now() end)
        on conflict (user_id,lesson_id) do update set
          status = coalesce($3::lesson_status, user_lessons.status),
          est_override = case when $5::boolean then $4::int else user_lessons.est_override end,
          completed_at = case when coalesce($3::lesson_status, user_lessons.status)='done' then coalesce(user_lessons.completed_at, now()) else null end,
          updated_at = now()`, [userId, lessonId, status ?? null, estOverride ?? null, estOverride !== undefined]);
      return true;
    },
    async addStudySession(userId, { lessonId = null, minutes, studiedOn }) { await q('insert into study_sessions(user_id,lesson_id,minutes,studied_on) values ($1,$2,$3,$4::date)', [userId, lessonId, minutes, studiedOn]); },
    async studyTotals(userId) { const { rows } = await q('select coalesce(sum(minutes),0)::int as "totalMinutes", count(distinct studied_on)::int as "activeDays" from study_sessions where user_id=$1', [userId]); return rows[0]; },
    async close() { await pool.end(); }
  };
}
module.exports = { createPgStore };
