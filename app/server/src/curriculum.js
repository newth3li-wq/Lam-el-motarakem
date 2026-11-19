'use strict';
// Official curriculum from the ministry books' tables of contents.
// Titles and page numbers are transcribed from the books in D:\lam. Nothing here is invented.
const data = require('../../shared/curriculum.json');

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function minutesFor(page, nextPage, units, unitIndex, lessonIndex) {
  if (!page) return 45;
  let next = nextPage;
  if (!next) {
    for (let u = unitIndex + 1; u < units.length && !next; u += 1) {
      const p = units[u].lessons.find((l) => l.page)?.page;
      if (p) next = p;
    }
  }
  if (!next || next <= page) return lessonIndex === 0 ? 60 : 45;
  return clamp(Math.round((next - page) * 2.2), 30, 180);
}

function buildSeed() {
  const subjects = [];
  const lessons = [];

  for (const subject of data.subjects) {
    const track = subject.tracks.length === 1 ? subject.tracks[0] : null;
    subjects.push({ id: subject.id, name: subject.name, track, optional: !!subject.optional });

    let ord = 0;
    subject.units.forEach((unit, unitIndex) => {
      unit.lessons.forEach((lesson, lessonIndex) => {
        ord += 1;
        const nextPage = unit.lessons[lessonIndex + 1]?.page;
        lessons.push({
          id: lesson.id,
          subjectId: subject.id,
          title: lesson.title,
          ord,
          estMinutes: lesson.minutes ?? minutesFor(lesson.page, nextPage, subject.units, unitIndex, lessonIndex),
          releaseDate: null,
          unitTitle: unit.title,
          page: lesson.page ?? null
        });
      });
    });
  }

  return { subjects, lessons };
}

function stats() {
  const seed = buildSeed();
  return {
    subjects: seed.subjects.length,
    lessons: seed.lessons.length,
    minutes: seed.lessons.reduce((sum, l) => sum + l.estMinutes, 0)
  };
}

module.exports = { data, buildSeed, stats };
