import { DEBUG } from "../config/constants";

// Maximum length for data in logs to prevent excessive log sizes
const MAX_LOG_DATA_LENGTH = 1000;

// Global debug flag that can be set by the application
let isDebugMode = false;

// Function to set debug mode
export function setDebugMode(debug: boolean): void {
	isDebugMode = debug;
}

interface JsonRpcMessage {
	jsonrpc: "2.0";
	method: string;
	params?: Record<string, unknown>;
	id?: string | number | null;
}

interface JsonRpcNotification extends JsonRpcMessage {
	method: "notification/log";
	params: {
		level: "debug" | "info" | "warn" | "error";
		message: string;
		data?: unknown;
	};
}

/**
 * Safely truncate log data if it's a string or contains string properties
 * to prevent excessive log sizes
 */
function truncateLogData(data: unknown): unknown {
	if (data === null || data === undefined) {
		return data;
	}

	if (typeof data === 'string') {
		if (data.length > MAX_LOG_DATA_LENGTH) {
			return `${data.substring(0, MAX_LOG_DATA_LENGTH)}... [truncated, ${data.length} chars total]`;
		}
		return data;
	}

	if (typeof data === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(data)) {
			if (typeof value === 'string' && value.length > MAX_LOG_DATA_LENGTH) {
				result[key] = `${value.substring(0, MAX_LOG_DATA_LENGTH)}... [truncated, ${value.length} chars total]`;
			} else if (typeof value === 'object' && value !== null) {
				result[key] = truncateLogData(value);
			} else {
				result[key] = value;
			}
		}
		return result;
	}

	return data;
}

/**
 * Send a log message following JSON-RPC 2.0 notification format
 */
export function log(message: string, level: "debug" | "info" | "warn" | "error" = "info", data?: unknown): void {
	// Skip logging if in debug mode
	if (isDebugMode) return;
	
	// Skip debug logs if DEBUG constant is false
	if (!DEBUG && level === "debug") return;

	const notification: JsonRpcNotification = {
		jsonrpc: "2.0",
		method: "notification/log",
		params: {
			level,
			message,
			data: data ? truncateLogData(data) : undefined,
		},
	};

	// Send to stderr to avoid interfering with stdout JSON-RPC communication
	console.error(JSON.stringify(notification));
}

/**
 * Debug level logging
 */
export function debug(message: string, data?: unknown): void {
	log(message, "debug", data);
}

/**
 * Info level logging
 */
export function info(message: string, data?: unknown): void {
	log(message, "info", data);
}

/**
 * Warning level logging
 */
export function warn(message: string, data?: unknown): void {
	log(message, "warn", data);
}

/**
 * Error level logging
 */
export function error(message: string, data?: unknown): void {
	log(message, "error", data);
}
