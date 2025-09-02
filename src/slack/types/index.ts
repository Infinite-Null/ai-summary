export interface FetchStandupParams {
	channelName: string;
	startDate: string;
	endDate: string;
}

export interface SlackMessage {
	username?: string;
	subtype?: string;
	ts?: string;
	text?: string;
	user?: string;
	name?: string;
	replies?: SlackMessage[];
}

export interface SlackUser {
	username: string;
	name: string;
}

export interface ParsedStandup {
	yesterday: string[];
	today: string[];
	blocker: string[];
	demo: string[];
	text: string;
}

export interface StandupEntry {
	name: string;
	standup: ParsedStandup;
	user: string;
}

export interface FormattedStandup {
	[timestamp: string]: StandupEntry[];
}
