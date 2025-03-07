export type Link = {
	title: string;
	url: string;
	selector: string;
};

export type Button = {
	text: string;
	selector: string;
};

export interface Input {
	type: string;
	id?: string;
	name?: string;
	value?: string;
	placeholder?: string;
	label?: string;
	selector: string;
	attributes?: string[];
	isVisible?: boolean;
}

export type WaitAction = {
	type: "wait";
	elements: string[];
	timeout?: number;
	completed?: boolean;
};

export type ClickAction = {
	type: "click";
	element: string;
	completed?: boolean;
};

export type TypingAction = {
	type: "typing";
	element: string;
	value: string;
	delay?: number;
	completed?: boolean;
};

export type KeyPressAction = {
	type: "keyPress";
	key: string;
	element?: string;
	completed?: boolean;
};

export type PrintAction = {
	type: "print";
	elements: string[];
	format?: "html" | "markdown";
	completed?: boolean;
};

export type Action = WaitAction | ClickAction | TypingAction | KeyPressAction | PrintAction;

export type Plan = {
	actions: Action[];
};

export interface PlannedActionResult {
	selector: string;
	html: string;
	type: 'print';
	format?: 'html' | 'markdown';
	error?: string;
	metadata?: {
		tagName: string;
		className: string;
		id: string;
		attributes: string;
	};
}

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
	error?: string;
};

export type SelectorMode = "full" | "simple";

export interface BrowserOptions {
	headless: boolean;
	slowMo?: number;
	timeout?: number;
	selectorMode?: SelectorMode;
	plan?: Plan;
	debug?: boolean;
	userDataDir?: string;
	storageState?: {
		cookies?: {
			name: string;
			value: string;
			domain: string;
			path: string;
		}[];
		origins?: {
			origin: string;
			localStorage?: Record<string, string>;
			sessionStorage?: Record<string, string>;
		}[];
	};
	abortSignal?: AbortSignal;
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

export interface StoredAnalysis {
	analysis: PageAnalysis;
	timestamp: Date;
	url: string;
}

export interface StorageState {
	cookies?: Array<{
		name: string;
		value: string;
		domain: string;
		path: string;
	}>;
	origins?: Array<{
		origin: string;
		localStorage?: Record<string, string>;
		sessionStorage?: Record<string, string>;
	}>;
}
