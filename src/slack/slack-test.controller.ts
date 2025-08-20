import { Controller, Post, Body } from '@nestjs/common';
import { SlackService } from './slack.service';
import type { FetchMessagesParams } from './types';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Slack - Testing')
@Controller('slack-test')
export class SlackTestController {
	constructor(private readonly slackService: SlackService) {}

	@Post('messages')
	@ApiOperation({
		summary: 'Test endpoint - Fetch messages from Slack',
		description:
			'This is a temporary endpoint for testing the Slack integration',
	})
	async getMessages(@Body() params: FetchMessagesParams) {
		return this.slackService.getStandups(params);
	}
}
