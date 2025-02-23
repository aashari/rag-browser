import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { analyzePage } from "../core/browser";
import { printAnalysis } from "../cli/printer";
import type { Plan } from "../types";

export async function handleToolCall(
	name: string,
	args: Record<string, string>,
	server: Server
): Promise<CallToolResult> {
	switch (name) {
		case "navigate":
			await server.sendLoggingMessage({
				level: "info",
				data: `Navigate tool called with URL: ${args.url}`,
			});
			const analysisResult = await analyzePage(args.url as string, {
				headless: args.headless === "true",
				timeout: parseInt(args.timeout as string),
				selectorMode: args.selectorMode === "full" ? "full" : "simple",
			});
			return {
				content: [
					{
						type: "text",
						text: printAnalysis(analysisResult),
					},
				],
				isError: false,
			};
		case "execute":
			await server.sendLoggingMessage({
				level: "info",
				data: `Execute tool called with plan: ${JSON.stringify(args.plan)}`,
			});
			const plan = JSON.parse(args.plan as string) as Plan;
			const planResult = await analyzePage(args.url as string, {
				headless: args.headless === "true",
				timeout: parseInt(args.timeout as string),
				selectorMode: args.selectorMode === "full" ? "full" : "simple",
				plan,
			});
			return {
				content: [
					{
						type: "text",
						text: printAnalysis(planResult),
					},
				],
				isError: false,
			};
		default:
			return {
				content: [
					{
						type: "text",
						text: `Unknown tool: ${name}`,
					},
				],
				isError: true,
			};
	}
}
