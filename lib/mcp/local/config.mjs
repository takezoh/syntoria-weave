import {constants as fsConstants} from 'node:fs';
import {open} from 'node:fs/promises';
import {isAbsolute, relative, resolve, sep} from 'node:path';
import {LocalMcpError} from './errors.mjs';

export const CALLBACK_URL = 'http://127.0.0.1:55437/callback';
export const CLIENT_REDIRECT_URI = CALLBACK_URL;
const MAX_CONFIG_BYTES = 8 * 1024;
const ALLOWED_KEYS = new Set(['issuer', 'resourceEndpoint', 'clientId', 'dataDirectory']);

function httpsUrl(value, name, {pathRequired = false} = {}) {
  if (typeof value !== 'string' || value.length > 2048 || value !== value.trim()) {
    throw new LocalMcpError('configuration_invalid', `The configured ${name} is missing or invalid.`);
  }
  let url;
  try { url = new URL(value); } catch {
    throw new LocalMcpError('configuration_invalid', `The configured ${name} must be an absolute HTTPS URL.`);
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash || (pathRequired && url.pathname === '/')) {
    throw new LocalMcpError('configuration_invalid', `The configured ${name} must be an absolute HTTPS URL without credentials, query, or fragment.`);
  }
  if (url.href !== value && !(name === 'issuer' && url.pathname === '/' && url.origin === value)) {
    throw new LocalMcpError('configuration_invalid', `The configured ${name} must use its exact canonical URL spelling.`);
  }
  return value;
}

export function validateLocalConfiguration(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new LocalMcpError('configuration_invalid', 'The local action-service configuration must be a JSON object.');
  }
  const unknown = Object.keys(input).filter(key => !ALLOWED_KEYS.has(key));
  if (unknown.length) throw new LocalMcpError('configuration_invalid', 'The local action-service configuration contains unsupported fields.');
  const issuer = httpsUrl(input.issuer, 'issuer');
  const resourceEndpoint = httpsUrl(input.resourceEndpoint, 'resource endpoint', {pathRequired: true});
  if (typeof input.clientId !== 'string' || !input.clientId.trim() || input.clientId.length > 256 || /[\u0000-\u001f\u007f]/.test(input.clientId)) {
    throw new LocalMcpError('configuration_invalid', 'The registered public OAuth client ID must be set explicitly.');
  }
  let dataDirectory;
  if (input.dataDirectory !== undefined) {
    if (typeof input.dataDirectory !== 'string' || !isAbsolute(input.dataDirectory)) {
      throw new LocalMcpError('configuration_invalid', 'dataDirectory must be an explicit absolute path outside the plugin install.');
    }
    dataDirectory = resolve(input.dataDirectory);
  }
  return Object.freeze({issuer, resourceEndpoint, clientId: input.clientId, dataDirectory});
}

export async function loadLocalConfiguration(configPath) {
  if (typeof configPath !== 'string' || !configPath.trim()) {
    throw new LocalMcpError('configuration_required', 'Configure issuer, resourceEndpoint, and clientId, then rebuild the plugin with --config.');
  }
  if (!isAbsolute(configPath)) throw new LocalMcpError('configuration_invalid', 'The local configuration path must be absolute.');
  let handle;
  try {
    handle = await open(configPath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_CONFIG_BYTES) throw new LocalMcpError('configuration_invalid', 'The local action-service configuration file is invalid or too large.');
    const text = await handle.readFile('utf8');
    let value;
    try { value = JSON.parse(text); } catch { throw new LocalMcpError('configuration_invalid', 'The local action-service configuration is not valid JSON.'); }
    return validateLocalConfiguration(value);
  } catch (error) {
    if (error instanceof LocalMcpError) throw error;
    if (error?.code === 'ENOENT') throw new LocalMcpError('configuration_required', 'The operator-rendered config.json is missing. Render endpoint and public-client settings, then rebuild the plugin with --config.');
    if (error?.code === 'ELOOP') throw new LocalMcpError('configuration_invalid', 'The local action-service configuration cannot be a symbolic link.');
    throw new LocalMcpError('configuration_unavailable', 'The local action-service configuration could not be read.', {cause: error});
  } finally {
    await handle?.close().catch(() => {});
  }
}

export function configurationBinding(config) {
  return JSON.stringify({issuer: config.issuer, resourceEndpoint: config.resourceEndpoint, clientId: config.clientId, redirectUri: CALLBACK_URL});
}

export function resolvePrivateDataDirectory(config, env = {}, installRoot) {
  const fromHost = typeof env.PLUGIN_DATA === 'string' && env.PLUGIN_DATA.trim() && !env.PLUGIN_DATA.includes('${')
    ? env.PLUGIN_DATA.trim()
    : undefined;
  const dataDirectory = fromHost ?? config.dataDirectory;
  if (!dataDirectory) {
    throw new LocalMcpError('private_data_path_required', 'Set the host PLUGIN_DATA directory or configure an explicit absolute dataDirectory outside the plugin install.');
  }
  if (!isAbsolute(dataDirectory)) throw new LocalMcpError('private_data_path_required', 'The private token directory must be an absolute path.');
  const target = resolve(dataDirectory);
  if (installRoot) {
    const fromInstall = relative(resolve(installRoot), target);
    if (fromInstall === '' || (fromInstall !== '..' && !fromInstall.startsWith(`..${sep}`) && !isAbsolute(fromInstall))) {
      throw new LocalMcpError('private_data_path_required', 'The token directory must be outside the plugin install.');
    }
  }
  return target;
}
