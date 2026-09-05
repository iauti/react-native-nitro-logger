export interface SystemLogOptions {
  /** OSLog category; also used as the Logcat tag. Maximum 128 characters. */
  category: string;
  /** OSLog subsystem; defaults to the app bundle ID on iOS. */
  subsystem?: string;
  /** OSLog-only preference. Default false: complete payload is private. */
  enablePublicLogging?: boolean;
}
