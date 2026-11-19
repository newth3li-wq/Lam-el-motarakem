'use strict';
const http = require('node:http');
const { hashPassword, verifyPassword, newToken, sha256, dummyHash } = require('./auth');
const { TRACKS, STATUSES, isDate, isInt, isEmail } = require('./validate');
const { planRescue, FOCUS_MODES } = require('./rescuePlan');

class HttpError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const bad = (code, message) => new HttpError(400, code, message);
const MAX_AVATAR = 204800;
const SECOND_LANGUAGES = ['lang2_french', 'lang2_german', 'lang2_spanish', 'lang2_italian'];

function createLimiter() {
  const hits = new Map();
  return (key, max, windowMs, now = Date.now()) => {
    const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (arr.length >= max) { hits.set(key, arr); throw new HttpError(429, 'TOO_MANY_REQUESTS', 'محاولات كتير، استنى شوية وحاول تاني'); }
    arr.push(now); hits.set(key, arr);
  };
}

function createApp({ store, config }) {
  const limit = createLimiter();
  const routes = [];
  const route = (method, path, opts, handler) => routes.push({ method, re: new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), opts, handler });
  const todayStr = () => new Intl.DateTimeFormat('sv-SE', { timeZone: config.tz }).format(config.now());
  const ipOf = req => (config.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';

  const corsHeaders = req => {
    const origin = req.headers.origin; if (!origin) return {};
    const ok = config.allowedOrigins.includes(origin) || (config.nodeEnv !== 'production' && config.allowedOrigins.length === 0);
    return ok ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Max-Age': '600' } : {};
  };
  const send = (res, status, body, headers = {}) => {
    const isBuf = Buffer.isBuffer(body);
    res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ...(isBuf ? {} : { 'Content-Type': 'application/json; charset=utf-8' }), ...headers });
    res.end(body === undefined ? undefined : isBuf ? body : JSON.stringify(body));
  };
  const readJson = (req, maxBytes) => new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '');
    const chunks = []; let size = 0;
    let tooLarge = false;
    req.on('data', c => {
      size += c.length;
      if (size > maxBytes) {
        if (!tooLarge) { tooLarge = true; chunks.length = 0; reject(new HttpError(413, 'TOO_LARGE', 'الحجم أكبر من المسموح')); }
        if (size > maxBytes * 8) req.destroy();       // hostile client: stop reading altogether
      } else if (!tooLarge) chunks.push(c);
    });
    req.on('end', () => {
      if (tooLarge) return;
      if (!size) return resolve({});
      if (!type.includes('application/json')) return reject(new HttpError(415, 'BAD_CONTENT_TYPE', 'لازم الطلب يكون JSON'));
      try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); resolve(v && typeof v === 'object' && !Array.isArray(v) ? v : {}); }
      catch { reject(bad('BAD_JSON', 'الطلب مش مكتوب صح')); }
    });
    req.on('error', reject);
  });

  const userOut = (u, p) => ({ id: u.id, email: u.email, profile: p });
  const startSession = async userId => {
    const { token, tokenHash } = newToken();
    await store.createSession({ userId, tokenHash, expiresAt: new Date(config.now().getTime() + config.sessionDays * 86400000) });
    return token;
  };

  // ---- routes ----
  route('GET', '/api/health', { public: true }, async () => ({ status: 200, body: { ok: true } }));

  route('POST', '/api/auth/register', { public: true }, async ({ body, ip }) => {
    limit('register:' + ip, config.registerLimit ?? 5, 3600000);
    const email = String(body.email || '').trim();
    const password = body.password, displayName = String(body.displayName || '').trim();
    if (!isEmail(email)) throw bad('BAD_EMAIL', 'الإيميل مش صحيح');
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw bad('BAD_PASSWORD', 'كلمة السر لازم تكون من 8 لـ 128 حرف');
    if (password.toLowerCase() === email.toLowerCase()) throw bad('BAD_PASSWORD', 'كلمة السر ما ينفعش تبقى زي الإيميل');
    if (displayName.length > 60) throw bad('BAD_NAME', 'الاسم أطول من اللازم');
    let user;
    try { user = await store.createUser({ email, passwordHash: await hashPassword(password), displayName }); }
    catch (e) { if (e.code === 'EMAIL_TAKEN') throw new HttpError(409, 'EMAIL_TAKEN', 'الإيميل ده مسجّل قبل كده'); throw e; }
    return { status: 201, body: { token: await startSession(user.id), user: userOut(user, await store.getProfile(user.id)) } };
  });

  route('POST', '/api/auth/login', { public: true }, async ({ body, ip }) => {
    const email = String(body.email || '').trim(), password = body.password;
    limit(`login:${ip}:${email.toLowerCase()}`, config.loginLimit ?? 8, 900000);
    const fail = () => new HttpError(401, 'INVALID_CREDENTIALS', 'الإيميل أو كلمة السر غلط');
    if (!isEmail(email) || typeof password !== 'string' || password.length > 128) { await verifyPassword('x', await dummyHash); throw fail(); }
    const u = await store.getUserByEmail(email);
    const ok = await verifyPassword(password, u ? u.passwordHash : await dummyHash);
    if (!u || !ok) throw fail();
    return { status: 200, body: { token: await startSession(u.id), user: userOut(u, await store.getProfile(u.id)) } };
  });

  route('POST', '/api/auth/logout', {}, async ({ token }) => { await store.deleteSession(sha256(token)); return { status: 204 }; });
  route('GET', '/api/me', {}, async ({ user }) => ({ status: 200, body: { user: userOut(user, await store.getProfile(user.id)) } }));

  route('PUT', '/api/profile', {}, async ({ user, body }) => {
    const cur = await store.getProfile(user.id);
    const displayName = body.displayName === undefined ? cur.displayName : String(body.displayName).trim();
    const track = body.track === undefined ? cur.track : body.track;
    const examDate = body.examDate === undefined ? cur.examDate : body.examDate;
    const secondLanguage = body.secondLanguage === undefined ? cur.secondLanguage : body.secondLanguage;
    if (displayName.length > 60) throw bad('BAD_NAME', 'الاسم أطول من اللازم');
    if (track !== null && !TRACKS.includes(track)) throw bad('BAD_TRACK', 'الشعبة مش صحيحة');
    if (secondLanguage !== null && !SECOND_LANGUAGES.includes(secondLanguage)) throw bad('BAD_LANGUAGE', 'اللغة التانية مش صحيحة');
    if (examDate !== null) {
      if (!isDate(examDate)) throw bad('BAD_DATE', 'تاريخ نهاية المدة مش صحيح');
      if (examDate < todayStr()) throw bad('DATE_IN_PAST', 'نهاية المدة لازم تكون النهاردة أو بعدها');
    }
    await store.updateProfile(user.id, { displayName, track, examDate, secondLanguage });
    return { status: 200, body: { profile: await store.getProfile(user.id) } };
  });

  route('PUT', '/api/profile/avatar', { maxBody: 400000 }, async ({ user, body }) => {
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(String(body.dataUrl || ''));
    if (!m) throw bad('BAD_IMAGE', 'الصورة لازم تكون PNG أو JPEG أو WEBP');
    const data = Buffer.from(m[2], 'base64');
    if (data.length > MAX_AVATAR) throw new HttpError(413, 'IMAGE_TOO_LARGE', 'الصورة أكبر من 200 كيلوبايت');
    const magic = { 'image/png': d => d.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), 'image/jpeg': d => d.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])), 'image/webp': d => d.subarray(0, 4).toString() === 'RIFF' && d.subarray(8, 12).toString() === 'WEBP' };
    if (!magic[m[1]](data)) throw bad('BAD_IMAGE', 'محتوى الصورة مش مطابق لنوعها');
    await store.setAvatar(user.id, { data, mime: m[1] });
    return { status: 204 };
  });
  route('GET', '/api/profile/avatar', {}, async ({ user }) => {
    const a = await store.getAvatar(user.id); if (!a) throw new HttpError(404, 'NO_AVATAR', 'مفيش صورة');
    return { status: 200, body: Buffer.from(a.data), headers: { 'Content-Type': a.mime } };
  });

  route('GET', '/api/availability', {}, async ({ user }) => ({ status: 200, body: await store.getAvailability(user.id) }));
  route('PUT', '/api/availability', {}, async ({ user, body }) => {
    const weekly = body.weekly ?? {}, overrides = body.overrides ?? {};
    if (typeof weekly !== 'object' || typeof overrides !== 'object') throw bad('BAD_AVAILABILITY', 'بيانات الوقت مش صحيحة');
    for (const [k, v] of Object.entries(weekly)) if (!/^[0-6]$/.test(k) || !isInt(v, 0, 1440)) throw bad('BAD_AVAILABILITY', 'يوم الأسبوع أو الدقايق مش صحيحين');
    const od = Object.entries(overrides); if (od.length > 400) throw bad('BAD_AVAILABILITY', 'أيام استثنائية كتير');
    for (const [k, v] of od) if (!isDate(k) || !isInt(v, 0, 1440)) throw bad('BAD_AVAILABILITY', 'تاريخ أو دقايق مش صحيحة');
    await store.setAvailability(user.id, { weekly, overrides });
    return { status: 200, body: await store.getAvailability(user.id) };
  });

  route('GET', '/api/subjects', {}, async ({ user }) => ({ status: 200, body: { subjects: await store.listSubjects(user.id) } }));
  route('PUT', '/api/subjects/:id', {}, async ({ user, params, body }) => {
    if (!(await store.subjectExists(params.id))) throw new HttpError(404, 'NOT_FOUND', 'المادة مش موجودة');
    const weakness = body.weakness ?? 2, examDate = body.examDate ?? null;
    if (!isInt(weakness, 1, 3)) throw bad('BAD_WEAKNESS', 'مستوى الضعف من 1 لـ 3');
    if (examDate !== null && !isDate(examDate)) throw bad('BAD_DATE', 'تاريخ امتحان المادة مش صحيح');
    await store.setUserSubject(user.id, params.id, { weakness, examDate });
    return { status: 204 };
  });

  route('GET', '/api/lessons', {}, async ({ user }) => ({ status: 200, body: { lessons: await store.listLessons(user.id) } }));
  route('POST', '/api/lessons', {}, async ({ user, body }) => {
    const title = String(body.title || '').trim(), estMinutes = body.estMinutes ?? 45, releaseDate = body.releaseDate ?? null;
    if (!(await store.subjectExists(String(body.subjectId || '')))) throw bad('BAD_SUBJECT', 'المادة مش موجودة');
    if (!title || title.length > 120) throw bad('BAD_TITLE', 'عنوان الدرس من 1 لـ 120 حرف');
    if (!isInt(estMinutes, 5, 480)) throw bad('BAD_ESTIMATE', 'وقت الدرس من 5 لـ 480 دقيقة');
    if (releaseDate !== null && !isDate(releaseDate)) throw bad('BAD_DATE', 'تاريخ نزول الدرس مش صحيح');
    const id = await store.createCustomLesson(user.id, { subjectId: body.subjectId, title, estMinutes, releaseDate });
    return { status: 201, body: { id } };
  });
  route('PATCH', '/api/lessons/:id', {}, async ({ user, params, body }) => {
    const patch = {};
    if (body.status !== undefined) { if (!STATUSES.includes(body.status)) throw bad('BAD_STATUS', 'حالة الدرس مش صحيحة'); patch.status = body.status; }
    if (body.estMinutes !== undefined) { if (body.estMinutes !== null && !isInt(body.estMinutes, 5, 480)) throw bad('BAD_ESTIMATE', 'وقت الدرس من 5 لـ 480 دقيقة'); patch.estOverride = body.estMinutes; }
    if (!Object.keys(patch).length) throw bad('NOTHING_TO_UPDATE', 'مفيش حاجة تتعدل');
    if (!(await store.updateUserLesson(user.id, params.id, patch))) throw new HttpError(404, 'NOT_FOUND', 'الدرس مش موجود');
    return { status: 204 };
  });
  route('DELETE', '/api/lessons/:id', {}, async ({ user, params }) => {
    if (!(await store.deleteCustomLesson(user.id, params.id))) throw new HttpError(404, 'NOT_FOUND', 'الدرس مش موجود أو مش بتاعك');
    return { status: 204 };
  });

  route('POST', '/api/study-sessions', {}, async ({ user, body }) => {
    const today = todayStr(), studiedOn = body.studiedOn ?? today, lessonId = body.lessonId ?? null;
    if (!isInt(body.minutes, 1, 600)) throw bad('BAD_MINUTES', 'الدقايق من 1 لـ 600');
    if (!isDate(studiedOn) || studiedOn > today) throw bad('BAD_DATE', 'تاريخ المذاكرة مش صحيح');
    await store.addStudySession(user.id, { lessonId, minutes: body.minutes, studiedOn });
    return { status: 201, body: await store.studyTotals(user.id) };
  });
  route('GET', '/api/stats', {}, async ({ user }) => ({ status: 200, body: await store.studyTotals(user.id) }));

  route('GET', '/api/plan', {}, async ({ user, query }) => {
    const focus = query.get('focus') || 'balanced';
    if (!FOCUS_MODES.includes(focus)) throw bad('BAD_FOCUS', 'تركيز الخطة مش صحيح');
    const profile = await store.getProfile(user.id);
    if (!profile.examDate) throw bad('EXAM_DATE_REQUIRED', 'حدد المدة اللي عايز تخلص فيها المتراكم الأول عشان نعمل الخطة');
    const [availability, lessons, subjects] = await Promise.all([store.getAvailability(user.id), store.listLessons(user.id), store.listSubjects(user.id)]);
    const plan = planRescue({
      today: todayStr(), examDate: profile.examDate, weekly: availability.weekly, overrides: availability.overrides, focus,
      subjects: Object.fromEntries(subjects.map((s, i) => [s.id, { weakness: s.weakness, priority: i, ...(s.examDate ? { examDate: s.examDate } : {}) }])),
      lessons: lessons.map(l => ({ id: l.id, subject: l.subjectId, title: l.title, status: l.status, estMinutes: l.estMinutes, order: l.ord, releaseDate: l.releaseDate || undefined }))
    });
    if (plan.error) throw bad(plan.error, 'نهاية المدة لازم تكون بعد النهاردة');
    return { status: 200, body: plan };
  });

  // ---- dispatcher ----
  return async (req, res) => {
    const cors = corsHeaders(req);
    try {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'OPTIONS') return send(res, 204, undefined, cors);
      const r = routes.map(x => ({ x, m: x.re.exec(url.pathname) })).find(o => o.m && o.x.method === req.method);
      if (!r) { const pathMatch = routes.some(x => x.re.test(url.pathname)); throw new HttpError(pathMatch ? 405 : 404, pathMatch ? 'METHOD_NOT_ALLOWED' : 'NOT_FOUND', 'العنوان مش موجود'); }
      const ctx = { req, res, params: r.m.groups || {}, query: url.searchParams, ip: ipOf(req) };
      if (!r.x.opts.public) {
        const h = String(req.headers.authorization || ''); const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
        const s = token && await store.getSession(sha256(token), config.now());
        const user = s && await store.getUserById(s.userId);
        if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'لازم تسجّل دخول');
        ctx.token = token; ctx.user = user;
      }
      ctx.body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readJson(req, r.x.opts.maxBody || 16384) : {};
      const out = await r.x.handler(ctx);
      send(res, out.status, out.body, { ...cors, ...(out.headers || {}) });
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: { code: e.code, message: e.message } }, { ...cors, ...(e.status === 413 ? { Connection: 'close' } : {}) });
      console.error('Unhandled error:', e);
      send(res, 500, { error: { code: 'SERVER_ERROR', message: 'حصلت مشكلة عندنا، حاول تاني' } }, cors);
    }
  };
}

function createServer(deps) { return http.createServer(createApp(deps)); }
module.exports = { createApp, createServer };
