-- لم المتراكم — PostgreSQL schema (v1). Works on Neon / Supabase / any Postgres 13+.
-- Curriculum tables are filled from the official books' tables of contents by
-- `npm run seed` (see app/shared/curriculum.json). No lesson titles are invented.

create type track as enum ('literary', 'science', 'math');
create type lesson_status as enum ('not_started', 'in_progress', 'done');

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null check (position('@' in email) > 1),
  password_hash text not null,                 -- argon2id / bcrypt hash, never the password
  created_at    timestamptz not null default now()
);
create unique index users_email_lower_uq on users (lower(email));

create table auth_sessions (                   -- server-side sessions (revocable)
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null unique,             -- store only a hash of the session token
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index auth_sessions_user_idx on auth_sessions (user_id);

create table profiles (
  user_id      uuid primary key references users(id) on delete cascade,
  display_name text not null default '',
  track        track,
  exam_date    date,
  second_language text check (second_language is null or second_language in ('lang2_french','lang2_german','lang2_spanish','lang2_italian')),
  avatar_data  bytea check (avatar_data is null or octet_length(avatar_data) <= 204800),  -- ≤ 200 KB, resized client-side
  avatar_mime  text  check (avatar_mime is null or avatar_mime in ('image/jpeg','image/png','image/webp')),
  onboarded_at timestamptz,
  updated_at   timestamptz not null default now()
);

create table availability (                    -- study minutes per weekday (0 = Sunday)
  user_id uuid not null references users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  minutes integer not null check (minutes between 0 and 1440),
  primary key (user_id, weekday)
);
create table availability_overrides (          -- one-off day changes (trip, sick day, free day)
  user_id uuid not null references users(id) on delete cascade,
  day     date not null,
  minutes integer not null check (minutes between 0 and 1440),
  primary key (user_id, day)
);

-- Curriculum (seeded from app/shared/curriculum.json by `npm run seed`)
create table subjects (
  id       text primary key,
  name     text not null,
  track    track,                               -- null = shared by all tracks
  optional boolean not null default false       -- second language: only shown when the student picks it
);
create table units (
  id         text primary key,
  subject_id text not null references subjects(id) on delete cascade,
  title      text not null,
  ord        integer not null
);
create table lessons (
  id            text primary key,
  subject_id    text not null references subjects(id) on delete cascade,
  unit_id       text references units(id) on delete set null,
  title         text not null,
  ord           integer not null,
  est_minutes   integer not null default 45 check (est_minutes between 5 and 480),
  release_date  date,                           -- when school covers it (drives "protect the new")
  book_page     integer,                        -- page in the official book (from its table of contents)
  owner_id      uuid references users(id) on delete cascade   -- null = official lesson, set = created by that student
);
create index lessons_owner_idx on lessons (owner_id) where owner_id is not null;
create index lessons_subject_idx on lessons (subject_id, ord);

create table user_subjects (                   -- per-student view of a subject
  user_id    uuid not null references users(id) on delete cascade,
  subject_id text not null references subjects(id) on delete cascade,
  weakness   smallint not null default 2 check (weakness between 1 and 3),   -- 3 = weakest
  exam_date  date,                              -- optional, falls back to profiles.exam_date
  primary key (user_id, subject_id)
);
create table user_lessons (                    -- the student's progress
  user_id      uuid not null references users(id) on delete cascade,
  lesson_id    text not null references lessons(id) on delete cascade,
  status       lesson_status not null default 'not_started',
  est_override integer check (est_override is null or est_override between 5 and 480),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index user_lessons_status_idx on user_lessons (user_id, status);

create table study_sessions (                  -- real time studied (focus timer / manual log)
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  lesson_id  text references lessons(id) on delete set null,
  minutes    integer not null check (minutes between 1 and 600),
  studied_on date not null,
  created_at timestamptz not null default now()
);
create index study_sessions_user_day_idx on study_sessions (user_id, studied_on);
