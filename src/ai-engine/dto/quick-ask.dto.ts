import { ApiProperty } from '@nestjs/swagger';
import {
	IsEnum,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';

export enum ModelProvider {
	OPENAI = 'openai',
	GOOGLE = 'google',
}

export enum OpenAIModels {
	GPT_3_5_TURBO = 'gpt-3.5-turbo',
	GPT_4 = 'gpt-4',
	GPT_4o_MINI = 'gpt-4o-mini',
}

export enum GoogleModels {
	GEMINI_2_FLASH = 'gemini-2.0-flash',
}

export type SupportedModels = OpenAIModels | GoogleModels;

export class QuickAskDTO {
	/**
	 * The user's query for the AI engine.
	 */
	@MinLength(1)
	@MaxLength(200)
	@IsString()
	@ApiProperty({
		description: 'The user query for the AI engine.',
		example: 'What is the capital of France?',
	})
	userQuery: string;

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
		default: OpenAIModels.GPT_3_5_TURBO,
		enum: [OpenAIModels, GoogleModels],
		example: OpenAIModels.GPT_3_5_TURBO,
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
}
