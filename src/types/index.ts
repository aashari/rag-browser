export type Link = {
	title: string;
	url: string;
	selector: string;
};

export type Button = {
	text: string;
	selector: string;
};

export type Input = {
	type: string;
	label?: string;
	id?: string;
	selector: string;
	isVisible: boolean;
};

export type WaitAction = {
	type: "wait";
	elements: string[];
};

export type ClickAction = {
	type: "click";
	element: string;
};

export type TypingAction = {
	type: "typing";
	element: string;
	value: string;
	delay?: number;
};

export type KeyPressAction = {
	type: "keyPress";
	key: string;
	element?: string;
};

export type PrintAction = {
	type: "print";
	elements: string[];
};

export type MarkdownAction = {
	type: "markdown";
	elements: string[];
};

export type Action = WaitAction | ClickAction | TypingAction | KeyPressAction | PrintAction | MarkdownAction;

export type Plan = {
	actions: Action[];
};

export type PlannedActionResult = {
	type?: "print" | "markdown";
	selector: string;
	error?: string;
	html?: string;
};

export type PageAnalysis = {
	title: string;
	description?: string;
	inputs: Input[];
	buttons: Button[];
	links: Link[];
	plannedActions?: PlannedActionResult[];
	cacheKey?: string;
	timestamp?: number;
	expiresAt?: number;
};

export type SelectorMode = "full" | "simple";

export interface BrowserOptions {
	headless: boolean;
	slowMo?: number;
	timeout?: number;
	selectorMode?: SelectorMode;
	plan?: Plan;
}

export type ActionResult = {
	success: boolean;
	message: string;
	warning?: string;
	error?: string;
	data?: PlannedActionResult[];
};

export interface ActionStatus {
	step: number;
	totalSteps: number;
	action: Action;
	symbol: string;
	description: string;
	result?: ActionResult;
}

export interface StoredAnalysis {
	analysis: PageAnalysis;
	timestamp: Date;
	url: string;
}
