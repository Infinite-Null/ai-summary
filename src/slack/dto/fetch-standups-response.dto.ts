import { ApiProperty } from '@nestjs/swagger';

export class FetchStandupsResponseDto {
	@ApiProperty({
		description: 'Standup entries grouped by timestamp',
		example: {
			'2025-08-19T09:30:06.010Z': [
				{
					name: 'Sainath',
					user: 'U09B52VV2HE',
					standup: {
						yesterday: [
							'Reviewed Slack docs',
							'Created dummy workspace',
						],
						today: ['Integrate Slack with AI'],
						blocker: ['Rate limit issues'],
						text: 'Full raw standup text',
					},
				},
			],
		},
	})
	data: Record<
		string,
		{
			name: string;
			user: string;
			standup: {
				yesterday: string[];
				today: string[];
				blocker: string[];
				text: string;
			};
		}[]
	>;
}
