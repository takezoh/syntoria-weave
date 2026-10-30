/** Shared data contracts. Keep this module free of runtime values and capabilities. */
export type DeepReadonly<T> = T extends readonly (infer Item)[] ? readonly DeepReadonly<Item>[] : T extends object ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> } : T;

export type ActionStatus = 'active' | 'on-hold' | 'completed' | 'dropped';

export type Action = Readonly<{
  id: string;
  title: string;
  revision: number;
  parent_id: string | null;
  project_id: string | null;
  status: ActionStatus;
  due_at: string | null;
  defer_until: string | null;
  notes: string;
  metadata: string;
  order: number;
  flagged: boolean;
  created_at: string;
  updated_at: string;
}>;

export type Project = Readonly<{
  id: string;
  order: number;
  name: string;
  description: string;
  parent_id: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}>;

export type Tag = Readonly<{
  id: string;
  order: number;
  name: string;
  description: string;
  parent_id: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}>;

export type ActionTag = Readonly<{ action_id: string; tag_id: string; revision: number }>;
export type CatalogIdentityLedger = Readonly<{
  kind: 'project' | 'tag' | 'action_tag' | 'perspective';
  identity: string;
  revision: number;
}>;

export type PerspectiveFilter = Readonly<{
  statuses?: readonly ActionStatus[];
  is_deferred?: boolean;
  flagged?: boolean;
  project_id?: string | null;
  tag_id?: string;
  include_descendants?: boolean;
}>;

export type PerspectiveQueryField = 'project_id' | 'tag_id' | 'status' | 'flagged' | 'is_deferred';
export type PerspectiveQueryOperator = 'eq' | 'ne' | 'in' | 'not_in';
export type PerspectiveQueryCondition =
  | Readonly<{ and: readonly PerspectiveQueryCondition[] }>
  | Readonly<{ or: readonly PerspectiveQueryCondition[] }>
  | Readonly<{ not: PerspectiveQueryCondition }>
  | Readonly<{ field: 'project_id' | 'tag_id'; op: 'eq' | 'ne'; value: string | null; include_descendants?: boolean }>
  | Readonly<{ field: 'project_id' | 'tag_id'; op: 'in' | 'not_in'; values: readonly (string | null)[]; include_descendants?: boolean }>
  | Readonly<{ field: 'status'; op: 'eq' | 'ne'; value: ActionStatus }>
  | Readonly<{ field: 'status'; op: 'in' | 'not_in'; values: readonly ActionStatus[] }>
  | Readonly<{ field: 'flagged' | 'is_deferred'; op: 'eq' | 'ne'; value: boolean }>;
export type PerspectiveQuery = Readonly<{
  where?: PerspectiveQueryCondition;
  order_by?: readonly SortKey[];
}>;
export type SortKey = Readonly<{
  field: 'due_at' | 'defer_until' | 'created_at' | 'updated_at' | 'title' | 'status' | 'flagged' | 'order';
  direction: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}>;

export type PerspectiveMetadata = Readonly<{
  id: string;
  name: string;
  description: string;
  revision: number;
  created_at: string;
  updated_at: string;
}>;

export type FilterPerspective = PerspectiveMetadata & Readonly<{
  filter: PerspectiveFilter;
  definition_version: 1;
}>;
export type QueryPerspective = PerspectiveMetadata & Readonly<{
  query: PerspectiveQuery;
  definition_version: 2;
}>;
export type Perspective = FilterPerspective | QueryPerspective;

export type Snapshot = Readonly<{
  revision: number;
  catalog_identity_ledger: readonly CatalogIdentityLedger[];
  actions: readonly Action[];
  projects: readonly Project[];
  tags: readonly Tag[];
  action_tags: readonly ActionTag[];
  perspectives: readonly Perspective[];
  /** Present only when the store supports the collaboration contract. */
  collaborations?: readonly Collaboration[];
  /** Present only when the store records provenance. Display data outside the persisted Action DTO, deltas and Undo. */
  action_provenance?: readonly ActionProvenance[];
  /** Present only when the store records client names. Unverified names reported by connected clients. */
  client_names?: readonly ClientName[];
}>;

/** Who committed an operation: the person in the dedicated app (`user`) or a client connection acting for them (`client`). */
export type ActorKind = 'user' | 'client';
/** Provenance only: it never grants, selects or restricts anything. */
export type ActorRef = Readonly<{ kind: ActorKind; client_id: string | null }>;
/** The latest known creator and changer of an Action; null when it was saved before provenance was recorded. */
export type ActionProvenance = Readonly<{ action_id: string; created_by: ActorRef | null; updated_by: ActorRef | null }>;
/** The display name a client reported at registration, as relayed by the authorization server. Unverified. */
export type ClientName = Readonly<{ client_id: string; name: string }>;

