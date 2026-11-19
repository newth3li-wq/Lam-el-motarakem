import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { navigate } from '../router';
import { Search } from './Icons';

const strip = (text) =>
  String(text || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();

export default function GlobalSearch() {
  const { token, status } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [data, setData] = useState({ lessons: [], subjects: [] });
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (status !== 'authed') return undefined;
    let live = true;
    (async () => {
      const [lessonsRes, subjectsRes] = await Promise.allSettled([
        api('/api/lessons', { token }),
        api('/api/subjects', { token })
      ]);
      if (!live) return;
      setData({
        lessons: lessonsRes.status === 'fulfilled' ? lessonsRes.value.lessons || [] : [],
        subjects: subjectsRes.status === 'fulfilled' ? subjectsRes.value.subjects || [] : []
      });
    })();
    return () => { live = false; };
  }, [token, status]);

  const names = useMemo(
    () => Object.fromEntries(data.subjects.map((s) => [s.id, s.name])),
    [data.subjects]
  );

  const results = useMemo(() => {
    const needle = strip(q);
    if (needle.length < 2) return [];
    const scored = [];
    for (const lesson of data.lessons) {
      const subject = names[lesson.subjectId] || '';
      const haystack = strip(`${lesson.title} ${lesson.unitTitle || ''} ${subject}`);
      const at = haystack.indexOf(needle);
      if (at === -1) continue;
      scored.push({ lesson, subject, score: at + (strip(lesson.title).startsWith(needle) ? -10 : 0) });
    }
    return scored.sort((a, b) => a.score - b.score).slice(0, 8);
  }, [q, data.lessons, names]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (lesson) => {
    navigate(`/app/subjects?lesson=${encodeURIComponent(lesson.id)}`);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="global-search" role="search" ref={boxRef}>
      <span className="gs-icon" aria-hidden="true"><Search size={17} /></span>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) { e.preventDefault(); go(results[0].lesson); }
        }}
        type="search"
        placeholder="ابحث عن مادة أو درس"
        autoComplete="off"
        aria-label="ابحث عن مادة أو درس"
        aria-expanded={open && q.trim().length >= 2}
      />

      {open && q.trim().length >= 2 ? (
        <div className="search-results">
          {results.length ? (
            results.map(({ lesson, subject }) => (
              <button type="button" className="search-hit" key={lesson.id} onClick={() => go(lesson)}>
                <span className="search-hit-main">
                  <b dir={/^[A-Za-z]/.test(lesson.title) ? 'ltr' : undefined}>{lesson.title}</b>
                  <small>
                    {subject}
                    {lesson.page ? ` · صفحة ${lesson.page}` : ''}
                    {lesson.status === 'done' ? ' · خلصته' : ''}
                  </small>
                </span>
                <span className="search-hit-go" aria-hidden="true">←</span>
              </button>
            ))
          ) : (
            <p className="search-empty">مفيش نتيجة للبحث ده، جرّب اسم المادة أو جزء من عنوان الدرس</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
