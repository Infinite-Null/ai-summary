import {
	IsEnum,
	IsNumber,
	IsOptional,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';
import {
	GoogleModels,
	ModelProvider,
	OpenAIModels,
	type SupportedModels,
} from './quick-ask.dto';
import { ApiProperty } from '@nestjs/swagger';
import { GitHubQueryDTO } from './github-query-dto';
import { Type } from 'class-transformer';
import { SlackQueryDTO } from './slack-query-dto';

export class SummarizeDTO {
	@IsOptional()
	@IsEnum(ModelProvider)
	@ApiProperty({
		description: 'The model provider to use for the query.',
		default: ModelProvider.GOOGLE,
		enum: ModelProvider,
		example: ModelProvider.GOOGLE,
	})
	provider: ModelProvider;

	@IsOptional()
	@IsEnum({ ...OpenAIModels, ...GoogleModels })
	@ApiProperty({
		description: 'The specific model to use for the query.',
		default: GoogleModels.GEMINI_2_FLASH,
		enum: [OpenAIModels, GoogleModels],
		example: GoogleModels.GEMINI_2_FLASH,
	})
	model: SupportedModels;

	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(1)
	@ApiProperty({
		description: 'The temperature setting for the model.',
		default: 0.7,
		example: 0.7,
		type: Number,
		minimum: 0,
		maximum: 1,
	})
	temperature: number;

	@IsOptional()
	@IsEnum(['map-reduce', 'stuff', 'auto'])
	@ApiProperty({
		description: 'The summarization algorithm to use.',
		default: 'auto',
		enum: ['map-reduce', 'stuff', 'auto'],
		example: 'auto',
	})
	algorithm: 'map-reduce' | 'stuff' | 'auto';

	@IsOptional()
	@ApiProperty({
		description: 'The start date for fetching messages (ISO format).',
		default: '2025-08-18T01:30:04.549Z',
		example: '2025-08-18T01:30:04.549Z',
	})
	startDate: string;

	@IsOptional()
	@ApiProperty({
		description: 'The end date for fetching messages (ISO format).',
		default: '2025-08-18T17:30:04.549Z',
		example: '2025-08-18T17:30:04.549Z',
	})
	endDate: string;

	@IsOptional()
	@ApiProperty({
		description: 'The name of the document to summarize.',
		default: 'Merge Tags Replacement - New',
		example: 'Merge Tags Replacement - New',
	})
	docName: string;

	@IsOptional()
	@IsEnum(['Green', 'Amber', 'Red'])
	@ApiProperty({
		description: 'The project status.',
		default: 'Green',
		enum: ['Green', 'Amber', 'Red'],
		example: 'Green',
	})
	projectStatus: 'Green' | 'Amber' | 'Red';

	@IsOptional()
	@ApiProperty({
		description: 'The name of the project to summarize.',
		default: 'AI Internal',
		example: 'AI Internal',
	})
	projectName: string;

	@IsOptional()
	@ValidateNested()
	@Type(() => GitHubQueryDTO)
	@ApiProperty({
		type: GitHubQueryDTO,
		description: 'GitHub specific data for LLM ingestion.',
		required: false,
	})
	githubData: GitHubQueryDTO;

	@IsOptional()
	@ValidateNested()
	@Type(() => SlackQueryDTO)
	@ApiProperty({
		type: SlackQueryDTO,
		description: 'Slack specific data for LLM ingestion.',
		required: false,
	})
	slackData: SlackQueryDTO;
}
