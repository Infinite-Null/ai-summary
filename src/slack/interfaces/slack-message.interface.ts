export interface FetchMessagesParams {
	channelName: string;
	startDate: string;
	endDate: string;
}

export interface SlackReply {
	text: string;
	timestamp: string;
	user: string;
}

export interface SlackMessage {
	username?: string;
	subtype?: string;
	ts?: string;
	text?: string;
}

export interface SlackMessageResponse {
	messages: SlackMessage[];
}

export interface SlackUser {
	username: string;
	name: string;
	title?: string;
}

export interface StandupEntry {
	name: string;
	standup: string;
	user: string;
}

export interface FormattedStandup {
	[timestamp: string]: StandupEntry[];
}
