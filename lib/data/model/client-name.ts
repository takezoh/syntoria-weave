export const MAX_CLIENT_NAME_LENGTH = 100;

/**
 * A client's reported display name: trimmed visible text of at most 100 UTF-16 code units without
 * control characters, matching the authorization server's registration rule. The name is unverified
 * and never identifies or authorizes anything.
 */
export function validClientName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_CLIENT_NAME_LENGTH
    && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
}
