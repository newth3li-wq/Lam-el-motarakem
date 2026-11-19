import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from '../router';
import { ThemeIconButton } from '../theme';
import BrandMark from '../components/BrandMark';
import { useAuth } from '../auth';
import {
  applyMotionPreference, isReducedMotion, readMotionSaved, setMotionFull,
  usePrefersReducedMotion, useRevealGroup
} from '../motion';
import {
  Book, Calendar, Chart, Graduation, Layers, Shield
} from '../components/Icons';

const STEPS = [
  ['اختار شعبتك ووقتك', 'الشعبة، لغتك التانية، المدة اللي عايز تخلص فيها المتراكم، وساعات المذاكرة الحقيقية في كل يوم'],
  ['منهجك الرسمي جاهز', 'وحدات ودروس موادك منقولة من فهرس كتب الوزارة، برقم صفحة كل درس'],
  ['علّم وابدأ من مكانك', 'حدد اللي خلصته واللي شغّال عليه، وخد خطة النهاردة على وقتك المتاح']
];

const FEATURES = [
  [Layers, 'إنقاذ المتراكم', 'الدروس المتأخرة بتترتب حسب الأقرب لامتحان مادته وحسب ضعفك فيها، مش حسب ترتيب الكتاب'],
  [Calendar, 'مخطط المذاكرة', 'توزيع يومي على وقتك المتاح، الجديد والمتراكم مع بعض، ولو الوقت مش كافي بنقولك بصراحة'],
  [Book, 'فهرس المنهج الرسمي', 'وحدات ودروس كل مادة منقولة من الفهرس الرسمي، ورقم صفحة كل درس قدامه'],
  [Chart, 'تقدمك بأرقام حقيقية', 'نسبة الإنجاز وتقدم كل مادة محسوبين من حالة دروسك، مفيش أرقام تقديرية'],
  [Graduation, 'لغتك التانية', 'فرنساوي أو ألماني أو إيطالي أو إسباني — منهجك بيتغير على اختيارك'],
  [Shield, 'حسابك محفوظ', 'كلمة السر متشفّرة، وبياناتك على حسابك، وتقدر تكمّل من أي جهاز']
];

const TRACKS = [
  ['أ', 'أدبي', 'العربي والإنجليزي والتاريخ والجغرافيا والإحصاء ولغتك التانية'],
  ['ع', 'علمي علوم', 'العربي والإنجليزي والفيزياء والكيمياء والأحياء ولغتك التانية'],
  ['ر', 'علمي رياضة', 'العربي والإنجليزي والفيزياء والكيمياء والرياضة البحتة والتطبيقية']
];

const SOON = [
  'شرح الدروس وأسئلة تدريب من المنهج الرسمي بعد المراجعة',
  'مؤقت تركيز يسجّل جلساتك في تقدمك',
  'تصدير نسخة من بياناتك على جهازك'
];

const SESSIONS = [
  ['درس جديد من المدرسة', 'تلخيص بعد الحصة'],
  ['درس متراكم · الأقرب لامتحان مادته', 'تسميع'],
  ['درس متراكم · الأضعف عندك', 'حل أسئلة']
];

const NAV_LINKS = [
  ['how', 'إزاي بيشتغل'],
  ['features', 'المميزات'],
  ['tracks', 'الشعب'],
  ['soon', 'قريبًا']
];
const SECTION_IDS = NAV_LINKS.map(([id]) => id);

// The headline is split so every word can be cut in from below, one after
// the other. The key word is underlined with a silver rule that draws itself.
const HERO_TITLE = ['لمّ', 'المتراكم', 'عليك', 'خطوة', 'بخطوة'];
const HERO_ACCENT = 1;

/* ------------------------------------------------------------------
   One rAF loop for the whole landing page.
   It only writes CSS variables and two classes, so scrolling never
   re-renders React — the hero parallax, the reading bar and the sheet
   all read those variables from CSS.
   ------------------------------------------------------------------ */
function useLandingScroll(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let raf = 0;
    let lastY = -1;

    const apply = () => {
      raf = 0;
      const y = Math.max(0, window.scrollY || 0);
      if (y === lastY) return;
      lastY = y;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      root.style.setProperty('--sy', `${y}`);
      root.style.setProperty('--sp', `${Math.min(1, y / max).toFixed(4)}`);
      root.classList.toggle('is-scrolled', y > 14);
      root.classList.toggle('is-top', y < 240);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [rootRef]);
}

