'use strict';
const loadConfig = require('./config');
const { createServer } = require('./app');
const { buildSeed } = require('./curriculum');
const config = loadConfig();
let store;
if (config.databaseUrl) { store = require('./stores/pgStore').createPgStore(config.databaseUrl); console.log('Store: PostgreSQL'); }
else {
  if (config.nodeEnv === 'production') { console.error('DATABASE_URL is required in production'); process.exit(1); }
  store = require('./stores/memoryStore').createMemoryStore(); console.log('Store: in-memory (dev only, data is lost on restart)');
  const seed = buildSeed();
  store.seed(seed).then(() => {
    console.log(`Curriculum: ${seed.subjects.length} subjects, ${seed.lessons.length} official lessons`);
  });
}
const server = createServer({ store, config });
server.listen(config.port, () => console.log(`API listening on :${config.port}`));
const stop = () => server.close(() => store.close().then(() => process.exit(0)));
process.on('SIGTERM', stop); process.on('SIGINT', stop);
