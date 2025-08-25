import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { SlackService } from './slack.service';
import { FetchStandupsDTO } from './dto/fetch-standups.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FetchStandupsResponseDto } from './dto/fetch-standups-response.dto';

@ApiTags('Slack')
@Controller('slack')
export class SlackController {
	constructor(private readonly slackService: SlackService) {}

	@Get('get-standups')
	@ApiOperation({
		summary: 'Fetch standups from Slack',
		description:
			'This endpoint retrieves standups from a specific Slack channel.',
	})
	@ApiResponse({
		status: 200,
		description: 'Returns the standups from the specified Slack channel',
		type: FetchStandupsResponseDto,
	})
	async getMessages(@Query(new ValidationPipe()) params: FetchStandupsDTO) {
		return this.slackService.getStandups(params);
	}
}
