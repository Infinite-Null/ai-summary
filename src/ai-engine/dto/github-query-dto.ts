import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

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

	@MaxLength(50)
	@IsString()
	@ApiProperty({
		description: 'The name of the GitHub Repos Project Board.',
		default: 'Issue-tracker-board',
		example: 'project-board',
	})
	projectBoard: string;
}
