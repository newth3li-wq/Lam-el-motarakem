-- ============================================================
--  Baseline subjects only. The real curriculum is seeded by:
--      DATABASE_URL=postgres://... npm run seed
--
--  `npm run seed` reads app/shared/curriculum.json (transcribed from the
--  official ministry tables of contents), then inserts/updates subjects,
--  units and lessons. It is safe to run more than once and it never touches
--  lessons created by students.
--
--  This file exists for manual setups where the Node seeder cannot run.
--  It intentionally contains NO lessons: do not invent curriculum rows.
-- ============================================================

insert into subjects (id, name, track, optional) values
  ('arabic',           'اللغة العربية',      null,       false),
  ('english',          'اللغة الإنجليزية',   null,       false),
  ('history',          'التاريخ',            'literary', false),
  ('geography',        'الجغرافيا',          'literary', false),
  ('statistics',       'الإحصاء',            'literary', false),
  ('physics_science',  'الفيزياء',           'science',  false),
  ('physics_math',     'الفيزياء',           'math',     false),
  ('chemistry_science','الكيمياء',           'science',  false),
  ('chemistry_math',   'الكيمياء',           'math',     false),
  ('biology_science',  'الأحياء',            'science',  false),
  ('pure_math',        'الرياضيات البحتة',   'math',     false),
  ('applied_math',     'الرياضيات التطبيقية','math',     false),
  ('lang2_french',     'اللغة الفرنسية',     null,       true),
  ('lang2_german',     'اللغة الألمانية',    null,       true),
  ('lang2_spanish',    'اللغة الإسبانية',    null,       true),
  ('lang2_italian',    'اللغة الإيطالية',    null,       true)
on conflict (id) do update set
  name     = excluded.name,
  track    = excluded.track,
  optional = excluded.optional;
