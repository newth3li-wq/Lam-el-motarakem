'use strict';
// Runs the same contract against a REAL PostgreSQL: DATABASE_URL=postgres://... npm test  (needs db/schema.sql applied)
const url = process.env.TEST_DATABASE_URL || '';
if (!url) { require('node:test').test('[pg] skipped: set TEST_DATABASE_URL to run against PostgreSQL', { skip: true }, () => {}); }
else {
  const runContract = require('./store.contract');
  const { createPgStore } = require('../src/stores/pgStore');
  runContract('pg', {
    make: async () => createPgStore(url),
    seed: async (s, ids) => {
      const q = (t, p) => s._pool.query(t, p);
      await q("insert into subjects(id,name,track) values ($1,'ل','literary'),($2,'ع','science')", [ids.litSub, ids.sciSub]);
      await q("insert into lessons(id,subject_id,title,ord) values ($1,$2,'دد',1),($3,$4,'دد',1)", [ids.litL, ids.litSub, ids.sciL, ids.sciSub]);
    },
    cleanup: async (s, ids, emails) => {
      await s._pool.query('delete from users where lower(email)=any($1)', [emails.map(e => e.toLowerCase())]);
      await s._pool.query('delete from subjects where id=any($1)', [[ids.litSub, ids.sciSub]]);
    }
  });
}
