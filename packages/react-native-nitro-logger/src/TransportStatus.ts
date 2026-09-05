export interface TransportStatus {
  readonly name: string;
  readonly state: "active" | "disabled" | "closed";
  readonly pending: number;
  readonly delivered: number;
  readonly dropped: number;
  readonly failed: number;
  readonly failures: number;
}
