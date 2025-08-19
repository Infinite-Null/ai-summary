import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import {
	GoogleModels,
	ModelProvider,
	OpenAIModels,
	type SupportedModels,
} from './quick-ask.dto';
import { ApiProperty } from '@nestjs/swagger';

export class SummarizeDTO {
	/**
	 * The model provider to use for the query.
	 */
	@IsOptional()
	@IsEnum(ModelProvider)
	@ApiProperty({
		description: 'The model provider to use for the query.',
		default: ModelProvider.OPENAI,
		enum: ModelProvider,
		example: ModelProvider.OPENAI,
	})
	provider?: ModelProvider;

	/**
	 * The specific model to use for the query.
	 */
	@IsOptional()
	@IsEnum({ ...OpenAIModels, ...GoogleModels })
	@ApiProperty({
		description: 'The specific model to use for the query.',
		default: OpenAIModels.GPT_4o_MINI,
		enum: [OpenAIModels, GoogleModels],
		example: OpenAIModels.GPT_4o_MINI,
	})
	model?: SupportedModels;

	/**
	 * The temperature setting for the model.
	 */
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
	temperature?: number;

	@IsOptional()
	@IsEnum(['map-reduce', 'stuff', 'auto'])
	@ApiProperty({
		description: 'The summarization algorithm to use.',
		default: 'auto',
		enum: ['map-reduce', 'stuff', 'auto'],
		example: 'auto',
	})
	algorithm?: 'map-reduce' | 'stuff' | 'auto';
}
