import { DEBUG } from '../config/constants';

let logId = 0;

export function log(message: string, ...args: any[]): void {
  if (DEBUG) {
    logId++;
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      id: `log_${logId}`,
      method: "log",
      params: {
        message,
        args: args.length > 0 ? args : undefined
      }
    }));
  }
} 