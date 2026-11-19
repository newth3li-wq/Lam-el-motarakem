import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Link } from '../router';
import { Reveal } from '../motion';
import { Alert, Bell, Book, Calendar, CheckCircle, Clock, Info } from '../components/Icons';
import { formatDay, hoursLabel, TRACK_LABELS } from '../lib/format';

const SEEN_KEY = 'lam_notif_seen';

function readSeen() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch { return []; }
}
function writeSeen(ids) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200))); } catch { /* private mode */ }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(`${new Date().toLocaleDateString('sv-SE')}T12:00:00`);
  const target = new Date(`${dateStr}T12:00:00`);
  return Math.round((target - today) / 86400000);
}

export default function Notifications() {
  const { token, user } = useAuth();
  const profile = user.profile || {};
  const [state, setState] = useState({ loading: true, lessons: [], subjects: [], plan: null, planError: '' });
  const [seen, setSeen] = useState(() => readSeen());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      const [lessonsRes, subjectsRes, planRes] = await Promise.allSettled([
        api('/api/lessons', { token }),
        api('/api/subjects', { token }),
        api('/api/plan', { token })
      ]);
      if (!live) return;
      setState({
        loading: false,
        lessons: lessonsRes.status === 'fulfilled' ? lessonsRes.value.lessons || [] : [],
        subjects: subjectsRes.status === 'fulfilled' ? subjectsRes.value.subjects || [] : [],
        plan: planRes.status === 'fulfilled' ? planRes.value : null,
        planError: planRes.status === 'rejected' ? planRes.reason?.message || 'الخطة مش جاهزة' : ''
      });
    })();
    return () => { live = false; };
  }, [token, version, profile.examDate, profile.track]);

  const items = useMemo(() => {
    const out = [];
    const s = state.plan?.summary;
    const open = state.lessons.filter((l) => l.status !== 'done').length;

    if (!profile.onboarded) {
      out.push({
        id: 'setup',
        tone: 'info',
        icon: Info,
        title: 'لسه محتاجين نعرف حالتك',
        body: 'اختار شعبتك والمدة اللي عايز تخلص فيها المتراكم وساعات مذاكرتك عشان نبدأ نبني الخطة',
        to: '/app', cta: 'ابدأ من الرئيسية'
      });
      return out;
    }

    if (state.planError) {
      out.push({
        id: 'plan-error',
        tone: 'warn',
        icon: Alert,
        title: 'الخطة مش جاهزة',
        body: state.planError,
        to: '/app/profile', cta: 'راجع بياناتك'
      });
    }

    if (s) {
      const left = s.daysLeft;
      if (left <= 7) {
        out.push({
          id: `exam-${s.examDate}`,
          tone: 'urgent',
          icon: Calendar,
          title: `فاضل ${left} ${left === 1 ? 'يوم' : 'أيام'} على آخر المدة`,
          body: `آخر المدة ${formatDay(s.examDate)}، ركّز على المراجعة والدروس اللي لسه مفتوحة`,
          to: '/app/planner', cta: 'افتح الجدول'
        });
      } else if (left <= 30) {
        out.push({
          id: `exam-${s.examDate}`,
          tone: 'warn',
          icon: Calendar,
          title: `فاضل ${left} يوم على آخر المدة`,
          body: `عندك ${hoursLabel(s.totalCapacity)} وقت مذاكرة على ${s.studyDays} يوم، راجع تغطية الخطة`,
          to: '/app/planner', cta: 'شوف التغطية'
        });
      } else {
        out.push({
          id: `exam-${s.examDate}`,
          tone: 'info',
          icon: Calendar,
          title: `آخر المدة بعد ${left} يوم`,
          body: `${formatDay(s.examDate)} · ${hoursLabel(s.totalCapacity)} وقت متاح على ${s.studyDays} يوم`,
          to: '/app/planner', cta: 'افتح الجدول'
        });
      }

      if (state.plan?.deferred?.length) {
        out.push({
          id: `deferred-${s.examDate}-${state.plan.deferred.length}`,
          tone: 'warn',
          icon: Clock,
          title: `${state.plan.deferred.length} درس مش داخل الخطة`,
          body: `الوقت المتاح مش كفاية لكل حاجة، ناقص حوالي ${hoursLabel(s.shortfall)}، زوّد وقتك أو رتّب أولوياتك`,
          to: '/app/planner', cta: 'شوف المؤجل'
        });
      }

      if (!state.plan.feasible) {
        out.push({
          id: `coverage-${s.examDate}-${Math.round(s.coverage * 100)}`,
          tone: 'urgent',
          icon: Alert,
          title: `الخطة بتغطي ${Math.round(s.coverage * 100)}% من المتراكم`,
          body: 'الباقي متأجل، الأفضل تقلّل عدد الدروس أو تزوّد ساعات المذاكرة قبل ما الوقت يضيق',
          to: '/app/profile', cta: 'عدّل وقتك'
        });
      } else if (open > 0) {
        out.push({
          id: `feasible-${s.examDate}-${open}`,
          tone: 'ok',
          icon: CheckCircle,
          title: 'الخطة بتغطي كل الدروس المفتوحة',
          body: `فاضل ${open} درس وكلهم متوزّعين على الأيام، كمّل بالترتيب وهتلحق`,
          to: '/app/planner', cta: 'شوف خطة النهاردة'
        });
      }
    }

    state.plan?.warnings?.forEach((w, i) => {
      const id = `warning-${i}-${w.slice(0, 24)}`;
      if (out.some((x) => x.id === id)) return;
      out.push({ id, tone: 'warn', icon: Alert, title: 'ملاحظة على الخطة', body: w, to: '/app/planner', cta: 'افتح الجدول' });
    });

    for (const subject of state.subjects) {
      const list = state.lessons.filter((l) => l.subjectId === subject.id);
      const left = daysUntil(subject.examDate);
      if (left !== null && left >= 0 && left <= 21) {
        const done = list.filter((l) => l.status === 'done').length;
        out.push({
          id: `subject-exam-${subject.id}-${subject.examDate}`,
          tone: left <= 7 ? 'urgent' : 'warn',
          icon: Calendar,
          title: `امتحان ${subject.name} بعد ${left} يوم`,
          body: `${formatDay(subject.examDate)} · خلصت ${done} من ${list.length} درس`,
          to: '/app/subjects', cta: 'افتح المادة'
        });
      }
      if (!list.length) {
        out.push({
          id: `empty-subject-${subject.id}`,
          tone: 'info',
          icon: Book,
          title: `${subject.name}: مفيش دروس لحد دلوقتي`,
          body: subject.note || 'المنهج الرسمي لسه ما اتحمّلش للمادة دي',
          to: '/app/subjects', cta: 'شوف المواد'
        });
      }
    }

    if (!profile.secondLanguage && state.subjects.some((s) => s.name.startsWith('اللغة'))) {
      out.push({
        id: 'second-language',
        tone: 'info',
        icon: Info,
        title: 'اختار لغتك التانية',
        body: 'عشان نضيف منهج لغتك ونشيل باقي اللغات من خطتك',
        to: '/app/profile', cta: 'اختار اللغة'
      });
    }

    if (state.lessons.length === 0) {
      out.push({
        id: 'no-lessons',
        tone: 'warn',
        icon: Book,
        title: 'مفيش دروس على حسابك',
        body: `منهج ${TRACK_LABELS[profile.track] || 'شعبتك'} لسه ما اتحمّلش على السيرفر، أو شعبتك مش محددة`,
        to: '/app/subjects', cta: 'راجع المواد'
      });
    }

    return out;
  }, [state, profile]);

  const unread = items.filter((x) => !seen.includes(x.id)).length;

  const markAll = () => {
    const ids = [...new Set([...seen, ...items.map((x) => x.id)])];
    setSeen(ids); writeSeen(ids);
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="eyebrow"><Bell size={15} /> آخر التحديثات</span>
          <h1>الإشعارات</h1>
          <p>كل حاجة هنا محسوبة من خطتك وبياناتك، مش رسائل تجريبية</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVersion((v) => v + 1)} disabled={state.loading}>
            {state.loading ? 'بيحدّث…' : 'تحديث'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={markAll} disabled={!unread}>
            تحديد الكل كمقروء
          </button>
        </div>
      </div>

      {state.loading ? (
        <div className="stack">{[0, 1, 2].map((i) => <div key={i} className="skeleton skeleton-block" />)}</div>
      ) : items.length === 0 ? (
        <Reveal className="panel">
          <div className="empty">
            <div className="empty-icon"><CheckCircle size={24} /></div>
            <h3>مفيش إشعارات جديدة</h3>
            <p>كل حاجة ماشية، لما تحصل حاجة محتاجة انتباهك هتلاقيها هنا</p>
            <Link className="btn btn-ghost btn-sm" to="/app">ارجع للرئيسية</Link>
          </div>
        </Reveal>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {items.map((item, i) => {
            const Icon = item.icon;
            const isNew = !seen.includes(item.id);
            return (
              <Reveal className={'notif notif-' + item.tone + (isNew ? ' is-new' : '')} key={item.id} delay={Math.min(i * 40, 220)}>
                <span className="notif-icon"><Icon size={20} /></span>
                <div className="notif-main">
                  <div className="notif-title">
                    <strong>{item.title}</strong>
                    {isNew ? <span className="notif-dot" aria-label="جديد" /> : null}
                  </div>
                  <p>{item.body}</p>
                </div>
                <Link className="btn btn-ghost btn-sm notif-cta" to={item.to}>{item.cta}</Link>
              </Reveal>
            );
          })}
        </div>
      )}

      <Reveal className="note" delay={80}>
        <Bell size={18} />
        <p>الإشعارات بتتحدّث كل مرة تفتح الصفحة، مفيش بريد أو تنبيهات خارج المتصفح لحد دلوقتي</p>
      </Reveal>
    </div>
  );
}
