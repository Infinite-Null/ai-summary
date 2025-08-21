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
import { SlackService } from 'src/slack/slack.service';
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
import { ProjectSummarySchema } from './types/output';
import { GithubService } from 'src/github/github.service';

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
	private readonly prompt: string = `You are a project management analyst. Analyze the provided team standup data and create a comprehensive project summary report.

CRITICAL INSTRUCTIONS:
1. ONLY include information explicitly mentioned in the context
2. Create a comprehensive narrative summary of the project progress
3. Categorize tasks into completed and in-progress with detailed descriptions
4. Identify risks, blockers, and actions needed based on the provided data
5. Format task details with main issue titles followed by bullet points of specific actions

You must respond with a valid JSON object that strictly follows this format:
{{
    "summary": "A comprehensive narrative summary of the project's current state, key accomplishments, and overall progress. This should be 3-4 paragraphs providing a complete overview of where the project stands, what has been achieved, and what is currently happening. Include specific details about deliverables, milestones, and current focus areas.",
    "riskBlockerActionNeeded": "Detailed description of any risks, blockers, or critical actions that need immediate attention. If there are no explicit blockers mentioned, state 'No explicit blockers reported.' Include specific action items, dependencies, and any issues that could impact project timeline or success.",
    "taskDetails": {{
        "completed": "Format as: Main Issue Title: Brief description of the completed work. Use bullet points for specific items: - Specific action item completed - Another specific action item completed - Additional completed task details. Repeat this format for each major completed area. Include PR numbers, issue references, and specific achievements.",
        "inProgress": "Format as: Main Issue Title: Brief description of ongoing work. Use bullet points for specific items: - Current task being worked on - Another ongoing task - Status of current work. Repeat this format for each major in-progress area. Include current status, next steps, and any dependencies.",
        "inReview": "Format as: Main Issue Title: Brief description of work under review. Use bullet points for specific items: - Pull request or deliverable under review - Code review or approval process - Documentation or design review status. Repeat this format for each major review area. Include PR numbers, reviewer information, and review status when available.  If there are no explicit in review, state 'Nothing is in review.'"
    }}
}}

CONTENT GUIDELINES:
- Summary: Should read like a professional project status report narrative
- Risk/Blockers: Focus on actionable items that need attention or resolution
- Completed Tasks: Group related completed work under descriptive main titles
- In-Progress Tasks: Group ongoing work under descriptive main titles with current status
- In-Review Tasks: Group work under review under descriptive main titles with review status

FORMATTING RULES:
- Use only double quotes for JSON keys and string values
- Escape any double quotes within string values using backslash
- Keep descriptions clear and professional
- Include specific details like PR numbers, dates, and technical specifics when mentioned
- Use bullet points (-) for individual task items within each main category
- Each main issue title should be followed by a colon and brief description
- Maintain professional tone throughout

Context:
{context}

{format_instructions}`;

	constructor(
		private readonly mapReduceService: MapReduceService,
		private readonly stuffService: StuffService,
		private readonly slackService: SlackService,
		private readonly githubService: GithubService,
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

	structureResponse(
		response: ProjectSummarySchema,
		projectName: string | undefined,
		from: string | undefined,
		to: string | undefined,
		projectStatus: string | undefined,
		docName: string | undefined,
	) {
		return {
			replacements: {
				projectName,
				from,
				to,
				projectStatus,
				summary: response?.summary ?? '',
				riskBlockerActionNeeded:
					response?.riskBlockerActionNeeded ?? '',
				completed: response?.taskDetails?.completed ?? '',
				inProgress: response?.taskDetails?.inProgress ?? '',
				inReview: response?.taskDetails?.inReview ?? '',
			},
			docName,
		};
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
		projectName,
		docName,
		projectStatus,
		githubData,
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

		// Format dates to readable format (DD MMM YYYY)
		const formatDate = (dateString: string) => {
			const date = new Date(dateString);
			return date.toLocaleDateString('en-GB', {
				day: '2-digit',
				month: 'short',
				year: 'numeric',
			});
		};

		const formattedStartDate = startDate
			? formatDate(startDate)
			: formatDate('2025-08-18T01:30:04.549Z');
		const formattedEndDate = endDate
			? formatDate(endDate)
			: formatDate('2025-08-18T17:30:04.549Z');

		const standupData = await this.slackService.getStandups({
			channelName: channelName || 'proj-ai-internal',
			startDate: startDate || '2025-08-18T01:30:04.549Z',
			endDate: endDate || '2025-08-18T17:30:04.549Z',
		});

		/**
		 * It's best to use a single document to store the data pertaining to a
		 * particular source as it's easier and efficient for bulk summarization. If
		 * it would have been RAG/retrieval, then we would have used multiple documents
		 * with metadata to store the data.
		 */
		const docs: Document[] = [];

		if (githubData.enabled) {
			const { fetchBody, fetchComments, owner, repo, since } = githubData;
			const githubResponse = await this.githubService.fetchIssues(
				owner,
				repo,
				new Date(since),
				fetchBody,
				fetchComments,
			);
			docs.push(
				new Document({
					pageContent: JSON.stringify(githubResponse, null, 2),
					metadata: {
						source: 'github',
						owner,
						repo,
						since: since,
					},
				}),
			);
		}

		const slackData = JSON.stringify(standupData, null, 2);
		docs.push(
			new Document({
				pageContent: slackData,
				metadata: {
					source: 'slack',
					channelName: channelName,
					startDate: formattedStartDate,
					endDate: formattedEndDate,
				},
			}),
		);

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
			const finalStructuredResponse = this.structureResponse(
				result,
				projectName,
				formattedStartDate,
				formattedEndDate,
				projectStatus,
				docName,
			);

			return finalStructuredResponse;
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
                - In Review: Tasks under review, awaiting approval, or in pull request/code review process
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

		const finalStructuredResponse = this.structureResponse(
			response,
			projectName,
			formattedStartDate,
			formattedEndDate,
			projectStatus,
			docName,
		);

		return finalStructuredResponse;
	}
}
