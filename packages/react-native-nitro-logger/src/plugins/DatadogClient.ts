/** Structural subset of DdLogs; initialize the Datadog SDK in your application. */
export interface DatadogClient {
  debug(message: string, context?: object): Promise<void>;
  info(message: string, context?: object): Promise<void>;
  warn(message: string, context?: object): Promise<void>;
  error(message: string, context?: object): Promise<void>;
}
