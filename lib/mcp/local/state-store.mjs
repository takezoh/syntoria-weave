import {constants as fsConstants} from 'node:fs';
import {chmod, lstat, mkdir, open} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {isAbsolute, join, resolve, sep} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {LocalMcpError} from './errors.mjs';

const STATE_FILE = 'authorization.sqlite';
const MAX_LOCK_WAIT_MS = 10_000;

const isMissing = error => error?.code === 'ENOENT';

async function assertPrivateDirectory(directory) {
  if (!isAbsolute(directory)) throw new LocalMcpError('private_data_path_required', 'The private token directory must be an absolute path.');
  const target = resolve(directory);
  const parts = target.split(sep).filter(Boolean);
  let current = sep;
  for (const part of parts) {
    current = join(current, part);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new LocalMcpError('private_data_path_invalid', 'The private token directory cannot contain symbolic links or non-directory path components.');
    } catch (error) {
      if (!isMissing(error)) throw error;
      try { await mkdir(current, {mode: 0o700}); }
      catch (createError) { if (createError?.code !== 'EEXIST') throw createError; }
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new LocalMcpError('private_data_path_invalid', 'The private token directory cannot contain symbolic links or non-directory path components.');
    }
  }
  await chmod(target, 0o700);
  return target;
}

async function ensurePrivateDatabaseFile(path) {
  try {
    const handle = await open(path, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | (fsConstants.O_NOFOLLOW ?? 0), 0o600);
    await handle.close();
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      if (error?.code === 'ELOOP') throw new LocalMcpError('private_state_invalid', 'The local authorization state cannot be a symbolic link.');
      throw new LocalMcpError('private_state_unavailable', 'The private authorization state could not be created.', {cause: error});
    }
  }
  let info;
  try { info = await lstat(path); }
  catch (error) { throw new LocalMcpError('private_state_unavailable', 'The private authorization state could not be inspected.', {cause: error}); }
  if (info.isSymbolicLink() || !info.isFile()) throw new LocalMcpError('private_state_invalid', 'The local authorization state must be a regular file, not a symbolic link.');
  if (typeof process.getuid === 'function' && info.uid !== process.getuid()) throw new LocalMcpError('private_state_owner', 'The local authorization state file has a different owner.');
  if ((info.mode & 0o077) !== 0) throw new LocalMcpError('private_state_permissions', 'The local authorization state file must be private to this user.');
  await chmod(path, 0o600);
}

function emptyState(binding, generation = 0) {
  return {version: 1, binding, generation, credentials: null};
}

function isBusy(error) {
  return error?.code === 'ERR_SQLITE_BUSY' || error?.errcode === 5 || /database is (?:locked|busy)/i.test(error?.message ?? '');
}

function parseState(row, binding) {
  if (!row) return emptyState(binding);
  let credentials;
  try { credentials = row.credentials === null ? null : JSON.parse(row.credentials); }
  catch (error) { throw new LocalMcpError('private_state_invalid', 'The local authorization state is invalid and must be disconnected before use.', {cause: error}); }
  if (row.version !== 1 || !Number.isSafeInteger(row.generation) || row.generation < 0 || !(credentials === null || (credentials && typeof credentials === 'object' && !Array.isArray(credentials)))) {
    throw new LocalMcpError('private_state_invalid', 'The local authorization state has an unsupported format.');
  }
  if (row.binding !== binding) return emptyState(binding, row.generation + 1);
  return {version: 1, binding, generation: row.generation, credentials};
}

export class AuthorizationStateStore {
  constructor(directory, binding) {
    this.directory = resolve(directory);
    this.binding = binding;
  }

  async #withTransaction(action) {
    await assertPrivateDirectory(this.directory);
    const path = join(this.directory, STATE_FILE);
    await ensurePrivateDatabaseFile(path);
    let database;
    try {
      database = new DatabaseSync(path);
      database.exec('PRAGMA busy_timeout = 0; PRAGMA synchronous = FULL;');
    } catch (error) {
      database?.close();
      throw new LocalMcpError('private_state_unavailable', 'The private authorization state database could not be opened.', {cause: error});
    }

