import { ApiProperty } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDateString,
	IsOptional,
	IsString,
	MaxLength,
} from 'class-validator';

export class GitHubQueryDTO {
	@IsOptional()
	@ApiProperty({
		description: 'Considers GitHub data if set to true.',
		default: false,
		example: false,
	})
	enabled: boolean;

	@MaxLength(50)
	@IsString()
	@ApiProperty({
		description: 'The owner of the GitHub repository.',
		default: 'username',
		example: 'username',
	})
	owner: string;

	@MaxLength(50)
	@IsString()
	@ApiProperty({
		description: 'The name of the GitHub repository.',
		default: 'repo-name',
		example: 'repo-name',
	})
	repo: string;

	@IsDateString()
	@ApiProperty({
		description: 'The date from which to fetch issues.',
		default: undefined,
		example: '2025-08-18T01:30:04.549Z',
	})
	fromDate: string;

	@IsDateString()
	@ApiProperty({
		description:
			'Date must be today or later than the specified "fromdate" date to fetch issues.',
		default: undefined,
		example: '2025-08-18T01:30:04.549Z',
	})
	toDate: string;

	@MaxLength(50)
	@IsString()
	@ApiProperty({
		description: 'The name of the GitHub Repos Project Board.',
		default: 'Issue-tracker-board',
		example: 'project-board',
	})
	projectBoard: string;
}
