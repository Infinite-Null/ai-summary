export interface ProjectSummarySchema {
	summary: string;
	riskBlockerActionNeeded: string;
	taskDetails: {
		completed: string;
		inProgress: string;
		inReview: string;
	};
}

export enum ProjectStatus {
	Green = 'Green',
	Amber = 'Amber',
	Red = 'Red',
}

export enum Algorithm {
	MapReduce = 'map-reduce',
	Stuff = 'stuff',
	Auto = 'auto',
}
export interface ProjectSummarySchema {
	summary: string;
	riskBlockerActionNeeded: string;
	taskDetails: {
		completed: string;
		inProgress: string;
		inReview: string;
	};
}

export enum ModelProvider {
	OPENAI = 'openai',
	GOOGLE = 'google',
}

export enum OpenAIModels {
	GPT_3_5_TURBO = 'gpt-3.5-turbo',
	GPT_4 = 'gpt-4',
	GPT_4o_MINI = 'gpt-4o-mini',
}

export enum GoogleModels {
	GEMINI_2_FLASH = 'gemini-2.0-flash',
}

export type SupportedModels = OpenAIModels | GoogleModels;
