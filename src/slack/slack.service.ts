import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConversationsHistoryResponse, WebClient } from '@slack/web-api';
import {
	FetchStandupParams,
	FormattedStandup,
	ParsedStandup,
	SlackMessage,
	SlackUser,
	StandupEntry,
} from './types';
import { Channel } from '@slack/web-api/dist/types/response/ConversationsListResponse';

/**
 * Service for interacting with Slack API, fetching standup messages, formatting them, and extracting user and thread information.
 * Handles channel lookup, message retrieval, reply threading, and parsing standup formats for downstream summarization and reporting.
 */
@Injectable()
export class SlackService {
	/**
	 * Logger instance for the Slack service.
	 */
	private readonly logger = new Logger(SlackService.name, {
		timestamp: true,
	});

	/**
	 * Slack WebClient instance for API calls.
	 */
	private readonly client: WebClient;

	/**
	 * Initializes the SlackService with a WebClient using the bot token from environment variables.
	 * @throws Error if SLACK_BOT_TOKEN is not set.
	 */
	constructor() {
		const token = process.env.SLACK_BOT_TOKEN;
		if (!token) {
			throw new Error(
				'SLACK_BOT_TOKEN is not set in environment variables',
			);
		}
		this.client = new WebClient(token);
	}

	/**
	 * Converts a channel name to its ID by querying the Slack API.
	 *
	 * @param channelName - The name of the channel (without the # prefix).
	 * @returns The channel ID string.
	 * @throws NotFoundException if channel is not found, or Error if API call fails.
	 */
	async getChannelId(channelName: string): Promise<string> {
		try {
			// Remove # prefix if present
			const cleanChannelName = channelName.replace(/^#/, '');

			// Get list of all channels
			const result = await this.client.conversations.list();

			if (!result.channels) {
				throw new Error('No channels returned from Slack API');
			}

			// Find the channel by name
			const channel = result.channels.find(
				(channel: Channel) => channel.name === cleanChannelName,
			);

			if (!channel || !channel.id) {
				throw new NotFoundException(
					`Channel #${cleanChannelName} not found`,
				);
			}

			return channel.id;
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: 'An unknown error occurred';
			this.logger.error(`Failed to get channel ID: ${errorMessage}`);
			throw error;
		}
	}

	/**
	 * Fetches all messages from a Slack channel within an optional date range.
	 *
	 * @param channelId - The Slack channel ID.
	 * @param startDate - Optional start date (ISO string).
	 * @param endDate - Optional end date (ISO string).
	 * @returns Array of SlackMessage objects.
	 * @throws Error if Slack API call fails.
	 */
	async getMessages(
		channelId: string,
		startDate?: string,
		endDate?: string,
	): Promise<SlackMessage[]> {
		try {
			const toUnix = (date?: string) =>
				date ? String(new Date(date).getTime() / 1000) : undefined;

			let allMessages: ConversationsHistoryResponse['messages'] = [];
			let cursor: string | undefined;

			do {
				const result: ConversationsHistoryResponse =
					await this.client.conversations.history({
						channel: channelId,
						cursor,
						oldest: toUnix(startDate),
						latest: toUnix(endDate),
						limit: 999,
					});

				if (!result.ok) {
					throw new Error(`Slack API error: ${result.error}`);
				}

				if (result.messages) {
					allMessages = [...allMessages, ...result.messages];
				}

				cursor = result.response_metadata?.next_cursor;
			} while (cursor);

			const slackMessages: SlackMessage[] = allMessages.map((msg) => ({
				username: msg.username,
				subtype: msg.subtype,
				ts: msg.ts,
				text: msg.text,
			}));

			return slackMessages;
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: 'An unknown error occurred';
			this.logger.error(`Failed to fetch messages: ${errorMessage}`);
			throw error;
		}
	}

	/**
	 * Filters Slack messages to extract only standup bot messages.
	 *
	 * @param messages - Array of SlackMessage objects.
	 * @returns Array of SlackMessage objects that are standup bot messages.
	 */
	extractStandupMessages(messages: SlackMessage[]): SlackMessage[] {
		return messages.filter((msg) => {
			return (
				msg.subtype === 'bot_message' &&
				msg.username?.includes('Daily Standup')
			);
		});
	}

	/**
	 * Retrieves Slack user information (username and real name) for a given user ID.
	 *
	 * @param userId - Slack user ID string.
	 * @returns SlackUser object or null if not found.
	 */
	async getUserInfo(userId: string): Promise<SlackUser | null> {
		try {
			const result = await this.client.users.info({ user: userId });
			if (!result.ok) {
				throw new Error(`Slack API error: ${result.error}`);
			}

			const { name: username, real_name: name } = result.user || {};
			if (!username || !name) {
				return null;
			}

			return {
				username,
				name,
			};
		} catch (error) {
			this.logger.error(
				`Failed to fetch user info: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
			return null;
		}
	}

	/**
	 * Retrieves replies to a specific message in a thread.
	 *
	 * @param channelId - The ID of the channel containing the thread.
	 * @param threadTs - The timestamp of the parent message.
	 * @param options - Optional parameters for pagination and filtering.
	 * @returns Array of reply SlackMessage objects in the thread.
	 * @throws Error if Slack API call fails.
	 */
	async getMessageReplies(
		channelId: string,
		threadTs: string,
		options: {
			limit?: number;
			oldest?: string;
			latest?: string;
			inclusive?: boolean;
		} = {},
	): Promise<SlackMessage[]> {
		try {
			let allReplies: SlackMessage[] = [];
			let cursor: string | undefined;

			do {
				const result = await this.client.conversations.replies({
					channel: channelId,
					ts: threadTs,
					cursor,
					limit: options.limit || 100,
					oldest: options.oldest,
					latest: options.latest,
					inclusive: options.inclusive,
				});

				if (!result.ok) {
					throw new Error(`Slack API error: ${result.error}`);
				}

				if (result.messages) {
					const replies = await Promise.all(
						result.messages.slice(1).map(async (msg) => {
							let name = '';
							if (msg.user) {
								const userInfo = await this.getUserInfo(
									msg.user,
								);
								name = userInfo?.name || '';
							}

							return {
								user: msg.user,
								ts: msg.ts,
								text: msg.text,
								name,
							};
						}),
					);

					allReplies = [...allReplies, ...replies];
				}

				cursor = result.response_metadata?.next_cursor;

				if (cursor) {
					await new Promise((resolve) => setTimeout(resolve, 200));
				}
			} while (cursor);

			return allReplies;
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: 'An unknown error occurred';
			this.logger.error(
				`Failed to fetch message replies: ${errorMessage}`,
			);
			throw error;
		}
	}

	/**
	 * Formats standup messages and their replies into a structured FormattedStandup object.
	 *
	 * @param standupMessagesWithReplies - Array of SlackMessage objects with attached replies.
	 * @returns FormattedStandup object mapping timestamps to valid standup entries.
	 */
	private formatStandup(
		standupMessagesWithReplies: Array<
			SlackMessage & { replies?: SlackMessage[] }
		>,
	): FormattedStandup {
		const formatted: FormattedStandup = {};

		for (const message of standupMessagesWithReplies) {
			if (!message.ts || !message.replies?.length) {
				continue;
			}

			const timestamp = new Date(Number(message.ts) * 1000).toISOString();
			const validEntries: StandupEntry[] = [];

			for (const reply of message.replies) {
				if (!reply.text || !reply.name || !reply.user) {
					continue;
				}

				const standup = this.parseStandup(reply.text);

				if (
					standup.yesterday.length &&
					standup.today.length &&
					standup.blocker.length
				) {
					validEntries.push({
						name: reply.name,
						user: reply.user,
						standup,
					});
				}
			}

			if (validEntries.length > 0) {
				formatted[timestamp] = validEntries;
			}
		}

		return formatted;
	}

	/**
	 * Parses a standup message string into its component sections: yesterday, today, blockers.
	 *
	 * @param standup - Raw standup message string.
	 * @returns ParsedStandup object with arrays for each section and the raw text.
	 */
	parseStandup(standup: string): ParsedStandup {
		try {
			// Split the text by the known question strings
			const yesterdayMatch = standup.match(
				/What did you accomplish on the previous working day\?\*?\n(.*?)(?=What are you working on today\?\*?)/s,
			);
			const todayMatch = standup.match(
				/What are you working on today\?\*?\n(.*?)(?=Mention any blockers)/s,
			);
			const blockersMatch = standup.match(
				/Mention any blockers.*\n(.*?)$/s,
			);

			// Extract and clean up the content
			return {
				yesterday:
					yesterdayMatch?.[1]
						?.split('\n')
						.map((s) => s.trim())
						.filter(Boolean) || [],
				today:
					todayMatch?.[1]
						?.split('\n')
						.map((s) => s.trim())
						.filter(Boolean) || [],
				blocker:
					blockersMatch?.[1]
						?.split('\n')
						.map((s) => s.trim())
						.filter(Boolean) || [],
				text: standup.trim(),
			};
		} catch (error) {
			this.logger.warn('Failed to parse standup text:', error);
			return {
				yesterday: [],
				today: [],
				blocker: [],
				text: '',
			};
		}
	}

	/**
	 * Retrieves and formats standup entries from a Slack channel within a date range.
	 *
	 * @param params - FetchStandupParams object containing channelName, startDate, endDate.
	 * @returns FormattedStandup object mapping timestamps to valid standup entries.
	 */
	async getStandups(params: FetchStandupParams): Promise<FormattedStandup> {
		const channelId = await this.getChannelId(params.channelName);

		const messages = await this.getMessages(
			channelId,
			params.startDate,
			params.endDate,
		);

		const standupMessages = this.extractStandupMessages(messages);

		const standupMessagesWithReplies: Array<SlackMessage> = [];

		for (const message of standupMessages) {
			if (message.ts) {
				const replies = await this.getMessageReplies(
					channelId,
					message.ts,
				);
				standupMessagesWithReplies.push({
					...message,
					replies,
				});
			}
		}

		return this.formatStandup(standupMessagesWithReplies);
	}
}
