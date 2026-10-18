import { verifiedUser, type VerifiedIdentity } from './auth';

/** Hash the live trusted user in the server composition; tokens never choose a SQL isolation key. */
export async function changeCursorScope(identity: VerifiedIdentity): Promise<string> {
  const user = verifiedUser(identity);
  const source = new TextEncoder().encode(`action-tools/change-cursor/scope/v1\0${user}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', source));
  let binary = '';
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}
