import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import { Injectable, Logger } from '@nestjs/common';
import { Document } from 'langchain/document';
import { Langfuse, TextPromptClient } from 'langfuse';
import { GithubService } from 'src/github/github.service';
import { GoogleDocService } from 'src/google-doc/google-doc.service';
import { SlackService } from 'src/slack/slack.service';
import { SummarizeDTO } from './dto/summarize-dto';
import { FORMAT } from './prompts';
import { MapReduceService } from './summarization-algorithm/map-reduce.service';
import { StuffService } from './summarization-algorithm/stuff.service';
import { ProjectSummarySchema } from './types/output';
import { ModelFactoryService } from 'src/model-factory/model-factory.service';

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
	private prompt: TextPromptClient;

	constructor(
		private readonly modelFactoryService: ModelFactoryService,
		private readonly mapReduceService: MapReduceService,
		private readonly stuffService: StuffService,
		private readonly slackService: SlackService,
		private readonly githubService: GithubService,
		private readonly googleDocService: GoogleDocService,
	) {
		this.langfuse = new Langfuse({
			publicKey: process.env.LANGFUSE_PUBLIC_KEY,
			secretKey: process.env.LANGFUSE_SECRET_KEY,
			baseUrl: process.env.LANGFUSE_BASE_URL,
		});
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
				summary: response?.summary?.replaceAll('\n\n', '\n') ?? '',
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

		this.prompt = await this.langfuse.getPrompt('ai-summary-poc');
		const llm = this.modelFactoryService.createModelInstance(
			provider,
			model,
			temperature,
		);

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

			const prompt = PromptTemplate.fromTemplate(
				this.prompt.compile({
					format: FORMAT,
				}),
			);

			const generation = trace.generation({
				name: `${provider}-${model}-generation`,
				model: model,
				prompt: this.prompt,
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

			const documentUrl = await this.googleDocService.generateDocument(
				// eslint-disable-next-line
				finalStructuredResponse as any,
			);

			return {
				...finalStructuredResponse,
				...documentUrl,
			};
		}

		// Else, fall back to the map-reduce summarization method.
		this.logger.log('Running map-reduce summarization algorithm');

		const mapTemplate = await this.langfuse.getPrompt(
			'ai-summary-map-template',
		);

		const mapPrompt = ChatPromptTemplate.fromMessages([
			['user', mapTemplate.compile()],
		]);

		const reduceTemplate = await this.langfuse.getPrompt(
			'ai-summary-reduce-template',
		);

		const reducePrompt = ChatPromptTemplate.fromMessages([
			['user', reduceTemplate.compile()],
		]);

		const finalPrompt = PromptTemplate.fromTemplate(
			this.prompt.compile({
				format: FORMAT,
			}),
		);

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
			this.prompt,
			mapTemplate,
			reduceTemplate,
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

		const documentUrl = await this.googleDocService.generateDocument(
			// eslint-disable-next-line
			finalStructuredResponse as any,
		);

		return {
			...finalStructuredResponse,
			...documentUrl,
		};
	}
}