/* Which section is in the middle of the screen → the nav pill follows it. */
function useActiveSection(ids) {
  const [active, setActive] = useState(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return undefined;

    const io = new IntersectionObserver((entries) => {
      const hit = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (hit) setActive(hit.target.id);
    }, { rootMargin: '-42% 0px -48% 0px', threshold: [0, 0.2, 0.6] });

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return [active, setActive];
}

function useNavPill(navRef, active) {
  const [box, setBox] = useState({ left: 0, width: 0, placed: false });

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav || !active) return undefined;

    const measure = () => {
      const link = nav.querySelector(`a[href="#${active}"]`);
      if (!link) return;
      setBox({ left: link.offsetLeft, width: link.offsetWidth, placed: true });
    };

    measure();
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener('resize', measure);
  }, [navRef, active]);

  return box;
}

/* Mirrors the app's «حركة كاملة / حركة مخففة» switch. The landing already
   runs full motion by default, so the switch only needs to show up for
   visitors whose system asks for less — same as the original site. */
function MotionSwitch() {
  const osReduced = usePrefersReducedMotion();
  const [full, setFull] = useState(() => readMotionSaved() !== 'auto');
  if (!osReduced) return null;

  return (
    <button
      type="button"
      className="theme-toggle motion-toggle"
      onClick={() => {
        const next = !full;
        setFull(next);
        setMotionFull(next);
      }}
      aria-pressed={full}
      aria-label={full ? 'حركة كاملة' : 'حركة مخففة'}
      title={full ? 'رجوع لتقليل الحركة' : 'تشغيل كل الحركة والانتقالات'}
    >
      <span className="theme-ico" aria-hidden="true">✦</span>
      <span className="theme-text">{full ? 'حركة كاملة' : 'حركة مخففة'}</span>
    </button>
  );
}