/** Business decisions and reports; these records never grant external permissions. */
export type CollaborationActor = Readonly<{kind:'user'|'client';client_id:string;connection_id:string}>;
export type CollaborationProposal = Readonly<{title:string;instructions:string;scope:string;outcome:string;exclusions:string;source:string}>;
/** Who should handle the work once it is approved or requested: any AI, or one client. State only; it never restricts writes. */
export type CollaborationDelegation = Readonly<{mode:'any_ai';client_id:null}|{mode:'specified_ai';client_id:string}>;
export type Collaboration = Readonly<{
 id:string;action_id:string|null;revision:number;version:number;proposal:CollaborationProposal;
 /** Caller-managed operational text; returned by API/MCP reads, never shown in the UI. */
 metadata:string;delegation:CollaborationDelegation;
 decision:'pending'|'accepted'|'changes_requested'|'rejected'|'deferred'|'withdrawn';
 progress:'not_started'|'running'|'waiting'|'reported'|'stopped';
 next_actor:'user'|'ai'|'external'|'none';
 feedback:string;summary:string;remaining:string;outcome:'none'|'success'|'partial'|'failed'|'unknown';
 artifacts:readonly Readonly<{label:string;url:string}>[];
 run_id:string|null;run_actor:CollaborationActor|null;stop_requested:boolean;
 action_revision:number|null;created_at:string;updated_at:string;last_reported_at:string|null;
}>;
export type CollaborationHistory = Readonly<{operation_id:string;revision:number;command:string;actor:CollaborationActor;record:Collaboration}>;

export type Change = Readonly<{ kind: string; payload: Readonly<Record<string, unknown>> }>;
export type Receipt = Readonly<{
  canonical_payload: string;
  result: string;
  delta: string;
  revision_after: number;
  undo_of: string | null;
}>;
/** User-bound retained operation rows used to build an incremental read page. */
export type RetainedOperation = Readonly<{
  operation_id: string;
  revision_before: number;
  revision_after: number;
  committed_at: string;
  undo_of: string | null;
  /** OAuth client that committed the operation; null when the store does not record it. */
  client_id: string | null;
  /** The person in the dedicated app (`user`) or a client connection acting for them (`client`); null when unknown. */
  actor_kind: 'user' | 'client' | null;
  /** The caller's own description of the write; null when none was supplied or the store does not record it. */
  summary: string | null;
  /** The committing client's current reported name; null when unknown. Unverified display data. */
  client_name: string | null;
  delta: string;
}>;
export type ChangeWindow = Readonly<{
  head_revision: number;
  oldest_revision: number | null;
  operations: readonly RetainedOperation[];
}>;
/** Retained operations ending at a revision, newest first, with the receipt result and the operation that undid each one. */
export type RecentOperation = RetainedOperation & Readonly<{ result: string; undone_by: string | null }>;
export type RecentChangeWindow = Readonly<{
  head_revision: number;
  oldest_revision: number | null;
  /** The newest revision included in this window. */
  through_revision: number;
  operations: readonly RecentOperation[];
}>;
export type OperationResolution = Readonly<{
  perspective?: Readonly<{ id: string }>;
  actions?: readonly Readonly<{ ref?: string; id: string }>[];
  project?: Readonly<{ id: string; created: boolean }>;
  tag?: Readonly<{ id: string; created: boolean }>;
}>;
export type OperationResult = Readonly<{
  operationId: string;
  revision: number;
  changedIds: readonly string[];
  resolved?: OperationResolution;
  collaboration_id?:string;
}>;
/** User identity is intentionally absent; trusted composition binds it outside the request. */
export type UserCommitRequest = Readonly<{
  operationId: string;
  payload: string;
  before: Snapshot;
  after: Snapshot;
  now: string;
  undoOf: string | null;
  resolved?: OperationResolution;
  collaboration?:Readonly<{command:string;actor:CollaborationActor;record:Collaboration}>;
  /** The caller's own description of the write, already part of the canonical payload. */
  summary?: string | null;
}>;

/** One retained operation as the change feed publishes it: provenance plus persisted before/after DTOs. */
export type EntityDelta<T> = Readonly<{ before: T | null; after: T | null }>;
export type ChangeOperation = Readonly<{
  operation_id: string;
  revision_before: number;
  revision_after: number;
  committed_at: string;
  undo_of: string | null;
  /** Provenance only: which OAuth client committed the operation. It never grants access. */
  client_id: string | null;
  /** Provenance only: the person in the dedicated app (`user`) or a client connection acting for them (`client`). */
  actor_kind: 'user' | 'client' | null;
  /** The caller's own description of the write. A claim to display beside `changes`, never interpreted. */
  summary: string | null;
  /** The committing client's current reported name. Unverified display data. */
  client_name: string | null;
  changes: Readonly<{
    actions: readonly EntityDelta<Action>[];
    projects: readonly EntityDelta<Project>[];
    tags: readonly EntityDelta<Tag>[];
    perspectives: readonly EntityDelta<Perspective>[];
    action_tags: readonly EntityDelta<ActionTag>[];
  }>;
}>;


/** A retained operation read newest first, with the operation that undid it and its collaboration record, if any. */
export type RecentChange = ChangeOperation & Readonly<{ undone_by: string | null; collaboration_id: string | null }>;
export type RecentChangePage = Readonly<{
  schemaVersion: 2;
  head_revision: number;
  oldest_revision: number | null;
  changes: readonly RecentChange[];
  /** Pass as before_revision to read older operations; null when no older retained operation exists. */
  next_before_revision: number | null;
}>;

/** Whether Undo of a retained operation would currently be accepted; advisory, evaluated at read time. */
export type UndoAvailability = 'available' | 'conflict' | 'undone' | 'not_undoable';
/** A recent change as `list_recent_changes` returns it. */
export type RecentChangeItem = RecentChange & Readonly<{ undo: Readonly<{ status: UndoAvailability }> }>;
