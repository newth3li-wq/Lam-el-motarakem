import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Link } from '../router';
import Onboarding from '../components/Onboarding';
import { Reveal } from '../motion';
import {
  Alert, ArrowLeft, Book, Calendar, CheckCircle, Clock, ListChecks, Sparkles
} from '../components/Icons';
import {
  METHOD_LABELS, hoursLabel, pct, formatDay, todayISO, TRACK_LABELS
} from '../lib/format';

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const QUOTES = [
  'خطوة صغيرة النهاردة أحسن من خطة كبيرة بكرة',
  'المتراكم مش جبل؛ هو دروس ورا بعض، وكل درس لوحده',
  'لو خلصت درس واحد، يبقى النهاردة مش صفر',
  'المراجعة القصيرة أفضل من إنك تبدأ من الأول كل مرة',
  'مش لازم تبقى متحمس؛ لازم تبقى موجود',
  'وقتك محدود، فابدأ باللي متأخر فيه فعلًا'
];

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <article className="stat-card">
      <span className="stat-icon" aria-hidden="true"><Icon size={21} /></span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {hint ? <em>{hint}</em> : null}
      </div>
    </article>
  );
}

export default function Dashboard() {
  const { token, user } = useAuth();
  const profile = user.profile || {};
  const [data, setData] = useState({
    loading: true,
    plan: null,
    planError: '',
    subjects: [],
    lessons: [],
    stats: null,
    weekly: null
  });
  const [pending, setPending] = useState('');
  const [version, setVersion] = useState(0);

  const onboarded = !!profile.onboarded;

  useEffect(() => {
    if (!onboarded) { setData((d) => ({ ...d, loading: false })); return undefined; }
    let live = true;
    (async () => {
      const [planRes, subjectsRes, lessonsRes, statsRes, availabilityRes] = await Promise.allSettled([
        api('/api/plan', { token }),
        api('/api/subjects', { token }),
        api('/api/lessons', { token }),
        api('/api/stats', { token }),
        api('/api/availability', { token })
      ]);
      if (!live) return;
      setData({
        loading: false,
        plan: planRes.status === 'fulfilled' ? planRes.value : null,
        planError: planRes.status === 'rejected' ? planRes.reason?.message || 'مش قادرين نجيب الخطة دلوقتي' : '',
        subjects: subjectsRes.status === 'fulfilled' ? subjectsRes.value.subjects || [] : [],
        lessons: lessonsRes.status === 'fulfilled' ? lessonsRes.value.lessons || [] : [],
        stats: statsRes.status === 'fulfilled' ? statsRes.value : null,
        weekly: availabilityRes.status === 'fulfilled' ? availabilityRes.value.weekly || null : null
      });
    })();
    return () => { live = false; };
  }, [token, onboarded, profile.examDate, profile.track, version]);

  const today = useMemo(() => todayISO(), []);
  const done = data.lessons.filter((l) => l.status === 'done').length;
  const total = data.lessons.length;
  const percent = pct(done, total);
  const plan = data.plan;
  const s = plan?.summary;
  const day = useMemo(() => {
    const days = plan?.days || [];
    return days.find((d) => d.date === today) || days[0] || null;
  }, [plan, today]);

  const studiedMinutes = Number(data.stats?.totalMinutes || 0);
  const activeDays = Number(data.stats?.activeDays || 0);
  const xp = done * 50 + studiedMinutes * 2;
  const level = Math.floor(xp / 200) + 1;
  const xpInLevel = xp % 200;

  const subjectNames = useMemo(
    () => Object.fromEntries(data.subjects.map((x) => [x.id, x.name])),
    [data.subjects]
  );

  const subjectRows = useMemo(() => data.subjects.map((subject) => {
    const list = data.lessons.filter((l) => l.subjectId === subject.id);
    const ready = list.filter((l) => l.status === 'done').length;
    return { subject, total: list.length, done: ready, percent: pct(ready, list.length) };
  }), [data.subjects, data.lessons]);

  const todayIndex = new Date().getDay();

  const markDone = async (session) => {
    if (pending) return;
    setPending(session.lessonId);
    try {
      await api(`/api/lessons/${encodeURIComponent(session.lessonId)}`, {
        method: 'PATCH', token, body: { status: 'done' }
      });
      setVersion((v) => v + 1);
    } catch {
      /* the plan reloads on the next page visit; no fake success */
    } finally {
      setPending('');
    }
  };

  if (!onboarded) {
    return (
      <div className="stack">
        <div className="page-head">
          <div>
            <span className="eyebrow"><Sparkles size={15} /> البداية</span>
            <h1>أهلًا {profile.displayName ? `يا ${profile.displayName}` : 'بيك'}</h1>
            <p>قبل ما نبني خطتك، محتاجين نعرف شعبتك ووقتك والمدة اللي عايز تخلص فيها المتراكم</p>
          </div>
        </div>
        <Onboarding onDone={() => setVersion((v) => v + 1)} />
      </div>
    );
  }

  return (
    <div className="dash">
      <Reveal as="section" className="welcome-row">
        <div>
          <p className="eyebrow">مساحة مذاكرتك الشخصية</p>
          <h1>أهلاً بيك <span>{profile.displayName ? `يا ${profile.displayName}` : 'في مساحتك'}</span></h1>
          <p className="muted">
            {TRACK_LABELS[profile.track] ? `شعبة ${TRACK_LABELS[profile.track]} · ` : ''}
            هنقسم المتراكم لخطوات صغيرة تقدر تنفذها
          </p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="sun" />
          <div className="book book-one" />
          <div className="book book-two" />
          <div className="spark">✦</div>
        </div>
      </Reveal>

      {data.loading ? (
        <Reveal className="stats-grid" delay={40}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-block" style={{ height: 84 }} />)}
        </Reveal>
      ) : (
        <Reveal className="stats-grid" delay={40}>
          <Stat
            icon={CheckCircle}
            label="الدروس المكتملة"
            value={done}
            hint={`من ${total} درس مضاف`}
          />
          <Stat
            icon={ListChecks}
            label="إنجاز المنهج"
            value={`${percent}%`}
            hint="كل درس بيقرّبك"
          />
          <Stat
            icon={Clock}
            label="وقت المذاكرة"
            value={studiedMinutes ? hoursLabel(studiedMinutes) : '0 د'}
            hint="وقت مسجل على الموقع"
          />
          <Stat
            icon={Book}
            label="المهام المتبقية"
            value={Math.max(0, total - done)}
            hint="درس محتاج تبدأ فيه"
          />
        </Reveal>
      )}

      <Reveal as="section" className="panel motivation-panel" delay={60}>
        <div className="section-head">
          <div>
            <p className="eyebrow">خليك مستمر</p>
            <h2>مستواك وتقدمك</h2>
          </div>
          <span className="live-dot">{activeDays} يوم مذاكرة</span>
        </div>
        <p className="quote">{QUOTES[new Date().getDate() % QUOTES.length]}</p>
        <div className="goal-row">
          <div className="goal-main">
            <small>{xpInLevel} / 200 نقطة للمستوى {level + 1}</small>
            <div className="bar"><span style={{ width: `${Math.round(xpInLevel / 2)}%` }} /></div>
          </div>
          <div className="level-box">
            <b>{level}</b>
            <small>المستوى</small>
          </div>
        </div>
      </Reveal>

      <div className="dashboard-grid">
        <Reveal as="section" className="panel today-panel" delay={0}>
          <div className="section-head">
            <div>
              <p className="eyebrow">خطوتك الجاية</p>
              <h2>ماذا أذاكر اليوم؟</h2>
            </div>
            <span className="live-dot">خطة قابلة للتعديل</span>
          </div>

          {data.loading ? (
            <div className="stack">
              <div className="skeleton skeleton-block" style={{ height: 64 }} />
              <div className="skeleton skeleton-block" style={{ height: 64 }} />
            </div>
          ) : data.planError ? (
            <div className="empty-state">
              {data.planError}{' '}
              <Link to="/app/profile">راجع بياناتك</Link>
            </div>
          ) : !day || day.sessions.length === 0 ? (
            <div className="empty-state">
              {total === 0
                ? 'لسه مفيش دروس مضافة على حسابك، أول ما تتضاف، هنوزّعها على أيامك تلقائيًا'
                : 'كل حاجة مخططة النهاردة خلصت، أو اليوم ده يوم راحة'}
            </div>
          ) : (
            <div className="task-list">
              {day.sessions.map((session, i) => (
                <label className="task-item" key={`${session.lessonId}-${i}`}>
                  <input
                    className="task-check"
                    type="checkbox"
                    checked={false}
                    disabled={pending === session.lessonId}
                    onChange={() => markDone(session)}
                    aria-label={`خلّصت ${session.title}`}
                  />
                  <span>
                    <b>{session.title}</b>
                    <small>
                      {subjectNames[session.subject] || session.subject}
                      {' · '}
                      {METHOD_LABELS[session.method] || 'ذاكر الدرس'}
                    </small>
                  </span>
                  <span className="duration">{session.minutes} دقيقة</span>
                </label>
              ))}
            </div>
          )}

          <div className="today-foot">
            <Link className="primary-btn" to="/app/planner">
              افتح مخطط المذاكرة <span aria-hidden="true">←</span>
            </Link>
            {day ? (
              <span className="muted small">
                {Math.round(day.used)} / {Math.round(day.capacity)} دقيقة
              </span>
            ) : null}
          </div>
        </Reveal>

        <Reveal as="section" className="panel week-panel" delay={80}>
          <div className="section-head">
            <div>
              <p className="eyebrow">مواعيدك الثابتة</p>
              <h2>جدول المذاكرة</h2>
            </div>
            <Link className="text-btn" to="/app/planner">تعديل</Link>
          </div>

          <div className="week-list">
            {DAYS.map((label, index) => {
              const minutes = Number(data.weekly?.[index] ?? 0);
              return (
                <div
                  className={'week-row' + (minutes === 0 ? ' is-rest' : '') + (index === todayIndex ? ' is-today' : '')}
                  key={label}
                >
                  <span className="week-day">{label}</span>
                  <span className="week-subject">{minutes ? hoursLabel(minutes) : 'يوم راحة'}</span>
                  {index === todayIndex ? <span className="week-today">النهاردة</span> : null}
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>

      <Reveal as="section" className="panel subject-overview" delay={60}>
        <div className="section-head">
          <div>
            <p className="eyebrow">رحلة المنهج</p>
            <h2>كمّلت قد إيه؟</h2>
          </div>
          <Link className="text-btn" to="/app/subjects">كل المواد ←</Link>
        </div>

        {data.loading ? (
          <div className="subject-progress-grid">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton skeleton-block" style={{ height: 72 }} />)}
          </div>
        ) : subjectRows.length ? (
          <div className="subject-progress-grid">
            {subjectRows.map(({ subject, total: count, done: ready, percent: p }) => (
              <div className="mini-progress" key={subject.id}>
                <b>{subject.name}</b>
                <small>
                  {count ? `${ready} من ${count} درس · ${p}%` : 'المنهج في الطريق'}
                </small>
                <div className="bar"><span style={{ width: `${p}%` }} /></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">اختار شعبتك عشان نعرض موادك</div>
        )}
      </Reveal>

      {plan?.warnings?.length ? (
        <Reveal as="section" className="panel dash-warnings" delay={90}>
          <div className="section-head">
            <div>
              <p className="eyebrow">محتاج تعرف</p>
              <h2>حاجات في خطتك</h2>
            </div>
          </div>
          <ul>
            {plan.warnings.map((w, i) => (
              <li key={i}><Alert size={16} /><span>{w}</span></li>
            ))}
          </ul>
        </Reveal>
      ) : null}

      <footer className="dash-footer">
        <span>{s ? `${s.studyDays} يوم مذاكرة لحد ${formatDay(s.examDate)}` : 'خد خطة النهاردة وابدأ'}</span>
        <Link to="/app/progress">شوف تقدمي <ArrowLeft size={14} /></Link>
      </footer>
    </div>
  );
}
