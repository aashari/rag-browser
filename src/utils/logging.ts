import { DEBUG } from '../config/constants';

export function log(message: string, ...args: any[]): void {
  if (DEBUG) {
    console.log(message, ...args);
  }
} 