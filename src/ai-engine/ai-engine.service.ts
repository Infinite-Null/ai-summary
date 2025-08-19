import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
	AIMessageChunk,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
import { SlackService } from 'src/slack/slack.service';

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
	private readonly prompt: string = `You are a project management analyst. Analyze the provided team standup data and create a precise project performance report.

                CRITICAL INSTRUCTIONS:
                1. ONLY include information explicitly mentioned in the context
                2. Do NOT infer or assume dates - use only dates found in the data or mark as "Not specified"
                3. Carefully distinguish between completed, in-progress, and review tasks based on explicit status indicators
                4. Be specific with task descriptions and include relevant PR/issue numbers when mentioned
                5. IMPORTANT: Ensure all text in JSON is properly escaped. Replace quotes with single quotes or escape them properly.

                You must respond with a valid JSON object that strictly follows this format:
                {{
                    "projectName": "Extract the actual project name from the context",
                    "from": "Start date in YYYY-MM-DD format if explicitly mentioned, otherwise Not specified",
                    "to": "End date in YYYY-MM-DD format if explicitly mentioned, otherwise Not specified", 
                    "projectStatus": "Green or Amber or Red based on project progress",
                    "riskBlockersActionsNeeded": "List ONLY explicitly mentioned blockers, risks, or issues requiring action. If everyone reports None for blockers, state No explicit blockers reported by team members.",
                    "taskDetails": {{
                        "completed": ["Array of specific completed tasks with details. Look for keywords: completed, merged, finished, done, accomplished. Include PR numbers and issue references."],
                        "inProgress": ["Array of tasks currently being worked on. Look for keywords: working on, continue, investigating, implementing. Include current status and next steps."],
                        "inReview": ["Array of tasks pending review/approval. Look for keywords: ready for review, pending review, waiting for approval, submitted for review."]
                    }}
                }}

                TASK CATEGORIZATION RULES:
                - Completed: Tasks explicitly marked as done, merged, accomplished, or finished
                - In Progress: Tasks with ongoing work, research, investigation, or continuation mentioned
                - In Review: Tasks explicitly mentioned as ready for review, pending approval, or awaiting feedback

                STATUS DETERMINATION:
                - Green: No major issues reported, tasks progressing as expected
                - Amber: Some delays, minor issues, or concerns mentioned by team members
                - Red: Critical blockers, failed tasks, or significant issues reported

                JSON FORMATTING RULES:
                - Use only double quotes for JSON keys and string values
                - Escape any double quotes within string values using backslash
                - Do not include line breaks within string values
                - Keep task descriptions concise and clear
                - Include specific GitHub PR/issue numbers when mentioned
                - If data spans multiple time periods, note this in the date fields
                - No need to mention name of person responsible for tasks, just add the concise task description
                - Paraphrase information as needed for clarity and conciseness for the client

Context:
{context}

{format_instructions}`;

	constructor(
		private readonly mapReduceService: MapReduceService,
		private readonly stuffService: StuffService,
		private readonly slackService: SlackService,
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

	/**
	 * Summarizes a document using the specified model and algorithm.
	 *
	 * @param summarizeDto - The DTO containing the summarization parameters.
	 * @returns A summary of the document.
	 */
	async summarize({
		provider,
		model,
		temperature,
		algorithm,
		channelName,
		startDate,
		endDate,
	}: SummarizeDTO) {
		const trace = this.langfuse.trace({
			name: `ai-poc-${algorithm}-summarization`,
			metadata: {
				provider,
				model,
				temperature,
			},
		});

		const llm = this.createModelInstance(provider, model, temperature);

		const standupData = await this.slackService.getStandups({
			channelName: channelName || 'proj-ai-internal',
			startDate: startDate || '2025-08-18T01:30:04.549Z',
			endDate: endDate || '2025-08-18T17:30:04.549Z',
		});

		const fileData = JSON.stringify(standupData, null, 2);

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
			[
				'user',
				`Write a concise summary of the following with task categorization focusing on project progress and achievements:
				\n\nRULES:
                - Completed: Tasks explicitly marked as done, merged, accomplished, or finished
                - In Progress: Tasks with ongoing work, research, investigation, or continuation mentioned
                - Identify main project areas and group related tasks under descriptive titles
                - Include specific details like PR numbers, technical specifics, and accomplishments
                - Focus on project deliverables, milestones, and current work status
				- Any Blockers: Tasks that are blocked by external factors, dependencies, or waiting on input
				\n\n{context}`,
			],
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
