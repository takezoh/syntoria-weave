import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchMcp} from '../../lib/mcp/dispatcher.ts';

async function dispatch(method, params = {}, canWrite = true) {
  const response = await dispatchMcp({jsonrpc: '2.0', id: 1, method, params}, async () => ({}), canWrite);
  assert.equal(response.status, 200);
  return response.body.result;
}

test('Node MCP exposes one shared UI launcher and the current action resource', async () => {
  const tools = (await dispatch('tools/list')).tools;
  const open = tools.find(tool => tool.name === 'open_actions');
  const list = tools.find(tool => tool.name === 'list_actions');

  assert.deepEqual(open._meta['openai/ui'].entrypoints, [{type: 'global'}, {type: 'thread'}]);
  assert.equal(open.title, 'Syntoria Weave');
  assert.equal(list._meta['openai/ui'], undefined);
  assert.equal(list._meta.ui.resourceUri, open._meta.ui.resourceUri);

  const resources = (await dispatch('resources/list')).resources;
  assert.deepEqual(resources.map(resource => resource.uri), [open._meta.ui.resourceUri,'action-state://current']);
});

test('Node MCP resource retains HTML identity and bounded host metadata', async () => {
  const tools = (await dispatch('tools/list')).tools;
  const uri = tools.find(tool => tool.name === 'open_actions')._meta.ui.resourceUri;
  const content = (await dispatch('resources/read', {uri})).contents[0];

  assert.equal(content.uri, uri);
  assert.equal(content.mimeType, 'text/html;profile=mcp-app');
  assert.deepEqual(content._meta['openai/ui'].availableDisplayModes, ['inline', 'fullscreen']);
  assert.equal(content._meta['openai/widgetDescription'], 'Structured actions: normal, deferred, completed, details and safe editing.');
  assert.deepEqual(content._meta.ui.csp, {connectDomains: [], resourceDomains: []});
  assert.equal(content._meta.ui.prefersBorder, true);
  assert.match(content.text, /<!doctype html>/i);
});

test('Node MCP publishes the current typed tool and Perspective schemas', async () => {
  const tools = (await dispatch('tools/list')).tools;
  assert.deepEqual(tools.map(tool => tool.name).sort(), [
    'add_action', 'apply_change', 'capture_intent', 'get_change_cursor', 'get_changes', 'get_relevant_context',
    'list_actions', 'list_perspectives', 'open_actions', 'operation_status', 'preview_change',
    'query_actions', 'query_perspective', 'rename_action', 'undo_change',
    'list_collaborations','get_collaboration','propose_collaboration','update_collaboration',
  ].sort());

  const apply = tools.find(tool => tool.name === 'apply_change');
  for (const name of ['add_action', 'rename_action']) {
    const title = tools.find(tool => tool.name === name).inputSchema.properties.title;
    assert.equal(title.maxLength, 200);
    assert.equal(title.minLength, 1);
  }
  assert.equal(tools.find(tool => tool.name === 'capture_intent').inputSchema.properties.title.minLength, 1);
  assert.match(apply.description, /tag_ids/);
  assert.match(apply.description, /one request/);
  assert(apply.inputSchema.properties.kind.enum.includes('action_move'));
  assert.match(apply.description, /placement/);

  const condition = kind => apply.inputSchema.allOf.find(item => item.if?.properties?.kind?.const === kind).then.properties.payload;
  const add = condition('perspective_add');
  assert.deepEqual(add.oneOf.map(schema => schema.required).sort((a, b) => a[1].localeCompare(b[1])), [['name', 'filter'], ['name', 'query']]);
  assert(add.oneOf.every(schema => schema.additionalProperties === false));
  const edit = condition('perspective_edit');
  assert.equal(edit.oneOf.length, 3);
  assert(edit.oneOf.every(schema => schema.additionalProperties === false));

  const query = add.oneOf.find(schema => schema.properties.query).properties.query;
  assert.equal(query.properties.order_by.maxItems, 8);
  assert.match(query.description, /32/);
  assert.match(query.description, /256/);
  const recursive = query.properties.where.$ref;
  assert.equal(recursive, '#/$defs/perspectiveCondition');
  const leaves = apply.inputSchema.$defs.perspectiveCondition.oneOf;
  assert(leaves.some(schema => schema.properties?.not?.$ref === recursive));
  assert(leaves.some(schema => schema.properties?.field?.enum?.includes('project_id')
    && schema.properties?.op?.enum?.includes('not_in')
    && schema.properties?.values?.items?.anyOf?.some(item => item.type === 'null')
    && schema.properties?.include_descendants?.type === 'boolean'));
  assert(leaves.some(schema => schema.properties?.field?.const === 'status' && schema.properties?.value?.enum?.includes('on-hold')));
  assert(leaves.some(schema => schema.properties?.field?.enum?.includes('flagged') && schema.properties?.value?.type === 'boolean'));

  const order = query.properties.order_by.items;
  assert.deepEqual(order.required, ['field', 'direction']);
  assert.deepEqual(order.properties.direction.enum, ['asc', 'desc']);
  assert.deepEqual(order.properties.nulls.enum, ['first', 'last']);
  assert.match(apply.description, /V1 include_descendants omission is false/);
  assert.match(apply.description, /V2 project\/tag leaves default include_descendants to true when omitted/);
});

test('Node MCP initialize shares the current versioned Perspective and Defer policy', async () => {
  const tools = (await dispatch('tools/list')).tools;
  const apply = tools.find(tool => tool.name === 'apply_change');
  for (const text of [
    'V1 definitions use filter; V2 definitions use query.',
    'A V2 definition cannot be downgraded.',
    'Metadata-only edits preserve the current definition version and contents.',
    'omitted include_descendants is false.',
    'Project and Tag leaves expand descendants by default when include_descendants is omitted',
    'order_by globally sorts only matching Actions',
    'without inserting unmatched parents or changing saved Action order.',
    'Existing V1 canonical requests, receipts and deltas remain readable and replayable',
  ]) assert((await dispatch('initialize')).instructions.includes(text), text);

  for (const name of ['preview_change', 'apply_change']) {
    const tool = tools.find(item => item.name === name);
    const payload = tool.inputSchema.allOf.find(item => item.if?.properties?.kind?.const === 'defer').then.properties.payload;
    assert.deepEqual(payload.required, ['id']);
    assert.equal(payload.additionalProperties, false);
    assert.deepEqual(payload.oneOf, [
      {required: ['date', 'timezone'], not: {required: ['until']}},
      {required: ['until'], not: {required: ['date']}},
    ]);
    assert(new RegExp(payload.properties.date.pattern).test('2026-10-10'));
    const instant = new RegExp(payload.properties.until.anyOf.find(item => item.type === 'string').pattern);
    assert(!instant.test('2026-10-10'));
    assert(!instant.test('2026-10-10T09:00:00'));
    assert(instant.test('2026-10-10T09:00:00+09:00'));
    assert(instant.test('2026-10-10T00:00:00.000Z'));
    assert.match(tool.description, /timezone/);
    assert.match(tool.description, /Never|never/);
  }
  assert.equal(apply.inputSchema.properties.kind.enum.includes('action_move'), true);
  const readOnlyTools = (await dispatch('tools/list', {}, false)).tools;
  assert.equal(readOnlyTools.some(tool => tool.name === 'open_verification'), false);
});
