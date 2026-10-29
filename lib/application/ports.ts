import type { ChangeWindow, OperationResult, UserCommitRequest, Receipt, Snapshot } from '../data/types';

/** Receipt and user state acquired together; snapshot decoding stays lazy for conflict precedence. */
export type ReadOperationState = Readonly<{
  receipt: Receipt | null;
  snapshot: () => Snapshot;
}>;

/** User-bound capability handed to the application. Identity is fixed by its trusted composition. */
export interface UserActionStore {
  /** Reads a consistent snapshot for the bound user; unknown users have revision zero. */
  readSnapshot(): Promise<Snapshot>;
  /** Reads an operation receipt and captures the current user snapshot in one acquisition. */
  readOperationState(operationId: string): Promise<ReadOperationState>;
  /** Reads the retained user operation window, head and oldest revision atomically. */
  readChangeWindow(afterRevision: number, throughRevision: number | null): Promise<ChangeWindow>;
  readReceipt(operationId: string): Promise<Receipt | null>;
  hasUndo(undoOf: string): Promise<boolean>;
  commit(command: UserCommitRequest): Promise<OperationResult>;
}

export type UserActionPorts = Readonly<{
  store: UserActionStore;
  clock: () => string;
  newId: () => string;
  /** Domain-separated scope fingerprint from the currently verified identity. */
  changeCursorScope: () => Promise<string>;
}>;
