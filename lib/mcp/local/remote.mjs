import {randomUUID} from 'node:crypto';
import {LocalMcpError} from './errors.mjs';

const MAX_REMOTE_BYTES = 4 * 1024 * 1024;
const REMOTE_TIMEOUT_MS = 20_000;

function isReadOnly(definitions, name) {
  return definitions.find(tool => tool.name === name)?.annotations?.readOnlyHint === true;
}

function isValidWireResponse(wire, requestId) {
  return wire && typeof wire === 'object' && !Array.isArray(wire) && wire.jsonrpc === '2.0' && wire.id === requestId && (Object.hasOwn(wire, 'result') !== Object.hasOwn(wire, 'error'));
}

function isValidWireError(wire) {
  return wire.error === undefined || (wire.error !== null && typeof wire.error === 'object' && !Array.isArray(wire.error) && Number.isInteger(wire.error.code) && typeof wire.error.message === 'string');
}

function safeDenialText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
}

async function parseForbiddenResponse(response, requestId) {
  let text = '';
  try { text = await readBounded(response); } catch { /* The HTTP status still establishes a denial. */ }
  let body;
  try { body = JSON.parse(text); } catch { body = null; }
  if (isValidWireResponse(body, requestId) && (body.error === undefined || isValidWireError(body))) return {wire: body};

  const challenge = response.headers.get('www-authenticate') ?? '';
  const remoteCode = typeof body?.error === 'string' ? body.error : typeof body?.code === 'string' ? body.code : '';
  const message = safeDenialText(body?.error_description ?? body?.message ?? body?.detail ?? '');
  const classification = `${remoteCode} ${message} ${challenge}`.toLowerCase();
  if (/insufficient[\s_-]*scope/.test(classification)) {
    return {error: new LocalMcpError('insufficient_scope', message || 'The action service denied the required authorization scope. Update the client permissions and reconnect if the service requires new consent.')};
  }
  if (/(?:write|mutation|change).*(?:disabled|denied)|read[\s_-]*only/.test(classification)) {
    return {error: new LocalMcpError('write_disabled', message || 'The action service denied write access. Enable write access in the service configuration; reconnecting does not change that setting.')};
  }
  return {error: new LocalMcpError('access_denied', message || 'The action service denied this request (HTTP 403). Check the permission required for this operation; reconnecting does not change server-side access.')};
}

async function readBounded(response) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_REMOTE_BYTES) {
    await response.body?.cancel();
    throw new LocalMcpError('authorization_unavailable', 'The action service response exceeded the local size limit.');
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REMOTE_BYTES) {
        await reader.cancel();
        throw new LocalMcpError('authorization_unavailable', 'The action service response exceeded the local size limit.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}

async function parseWireResponse(response, requestId, readOnly) {
  let wire;
  try { wire = JSON.parse(await readBounded(response)); }
  catch (error) {
    if (error instanceof LocalMcpError && readOnly) throw error;
    if (!readOnly) throw new LocalMcpError('outcome_unknown', 'The action service response could not be verified after a write may have started. Retain the exact tool arguments and operationId, then check the result before retrying.', {cause: error});
    throw new LocalMcpError('authorization_unavailable', 'The action service returned an invalid JSON-RPC response.', {cause: error});
  }
  if (!isValidWireResponse(wire, requestId)) {
    if (!readOnly) throw new LocalMcpError('outcome_unknown', 'The action service response could not be matched to the write. Retain the exact tool arguments and operationId, then check the result before retrying.');
    throw new LocalMcpError('authorization_unavailable', 'The action service returned an invalid JSON-RPC response.');
  }
  if (!isValidWireError(wire)) {
    if (!readOnly) throw new LocalMcpError('outcome_unknown', 'The action service returned an invalid error response after a write may have started. Retain the exact tool arguments and operationId, then check the result before retrying.');
    throw new LocalMcpError('authorization_unavailable', 'The action service returned an invalid JSON-RPC error.');
  }
  return wire;
}

export async function forwardBusinessCall({config, oauth, definitions, fetcher = globalThis.fetch}, name, args) {
  const readOnly = isReadOnly(definitions, name);
  const accessToken = await oauth.accessToken();
  const requestId = randomUUID();
  const body = JSON.stringify({jsonrpc: '2.0', id: requestId, method: 'tools/call', params: {name, arguments: args}});
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetcher(config.resourceEndpoint, {
        method: 'POST',
        headers: {'accept': 'application/json', 'content-type': 'application/json', 'authorization': `Bearer ${accessToken}`, 'mcp-protocol-version': '2025-11-25'},
        body,
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof LocalMcpError) throw error;
      if (readOnly) throw new LocalMcpError('authorization_unavailable', 'The action service could not be reached. Try again after checking the connection.', {cause: error});
      throw new LocalMcpError('outcome_unknown', 'The response was lost after a write may have started. Retain the exact tool arguments and operationId, then check the result before retrying.', {cause: error});
    }
    if (response.status === 401) {
      await response.body?.cancel();
      const invalidation = await oauth.invalidateRejectedAccessToken(accessToken);
      if (invalidation === 'superseded') {
        throw new LocalMcpError('authorization_superseded', 'The action service rejected a token that has since been replaced. The newer local authorization was preserved; retry this request.');
      }
      throw new LocalMcpError('unauthenticated', 'The action service rejected the current authorization. Local credentials were cleared when they still matched; reconnect with connect_action_service.');
    }
    if (response.status === 403) {
      const denial = await parseForbiddenResponse(response, requestId);
      if (denial.wire) return denial.wire;
      throw denial.error;
    }
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      if (readOnly) throw new LocalMcpError('authorization_unavailable', 'The action service attempted an HTTP redirect.');
      throw new LocalMcpError('outcome_unknown', 'The response was redirected after a write may have started. Retain the exact tool arguments and operationId, then check the result before retrying.');
    }
    if (response.status < 200 || response.status >= 300) {
      const rejected = await parseWireResponse(response, requestId, readOnly);
      if (rejected.error !== undefined) return rejected;
      if (response.status >= 500 && !readOnly) {
        throw new LocalMcpError('outcome_unknown', `The action service returned HTTP ${response.status} after a write may have started. Retain the exact tool arguments and operationId, then check the result before retrying.`);
      }
      if (readOnly) throw new LocalMcpError('authorization_unavailable', `The action service returned HTTP ${response.status}.`);
      throw new LocalMcpError('outcome_unknown', `The action service returned HTTP ${response.status} after a write may have started. Retain the exact tool arguments and operationId, then check the result before retrying.`);
    }
    return parseWireResponse(response, requestId, readOnly);
  } finally { clearTimeout(timer); }
}
