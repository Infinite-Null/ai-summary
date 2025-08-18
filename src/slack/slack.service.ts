import { Injectable, Logger } from '@nestjs/common';
import { ConversationsHistoryResponse, WebClient } from '@slack/web-api';
import {
	FetchMessagesParams,
	FormattedStandup,
	SlackMessage,
	SlackUser,
	StandupEntry,
} from './interfaces/slack-message.interface';
import { Channel } from '@slack/web-api/dist/types/response/ConversationsListResponse';

// Define the Slack message type with the properties we need
type SlackApiMessage = {
	type?: string;
	user?: string;
	text?: string;
	ts?: string;
	username?: string;
	subtype?: string;
	thread_ts?: string;
};

@Injectable()
export class SlackService {
	/**
	 * Logger instance for the Slack service.
	 */
	private readonly logger = new Logger(SlackService.name, {
		timestamp: true,
	});

	private readonly client: WebClient;

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
	 * Converts a channel name to its ID by querying the Slack API
	 * @param channelName The name of the channel (without the # prefix)
	 * @returns The channel ID
	 * @throws Error if channel is not found or API call fails
	 */
	async getChannelId(channelName: string): Promise<string> {
		try {
			this.logger.debug(`Looking up channel ID for: ${channelName}`);

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
				throw new Error(`Channel #${cleanChannelName} not found`);
			}

			this.logger.debug(`Found channel ID: ${channel.id}`);

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

			this.logger.debug(`Fetching messages from channel: ${channelId}`);

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

			this.logger.debug(`Retrieved ${allMessages.length} messages`);

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

	extractStandupMessages(messages: SlackMessage[]): SlackMessage[] {
		return messages.filter((msg) => {
			return (
				msg.subtype === 'bot_message' &&
				msg.username?.includes('Daily Standup')
			);
		});
	}

	async getUserInfo(userId: string): Promise<SlackUser | null> {
		try {
			const result = await this.client.users.info({ user: userId });
			if (!result.ok) {
				throw new Error(`Slack API error: ${result.error}`);
			}

			this.logger.debug(`Fetched user info for ${userId}`);

			return {
				username: result.user?.name || '',
				name: result.user?.real_name || '',
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: 'An unknown error occurred';
			this.logger.error(`Failed to fetch user info: ${errorMessage}`);
			throw error;
		}
	}

	/**
	 * Retrieves replies to a specific message in a thread
	 * @param channelId The ID of the channel containing the thread
	 * @param threadTs The timestamp of the parent message
	 * @param options Optional parameters for pagination and filtering
	 * @returns Array of reply messages in the thread
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
			this.logger.debug(
				`Fetching replies for message ${threadTs} in channel ${channelId}`,
			);

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
					// Filter out the parent message (first message in thread)
					const replies = await Promise.all(
						result.messages
							.slice(1)
							.map(async (msg: SlackApiMessage) => {
								const userInfo = msg.user
									? await this.getUserInfo(msg.user)
									: null;
								return {
									user: msg.user,
									ts: msg.ts,
									text: msg.text,
									name: userInfo?.name || '',
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

			this.logger.debug(`Retrieved ${allReplies.length} replies`);
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

	private formatStandup(
		standupMessagesWithReplies: (SlackMessage & {
			replies: (SlackMessage & { name?: string; user?: string })[];
		})[],
	): FormattedStandup {
		const formatted: FormattedStandup = {};

		for (const message of standupMessagesWithReplies) {
			if (!message.ts || !message.replies?.length) continue;

			// Convert Unix timestamp to ISO string
			const timestamp = new Date(Number(message.ts) * 1000).toISOString();

			// Initialize array for this timestamp
			if (!formatted[timestamp]) {
				formatted[timestamp] = [];
			}

			// Process each reply in the thread
			for (const reply of message.replies) {
				if (!reply.text || !reply.name || !reply.user) continue;

				const entry: StandupEntry = {
					name: reply.name,
					user: reply.user,
					standup: reply.text,
				};

				formatted[timestamp].push(entry);
			}

			// Remove empty arrays
			if (formatted[timestamp].length === 0) {
				delete formatted[timestamp];
			}
		}

		return formatted;
	}

	async getStandup(params: FetchMessagesParams): Promise<FormattedStandup> {
		const channelId = await this.getChannelId(params.channelName);
		const messages = await this.getMessages(
			channelId,
			params.startDate,
			params.endDate,
		);

		const standupMessages = this.extractStandupMessages(messages);
		const standupMessagesWithReplies: (SlackMessage & {
			replies: (SlackMessage & { name?: string })[];
		})[] = [];

		// Loop through messages and fetch replies and append them
		for (const message of standupMessages) {
			if (message.ts) {
				const replies = await this.getMessageReplies(
					channelId,
					message.ts,
				);
				this.logger.debug(
					`Found ${replies.length} replies for message ${message.ts}`,
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
