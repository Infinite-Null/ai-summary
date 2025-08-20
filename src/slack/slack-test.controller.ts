import { Controller, Post, Body } from '@nestjs/common';
import { SlackService } from './slack.service';
import type { FetchMessagesParams } from './types';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Slack')
@Controller('slack')
export class SlackTestController {
	constructor(private readonly slackService: SlackService) {}

	@Post('messages')
	@ApiOperation({
		summary: 'Fetch messages from Slack',
		description:
			'This endpoint retrieves messages from a specific Slack channel.',
	})
	async getMessages(@Body() params: FetchMessagesParams) {
		return this.slackService.getStandups(params);
	}
}
