export class LocalMcpError extends Error {
  constructor(code, message, {kind = 'tool', cause, rpcError} = {}) {
    super(message, cause ? {cause} : undefined);
    this.name = 'LocalMcpError';
    this.code = code;
    this.kind = kind;
    this.rpcError = rpcError;
  }
}

export function safeErrorMessage(error, fallback = 'The local action service request failed.') {
  if (error instanceof LocalMcpError) return error.message;
  return fallback;
}
