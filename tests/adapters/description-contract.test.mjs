import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actionCallForUser, createD1ActionStore} from '../helpers/user-composition.mjs';
import {sqliteFixture} from '../helpers/sqlite-d1.mjs';

test('isolated D1 adapter preserves exact catalog descriptions, replay and user scope', async t => {
  const fixture = sqliteFixture();
  t.after(() => fixture.sql.close());
  const ports = {
    store: createD1ActionStore(fixture.db),
    clock: () => '2026-10-03T00:00:00.000Z',
    newId: () => crypto.randomUUID(),
  };
  const call = (user, name, args = {}) => actionCallForUser(ports, user, name, args);
  const write = (revision, kind, payload) => ({
    schemaVersion: 2,
    operationId: crypto.randomUUID(),
    expectedRevision: revision,
    kind,
    payload,
  });

  let revision = 0;
  for (const kind of ['project', 'tag', 'perspective']) {
    const key = kind === 'perspective' ? 'perspectives' : kind + 's';
    const raw = '  exact\r\n日本語 🐈  ';
    const create = kind === 'perspective' ? 'perspective_add' : kind + '_add';
    const input = write(revision, create, {
      name: kind,
      description: raw,
      ...(kind === 'perspective' ? {filter: {}} : {}),
    });
    const saved = await call('A', 'apply_change', input);
    assert.equal(saved[key][0].description, raw);
    revision = saved.revision;

    const read = await call('A', 'list_actions');
    assert.equal(read[key][0].description, raw);

    const edit = write(revision, kind + '_edit', {id: saved[key][0].id, description: ''});
    const edited = await call('A', 'apply_change', edit);
    revision = edited.revision;
    assert.equal(edited[key][0].description, '');
    assert.equal((await call('A', 'apply_change', edit)).revision, revision);

    const invalid = write(revision, kind + '_edit', {id: saved[key][0].id, description: null});
    await assert.rejects(call('A', 'apply_change', invalid), error => error.code === 'invalid_input');
    assert.deepEqual((await call('B', 'list_actions'))[key], []);
  }
});
