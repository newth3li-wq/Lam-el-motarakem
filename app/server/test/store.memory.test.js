'use strict';
const runContract = require('./store.contract');
const { createMemoryStore } = require('../src/stores/memoryStore');
runContract('memory', {
  make: async () => createMemoryStore(),
  seed: (s, ids) => s.seed({
    subjects: [{ id: ids.litSub, name: 'ل', track: 'literary' }, { id: ids.sciSub, name: 'ع', track: 'science' }],
    lessons: [{ id: ids.litL, subjectId: ids.litSub, title: 'دد', ord: 1 }, { id: ids.sciL, subjectId: ids.sciSub, title: 'دد', ord: 1 }]
  })
});
