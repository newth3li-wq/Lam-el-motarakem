'use strict';
// Seeds the official curriculum into PostgreSQL. Safe to run more than once.
// Usage: DATABASE_URL=postgres://... npm run seed
const { data, buildSeed } = require('../src/curriculum');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('حط DATABASE_URL الأول، مثال: DATABASE_URL=postgres://... npm run seed');
    process.exit(1);
  }

  const pg = require('pg');
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const client = await pool.connect();
  const minutes = new Map(buildSeed().lessons.map((l) => [l.id, l.estMinutes]));
  let subjectCount = 0, unitCount = 0, lessonCount = 0;

  try {
    await client.query('begin');

    for (const subject of data.subjects) {
      const track = subject.tracks.length === 1 ? subject.tracks[0] : null;
      await client.query(
        `insert into subjects(id,name,track,optional) values ($1,$2,$3::track,$4)
         on conflict (id) do update set name=excluded.name, track=excluded.track, optional=excluded.optional`,
        [subject.id, subject.name, track, !!subject.optional]
      );
      subjectCount += 1;

      let ord = 0;
      for (let ui = 0; ui < subject.units.length; ui += 1) {
        const unit = subject.units[ui];
        const unitId = `${subject.id}__${unit.id}`;
        await client.query(
          `insert into units(id,subject_id,title,ord) values ($1,$2,$3,$4)
           on conflict (id) do update set subject_id=excluded.subject_id, title=excluded.title, ord=excluded.ord`,
          [unitId, subject.id, unit.title, ui + 1]
        );
        unitCount += 1;

        for (const lesson of unit.lessons) {
          ord += 1;
          await client.query(
            `insert into lessons(id,subject_id,unit_id,title,ord,est_minutes,book_page,owner_id)
             values ($1,$2,$3,$4,$5,$6,$7,null)
             on conflict (id) do update set subject_id=excluded.subject_id, unit_id=excluded.unit_id,
               title=excluded.title, ord=excluded.ord, est_minutes=excluded.est_minutes, book_page=excluded.book_page
             where lessons.owner_id is null`,
            [lesson.id, subject.id, unitId, lesson.title, ord, minutes.get(lesson.id) ?? 45, lesson.page ?? null]
          );
          lessonCount += 1;
        }
      }
    }

    // remove official lessons that no longer exist in the curriculum (custom lessons are untouched)
    const ids = buildSeed().lessons.map((l) => l.id);
    const subjectIds = data.subjects.map((s) => s.id);
    const removed = await client.query(
      `delete from lessons where owner_id is null and subject_id = any($1::text[]) and not (id = any($2::text[]))`,
      [subjectIds, ids]
    );

    await client.query('commit');
    console.log(`تم: ${subjectCount} مادة، ${unitCount} وحدة، ${lessonCount} درس رسمي.`);
    if (removed.rowCount) console.log(`اتشال ${removed.rowCount} درس قديم مش في الفهرس.`);
  } catch (err) {
    await client.query('rollback');
    console.error('فشل التحديث، مفيش حاجة اتغيّرت:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
