import { DEBUG } from "../config/constants";

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
 * Send a log message following JSON-RPC 2.0 notification format
 */
export function log(message: string, level: "debug" | "info" | "warn" | "error" = "info", data?: unknown): void {
	if (!DEBUG && level === "debug") return;

	const notification: JsonRpcNotification = {
		jsonrpc: "2.0",
		method: "notification/log",
		params: {
			level,
			message,
			data: data || undefined,
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
