/** Input values are snapshotted; accessors are never invoked. */
export type Attributes = Readonly<Record<string, unknown>>;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type LogAttributes = Readonly<Record<string, JsonValue>>;
