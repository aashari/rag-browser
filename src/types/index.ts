export interface Link {
	title: string;
	url: string;
	selector: string;
}

export interface Button {
	text: string;
	selector: string;
}

export interface Input {
	label: string;
	type: string;
	selector: string;
	isVisible: boolean;
	id?: string;
	role?: string;
	name?: string;
	value?: string;
	placeholder?: string;
	needsSpecialHandling?: boolean;
}

export interface WaitAction {
	type: "wait";
	elements: string[];
}

export interface ClickAction {
	type: "click";
	element: string;
}

export interface TypingAction {
	type: "typing";
	element: string;
	value: string;
	delay?: number;
}

export interface KeyPressAction {
	type: "keyPress";
	key: string;
	element?: string;
}

export interface SubmitAction {
	type: "submit";
	element: string;
}

export interface PrintAction {
	type: "print";
	elements: string[];
}

export interface MarkdownAction {
	type: "markdown";
	elements: string[];
}

export type Action = WaitAction | ClickAction | TypingAction | KeyPressAction | SubmitAction | PrintAction | MarkdownAction;

export interface Plan {
	actions: Action[];
}

export type PlannedActionResult = {
	selector: string;
	error?: string;
} & (
	| {
			type: 'print';
			html: string;
	}
	| {
			type: 'markdown';
			html: string;
	}
);

export interface PageAnalysis {
	title: string;
	description: string;
	links: Link[];
	buttons: Button[];
	inputs: Input[];
	plannedActions?: PlannedActionResult[];
	cacheKey?: string;
	timestamp?: number;
	expiresAt?: number;
}

export type SelectorMode = "full" | "simple";

export interface BrowserOptions {
	headless: boolean;
	slowMo?: number;
	timeout?: number;
	selectorMode?: SelectorMode;
	plan?: Plan;
}

export interface ActionResult {
	success: boolean;
	message: string;
	warning?: string;
	error?: string;
	data?: PlannedActionResult[];
}

export interface ActionStatus {
	step: number;
	totalSteps: number;
	action: Action;
	symbol: string;
	description: string;
	result?: ActionResult;
}
