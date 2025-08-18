import { BaseChatModel } from '@langchain/core/language_models/chat_models';
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
import { readFileSync } from 'fs';
import { Document } from 'langchain/document';
import { Langfuse } from 'langfuse';
import {
	GoogleModels,
	ModelProvider,
	OpenAIModels,
	QuickAskDTO,
	SupportedModels,
} from './dto/quick-ask.dto';
import { SummarizeDTO } from './dto/summarize-dto';
import { QUICK_ASK_SYSTEM_PROMPT } from './prompts';
import { MapReduceService } from './summarization-algorithm/map-reduce.service';
import { StuffService } from './summarization-algorithm/stuff.service';

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

	/**
	 * Prompt template for project performance report generation.
	 */
	private readonly prompt: string = `Using the context below, analyze the project data and create a structured project performance report.
                
                You must respond with a JSON object that strictly follows this format:
                {{
                    "projectName": "Name of the project",
                    "from": "Start date in format YYYY-MM-DD",
                    "to": "End date in format YYYY-MM-DD", 
                    "projectStatus": "Green, Amber, or Red based on project progress",
                    "riskBlockersActionsNeeded": "List critical items the client needs to be aware of - timeline changes, scope changes, access blocks, information/approval blocks, etc. List in most critical to least critical order. If no risks or blockers, indicate 'No critical risks or blockers identified.' Tag team member names who need to action items from the client.",
                    "taskDetails": {{
                        "completed": "List of completed tasks and achievements",
                        "inProgress": "Tasks currently being worked on",
                        "inReview": "Tasks that are completed but pending review or approval"
			        }}
                }}

                Guidelines:
                - ProjectName: Extract or infer the project name from the context
                - Dates: Use the reporting period dates or infer appropriate date ranges
                - Project_Status: Analyze progress and assign Green (on track), Amber (some concerns), or Red (significant issues)
                - Risk_Blockers_Actions_Needed: Focus on actionable items requiring client attention
                - Task Details: Categorize work items appropriately

                Context:
                {context}

                {format_instructions}`;

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
		const trace = this.langfuse.trace({
			name: `ai-poc-${algorithm}-summarization`,
			metadata: {
				provider,
				model,
				temperature,
			},
		});

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

		const span = trace.span({
			name: 'ai-poc-token-count',
			input: docs.map((doc) => doc.pageContent),
		});

		const tokenCounts = await Promise.all(
			docs.map(async (doc) => {
				return llm.getNumTokens(doc.pageContent);
			}),
		);

		const totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);

		span.end({
			output: {
				totalTokens,
			},
		});

		// If the total number of tokens is less than the maximum allowed, use the "stuff" summarization method.
		if (
			algorithm === 'stuff' ||
			(algorithm === 'auto' && totalTokens < this.MAX_TOKENS)
		) {
			this.logger.log('Running stuff summarization algorithm');

			const prompt = PromptTemplate.fromTemplate(this.prompt);

			const generation = trace.generation({
				name: `${provider}-${model}-generation`,
				model: model,
				input: { messages: prompt },
				modelParameters: {
					temperature: temperature || 0.7,
				},
				metadata: {
					totalTokens,
					algorithm: 'stuff',
				},
			});

			const result = await this.stuffService.summarize(llm, prompt, docs);

			generation.end({
				output: result,
			});

			await this.langfuse.shutdownAsync();
			return result;
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

		const finalPrompt = PromptTemplate.fromTemplate(this.prompt);

		const response = await this.mapReduceService.summarize(
			llm,
			docs,
			mapPrompt,
			reducePrompt,
			finalPrompt,
			trace,
			provider,
			model,
			temperature,
			totalTokens,
		);

		await this.langfuse.shutdownAsync();

		return response;
	}
}