    const started = Date.now();
    try {
      for (;;) {
        try {
          database.exec('BEGIN IMMEDIATE');
          break;
        } catch (error) {
          if (!isBusy(error)) throw error;
          if (Date.now() - started >= MAX_LOCK_WAIT_MS) throw new LocalMcpError('private_state_busy', 'Another local action-tools process is updating authorization. Retry after it finishes.', {cause: error});
          await delay(35);
        }
      }

      database.exec('CREATE TABLE IF NOT EXISTS authorization_state (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL, binding TEXT NOT NULL, generation INTEGER NOT NULL, credentials TEXT)');
      const select = database.prepare('SELECT version, binding, generation, credentials FROM authorization_state WHERE id = 1');
      const row = select.get();
      let state = parseState(row, this.binding);
      if (!row || row.binding !== this.binding) {
        const upsert = database.prepare('INSERT INTO authorization_state (id, version, binding, generation, credentials) VALUES (1, 1, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET version = 1, binding = excluded.binding, generation = excluded.generation, credentials = NULL');
        upsert.run(state.binding, state.generation);
      }
      const save = next => {
        const encoded = next.credentials === null ? null : JSON.stringify(next.credentials);
        if (encoded !== null && Buffer.byteLength(encoded) > 32 * 1024) throw new LocalMcpError('private_state_invalid', 'The local authorization state is too large.');
        database.prepare('UPDATE authorization_state SET version = 1, binding = ?, generation = ?, credentials = ? WHERE id = 1').run(next.binding, next.generation, encoded);
      };
      const result = await action(state, save);
      database.exec('COMMIT');
      return result;
    } catch (error) {
      if (database.isTransaction) {
        try { database.exec('ROLLBACK'); } catch {}
      }
      if (error instanceof LocalMcpError) throw error;
      throw new LocalMcpError('private_state_unavailable', 'The private authorization state transaction failed.', {cause: error});
    } finally {
      database.close();
    }
  }

  async inspect() {
    return this.#withTransaction(async state => structuredClone(state));
  }

  async disconnect() {
    return this.#withTransaction(async (state, save) => {
      const next = emptyState(this.binding, state.generation + 1);
      save(next);
      return next.generation;
    });
  }

  async invalidatePendingAuthorization(expectedGeneration) {
    return this.#withTransaction(async (state, save) => {
      if (state.generation !== expectedGeneration) return state.generation;
      const next = {...state, generation: state.generation + 1};
      save(next);
      return next.generation;
    });
  }

  async invalidateAccessToken(rejectedAccessToken) {
    if (typeof rejectedAccessToken !== 'string' || rejectedAccessToken.length === 0) {
      throw new LocalMcpError('private_state_invalid', 'The rejected authorization could not be matched to local state.');
    }
    return this.#withTransaction(async (state, save) => {
      if (!state.credentials) return 'missing';
      if (state.credentials.accessToken !== rejectedAccessToken) return 'superseded';
      const next = emptyState(this.binding, state.generation + 1);
      save(next);
      return 'invalidated';
    });
  }

  async saveAuthorization(credentials, expectedGeneration) {
    return this.#withTransaction(async (state, save) => {
      if (state.generation !== expectedGeneration) throw new LocalMcpError('authorization_cancelled', 'The authorization request was cancelled before it completed.');
      const next = {version: 1, binding: this.binding, generation: state.generation, credentials};
      save(next);
      return next;
    });
  }

  async updateCredentials(update) {
    return this.#withTransaction(async (state, save) => {
      if (!state.credentials) throw new LocalMcpError('connect_required', 'Call connect_action_service and open the returned authorization URL.');
      const changed = await update(structuredClone(state));
      if (changed === null) {
        const next = emptyState(this.binding, state.generation + 1);
        save(next);
        return next;
      }
      const next = {version: 1, binding: this.binding, generation: state.generation, credentials: changed};
      save(next);
      return next;
    });
  }
}
