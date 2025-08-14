import {
	AIMessageChunk,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
	ChatGoogleGenerativeAI,
	GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { BadRequestException, Injectable } from '@nestjs/common';
import fs from 'fs';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { Document } from 'langchain/document';
import { Langfuse } from 'langfuse';

import { PromptTemplate } from '@langchain/core/prompts';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import {
	GoogleModels,
	ModelProvider,
	OpenAIModels,
	QuickAskDTO,
	SupportedModels,
} from './dto/quick-ask.dto';
import { SummaryStuffDTO } from './dto/summary-dto';
import { QUICK_ASK_SYSTEM_PROMPT } from './prompts';

@Injectable()
export class AiEngineService {
	private readonly langfuse: Langfuse;

	constructor() {
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
	): ChatOpenAI | ChatGoogleGenerativeAI {
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

	async summerizeStuff({ provider, model, temperature }: SummaryStuffDTO) {
		const fileData = fs.readFileSync(__dirname + '/dataset.txt', 'utf-8');

		const splitter = new RecursiveCharacterTextSplitter({
			chunkSize: 500,
			chunkOverlap: 50,
		});

		const docs = await splitter.splitDocuments([
			new Document({ pageContent: fileData }),
		]);

		const llm = this.createModelInstance(provider, model, temperature);
		const prompt = PromptTemplate.fromTemplate(
			'Summarize the main themes retrieved from docs: {context}',
		);

		const chain = await createStuffDocumentsChain({
			llm,
			outputParser: new StringOutputParser(),
			prompt,
		});

		// Normal
		const result = await chain.invoke({ context: docs });

		return { summary: result };
	}
}
