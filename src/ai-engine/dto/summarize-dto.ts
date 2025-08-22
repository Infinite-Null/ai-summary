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
import { MetadataQueryDTO } from './metadata-query-dto';

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
	@ValidateNested()
	@Type(() => MetadataQueryDTO)
	@ApiProperty({
		type: MetadataQueryDTO,
		description: 'Metadata specific data for LLM ingestion.',
		required: false,
	})
	metadata: MetadataQueryDTO;

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