export default function Landing() {
  const rootRef = useRef(null);
  const navRef = useRef(null);
  // Before the reveal observer registers anything, arm the full-motion
  // version — the same one every other route now uses by default.
  useLayoutEffect(() => { applyMotionPreference(); }, []);
  useRevealGroup(rootRef);
  useLandingScroll(rootRef);

  const [active, setActive] = useActiveSection(SECTION_IDS);
  const pill = useNavPill(navRef, active);

  /* Section links scroll themselves instead of relying on the browser's
     anchor jump: the sticky nav would cover the section title, and a plain
     `#hash` push fights the SPA router. The offset is measured live, so it
     stays correct when the nav shrinks on scroll. */
  const goToSection = useCallback((e, id) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();

    const nav = navRef.current;
    const navBox = nav ? nav.getBoundingClientRect() : null;
    // the nav sticks 10-12px below the top of the viewport
    const navOffset = navBox ? navBox.height + Math.max(0, navBox.top) + 20 : 96;
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - navOffset);

    window.scrollTo({ top, behavior: isReducedMotion() ? 'auto' : 'smooth' });
    setActive(id);
    try { history.replaceState(history.state, '', `#${id}`); } catch { /* ignore */ }
  }, [navRef]);

  const { status } = useAuth();
  const authed = status === 'authed';
  const start = authed ? '/app' : '/register';

  return (
    <div className="landing" ref={rootRef}>
      <header className="nav">
        <Link className="brand" to="/" aria-label="لم المتراكم — الصفحة التعريفية">
          <span className="brand-mark" aria-hidden="true"><BrandMark size={24} /></span>
          <b>لم المتراكم</b>
        </Link>

        <nav
          className={`nav-links${pill.placed ? ' is-placed' : ''}`}
          aria-label="أقسام الصفحة"
          ref={navRef}
        >
          <span
            className="nav-pill"
            aria-hidden="true"
            style={{ left: `${pill.left}px`, width: `${pill.width}px` }}
          />
          {NAV_LINKS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => goToSection(e, id)}
              aria-current={active === id ? 'true' : undefined}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="nav-end">
          <MotionSwitch />
          <ThemeIconButton />
          {authed ? (
            <Link className="btn btn-primary btn-sm" to="/app">حسابي</Link>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm btn-hide-sm" to="/login">تسجيل الدخول</Link>
              <Link className="btn btn-primary btn-sm" to="/register">جرّب الموقع</Link>
            </>
          )}
        </div>

        <span className="nav-progress" aria-hidden="true" />
      </header>

      <main>
        <div className="wrap">
          <section className="hero">
            <div className="hero-in">
              <p className="eyebrow" style={{ '--i': 0 }}>للثانوية العامة · دفعة ٢٠٢٧</p>
              <h1 aria-label={HERO_TITLE.join(' ')}>
                {HERO_TITLE.map((word, i) => (
                  <Fragment key={`${word}-${i}`}>
                    <span
                      className={`w${i === HERO_ACCENT ? ' hl' : ''}`}
                      style={{ '--wi': i }}
                      aria-hidden="true"
                    >
                      {word}
                    </span>
                    {i < HERO_TITLE.length - 1 ? ' ' : null}
                  </Fragment>
                ))}
              </h1>
              <p className="lead" style={{ '--i': 2 }}>
                منهجك الرسمي جاهز من فهرس الوزارة، بتحدد وضع كل درس، والموقع يرتّب لك تبدأ منين،
                من غير ما تضيع وقتك في التفكير
              </p>
              <div className="cta-row" style={{ '--i': 3 }}>
                <Link className="btn btn-primary" to={start}>
                  {authed ? 'كمّل لحسابك' : 'جرّب الموقع الآن'}
                  <span className="arr" aria-hidden="true">←</span>
                </Link>
                <Link className="btn btn-ghost" to={authed ? '/app/planner' : '/login'}>
                  {authed ? 'افتح خطتك' : 'تسجيل الدخول'}
                </Link>
              </div>
              <p className="fine" style={{ '--i': 4 }}>
                الحساب بيحفظ بياناتك على السيرفر، وتقدر تكمّل من أي جهاز،
                مفيش شرح دروس أو أسئلة لسه — الفهرس والخطة والتقدم شغالين فعلًا
              </p>
            </div>

            <aside className="plan-sheet hero-item" aria-label="مثال توضيحي لخطة اليوم">
              <div className="sheet-head">
                <span className="sheet-kicker">خطة النهاردة</span>
                <span className="sheet-tag">مثال توضيحي</span>
              </div>
              <ul className="sheet-rows">
                {SESSIONS.map(([title, note], i) => (
                  <li className="sheet-row" key={title} style={{ '--si': i }}>
                    <span className="row-n" aria-hidden="true">{['٠١', '٠٢', '٠٣'][i]}</span>
                    <span className="row-body"><b>{title}</b><small>{note}</small></span>
                    <span className="row-meta">٤٥ دقيقة</span>
                  </li>
                ))}
              </ul>
              <div className="sheet-foot">
                <span className="sheet-rule" aria-hidden="true" />
                <p>ده شكل متوقع لخطة اليوم، ومش بيانات حقيقية</p>
              </div>
            </aside>
          </section>

          <section className="sec" id="how">
            <div className="sec-head reveal">
              <h2>إزاي بيشتغل؟</h2>
              <p>تلات خطوات بسيطة، وبعدها الموقع يقولك تبدأ منين</p>
            </div>
            <div className="steps">
              {STEPS.map(([title, body], i) => (
                <article className="step reveal" key={title}>
                  <span className="step-n">{['٠١', '٠٢', '٠٣'][i]}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="sec" id="features">
            <div className="sec-head reveal">
              <h2>اللي موجود دلوقتي في الموقع</h2>
              <p>كل حاجة هنا شغالة فعلًا في النسخة الحالية</p>
            </div>
            <div className="feats">
              {FEATURES.map(([Icon, title, body], i) => (
                <article className="feat reveal" key={title}>
                  <div className="feat-top">
                    <span className="feat-idx">{`٠${i + 1}`}</span>
                    <Icon size={17} />
                  </div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="sec" id="tracks">
            <div className="sec-head reveal">
              <h2>اختار شعبتك</h2>
              <p>الموقع متصمم للشعب التلاتة</p>
            </div>
            <div className="tracks">
              {TRACKS.map(([mark, name, body]) => (
                <article className="track reveal" key={name}>
                  <div className="track-ico" aria-hidden="true">{mark}</div>
                  <h3>{name}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
            <p className="track-note reveal">
              المنهج بيتضاف من كتب الوزارة، ومفيش دروس مكتوبة من عندنا،
              كتاب الأحياء لسه ما وصلناش، فالفهرس بتاعه ظاهر بملاحظة واضحة لحد ما يوصله
            </p>
          </section>

          <section className="sec" id="soon">
            <div className="soon reveal">
              <div className="soon-head">
                <h2>الجاي بعد كده</h2>
                <p className="soon-lead">اقسم ب الله ما عارف هبقي ادورها في دماغي</p>
              </div>
              <ul>
                {SOON.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </section>

          <section className="cta reveal" aria-labelledby="ctaTitle">
            <h2 id="ctaTitle">ابدأ من مكانك دلوقتي</h2>
            <p>مش لازم تخلص كل حاجة مرة واحدة، المهم تبدأ وتستمر</p>
            <div className="cta-row">
              <Link className="btn btn-primary" to={start}>
                {authed ? 'كمّل لحسابك' : 'جرّب الموقع'}
                <span className="arr" aria-hidden="true">←</span>
              </Link>
              <Link className="btn btn-ghost" to={authed ? '/app/subjects' : '/login'}>
                {authed ? 'شوف المواد' : 'تسجيل الدخول'}
              </Link>
            </div>
          </section>
        </div>
      </main>

      <footer>
        <div className="wrap">
          <span>لم المتراكم · نسخة 2026/2027 · بياناتك محفوظة على حسابك</span>
          <nav aria-label="روابط سريعة">
            <Link to="/">الموقع</Link>
            <Link to="/login">تسجيل الدخول</Link>
            <Link to="/register">إنشاء حساب</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
