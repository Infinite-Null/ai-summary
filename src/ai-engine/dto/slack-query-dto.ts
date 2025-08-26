import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class SlackQueryDTO {
	@IsOptional()
	@ApiProperty({
		description: 'The name of the Slack channel to fetch messages from.',
		default: 'proj-ai-internal',
		example: 'proj-ai-internal',
	})
	channelName: string;
}
