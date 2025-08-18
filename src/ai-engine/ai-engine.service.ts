import {
	AIMessageChunk,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import {
	ChatGoogleGenerativeAI,
	GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Langfuse } from 'langfuse';
import {
	GoogleModels,
	ModelProvider,
	OpenAIModels,
	QuickAskDTO,
	SupportedModels,
} from './dto/quick-ask.dto';
import { QUICK_ASK_SYSTEM_PROMPT } from './prompts';
import { SummarizeDTO } from './dto/summarize-dto';
import { MapReduceService } from './summarization-algorithm/map-reduce.service';
import { StuffService } from './summarization-algorithm/stuff.service';
import { readFileSync } from 'fs';
import { Document } from 'langchain/document';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

@Injectable()
export class AiEngineService {
	/**
	 * Logger instance for the AI Engine service.
	 */
	private readonly logger = new Logger(AiEngineService.name, {
		timestamp: true,
	});

	/**
	 * Maximum number of tokens allowed for "stuff" summarization.
	 */
	private readonly MAX_TOKENS = 100_000;

	/**
	 * Langfuse instance for tracing and monitoring.
	 */
	private readonly langfuse: Langfuse;

	constructor(
		private readonly mapReduceService: MapReduceService,
		private readonly stuffService: StuffService,
	) {
		this.langfuse = new Langfuse({
			publicKey: process.env.LANGFUSE_PUBLIC_KEY,
			secretKey: process.env.LANGFUSE_SECRET_KEY,
			baseUrl: process.env.LANGFUSE_BASE_URL,
		});
	}

	/**
	 * Creates an instance of the AI model.
	 *
	 * @param provider - The model provider to use (OpenAI or Google).
	 * @param model - The model to use for the AI engine.
	 * @param temperature - The temperature setting for the model.
	 * @returns An instance of the model or an error if the provider is not supported.
	 */
	createModelInstance(
		provider: ModelProvider = ModelProvider.OPENAI,
		model: SupportedModels = OpenAIModels.GPT_3_5_TURBO,
		temperature: number = 0.7,
	): BaseChatModel {
		if (!this.validateModel(provider, model)) {
			throw new BadRequestException(
				`Unsupported model ${model} for provider ${provider}.`,
			);
		}

		if (provider === ModelProvider.GOOGLE) {
			return new ChatGoogleGenerativeAI({
				model,
				temperature,
			});
		}

		// Fallback to the default provider (OpenAI).
		return new ChatOpenAI({ model, temperature });
	}

	createEmbeddingInstance(
		provider: ModelProvider = ModelProvider.OPENAI,
		model: SupportedModels = OpenAIModels.GPT_3_5_TURBO,
	): OpenAIEmbeddings | GoogleGenerativeAIEmbeddings {
		if (!this.validateModel(provider, model)) {
			throw new BadRequestException(
				`Unsupported model ${model} for provider ${provider}.`,
			);
		}

		if (provider === ModelProvider.GOOGLE) {
			return new GoogleGenerativeAIEmbeddings({
				apiKey: process.env.GOOGLE_API_KEY,
				model: 'embedding-001',
			});
		}

		// Fallback to the default provider (OpenAI).
		return new OpenAIEmbeddings({
			apiKey: process.env.OPENAI_API_KEY,
			model: 'text-embedding-ada-002',
		});
	}

	validateModel(provider: ModelProvider, model: SupportedModels): boolean {
		if (provider === ModelProvider.OPENAI) {
			return Object.values(OpenAIModels).includes(model as OpenAIModels);
		} else if (provider === ModelProvider.GOOGLE) {
			return Object.values(GoogleModels).includes(model as GoogleModels);
		}
		return false;
	}

	/**
	 * Processes a quick ask query and returns a response.
	 *
	 * @param quickAskDto - The DTO containing the user's query and model/provider details.
	 * @returns A response from the AI engine.
	 */
	async quickAsk({
		provider,
		userQuery,
		model,
		temperature,
	}: QuickAskDTO): Promise<AIMessageChunk> {
		const messages = [
			new SystemMessage(QUICK_ASK_SYSTEM_PROMPT),
			new HumanMessage(userQuery),
		];

		const trace = this.langfuse.trace({
			name: 'ai-poc',
			metadata: {
				provider,
				userQuery,
				model,
				temperature,
			},
		});

		const modelInstance = this.createModelInstance(
			provider,
			model,
			temperature,
		);

		const generation = trace.generation({
			name: `${provider}-${model}-generation`,
			model: model || 'gpt-3.5-turbo',
			input: { messages: userQuery },
			modelParameters: {
				temperature: temperature || 0.7,
			},
		});

		const response = await modelInstance.invoke(messages);

		generation.end({
			output: response.content,
		});

		await this.langfuse.shutdownAsync();

		return response;
	}

	async summarize({ provider, model, temperature, algorithm }: SummarizeDTO) {
		const llm = this.createModelInstance(provider, model, temperature);

		// TODO: Implement data ingestion from API responses as tool execution and remove this line.
		const fileData = readFileSync('./dataset.txt', 'utf-8');

		/**
		 * TODO: It's best to use a single document to store the data pertaining to a
		 * particular source as it's easier and efficient for bulk summarization. If
		 * it would have been RAG/retrieval, then we would have used multiple documents
		 * with metadata to store the data.
		 *
		 * @note Ensure that we pass metadata pertaining to during actual implementation.
		 */
		const docs = [new Document({ pageContent: fileData, metadata: {} })];

		const tokenCounts = await Promise.all(
			docs.map(async (doc) => {
				return llm.getNumTokens(doc.pageContent);
			}),
		);

		const totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);

		// If the total number of tokens is less than the maximum allowed, use the "stuff" summarization method.
		if (totalTokens < this.MAX_TOKENS && algorithm !== 'map-reduce') {
			this.logger.log('Running stuff summarization algorithm');

			const prompt = PromptTemplate.fromTemplate(
				'Write a detailed summary of the following: \n\n{context}',
			);

			return this.stuffService.summarize(llm, prompt, docs);
		}

		// Else, fall back to the map-reduce summarization method.
		this.logger.log('Running map-reduce summarization algorithm');

		const mapPrompt = ChatPromptTemplate.fromMessages([
			['user', 'Write a concise summary of the following: \n\n{context}'],
		]);

		const reduceTemplate = `
			The following is a set of summaries:
			{docs}
			Take these and distill it into a final, consolidated summary
			of the main themes.
		`;

		const reducePrompt = ChatPromptTemplate.fromMessages([
			['user', reduceTemplate],
		]);

		const response = await this.mapReduceService.summarize(
			llm,
			docs,
			mapPrompt,
			reducePrompt,
		);

		return { summary: response };
	}
}
