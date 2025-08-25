import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, IsDateString } from 'class-validator';

@ApiTags('Slack')
export class FetchStandupsDTO {
	@IsString()
	@ApiProperty({
		description: 'The name of the Slack channel to fetch messages from',
		example: 'general',
		required: true,
	})
	channelName: string;

	@IsDateString()
	@ApiProperty({
		description: 'The start date from which to fetch messages (ISO format)',
		example: '2025-08-18T01:30:04.549Z',
		required: true,
	})
	startDate: string;

	@IsDateString()
	@ApiProperty({
		description: 'The end date until which to fetch messages (ISO format)',
		example: '2025-08-21T17:30:04.549Z',
		required: true,
	})
	endDate: string;
}
