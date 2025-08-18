import { Injectable, Logger } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import {
	RecursiveCharacterTextSplitter,
	TokenTextSplitter,
} from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Annotation, Send, StateGraph } from '@langchain/langgraph';
import {
	collapseDocs,
	splitListOfDocs,
} from 'langchain/chains/combine_documents/reduce';

interface SummaryState {
	content: string;
}

const OverallState = Annotation.Root({
	contents: Annotation<string[]>,
	summaries: Annotation<string[]>({
		reducer: (state, update) => state.concat(update),
	}),
	collapsedSummaries: Annotation<Document[]>,
	finalSummary: Annotation<string>,
});

@Injectable()
export class MapReduceService {
	/**
	 * Logger instance for the AI Engine service.
	 */
	private readonly logger = new Logger(MapReduceService.name, {
		timestamp: true,
	});

	/**
	 * The language model used for summarization.
	 */
	private llm: BaseChatModel;

	/**
	 * Prompt for the map step in the MapReduce algorithm.
	 */
	private mapPrompt: ChatPromptTemplate;

	/**
	 * Prompt for the reduce step in the MapReduce algorithm.
	 */
	private reducePrompt: ChatPromptTemplate;

	/**
	 * Maximum number of tokens allowed for summarization.
	 */
	private maxTokens: number;

	private initialize(
		llm: BaseChatModel,
		mapPrompt: ChatPromptTemplate,
		reducePrompt: ChatPromptTemplate,
		maxTokens: number,
	) {
		this.llm = llm;
		this.mapPrompt = mapPrompt;
		this.reducePrompt = reducePrompt;
		this.maxTokens = maxTokens;
	}

	/**
	 * Summarizes a list of documents using the MapReduce algorithm. We use a higher chunk size
	 * to ensure that the sub-documents are large enough for the model to process effectively.
	 *
	 * The overlap is set to 0 to avoid redundancy in the chunks while summarizing, as the
	 * reduction step will combine adjacent chunks any way.
	 *
	 * @param llm - The language model to use for summarization.
	 * @param docs - The documents to summarize.
	 * @param mapPrompt - The prompt template for the map step.
	 * @param reducePrompt - The prompt template for the reduce step.
	 * @param chunkSize - The size of each chunk for splitting documents. (default: 25,000)
	 * @param chunkOverlap - The overlap size between chunks. (default: 0)
	 * @param maxTokens - The maximum number of tokens allowed for summarization. (default: 250,000)
	 * @returns The final summary as a string.
	 */
	async summarize(
		llm: BaseChatModel,
		docs: Document[],
		mapPrompt: ChatPromptTemplate,
		reducePrompt: ChatPromptTemplate,
		chunkSize: number = 1_500,
		chunkOverlap: number = 0,
		maxTokens: number = 128_000,
	) {
		/**
		 * Initializes shared state.
		 *
		 * @todo Currently, there's no way of determining maxTokens based on the model (in langchain), 128k is a
		 * decent default for most models. We should ideally determine this based on the model's token limit.
		 */
		this.initialize(llm, mapPrompt, reducePrompt, maxTokens);

		let splitDocuments: Document[] = [];
		try {
			const textSplitter = new TokenTextSplitter({
				chunkSize,
				chunkOverlap,
				encodingName: 'cl100k_base',
			});

			splitDocuments = await textSplitter.splitDocuments(docs);
		} catch (error) {
			this.logger.error(
				'Error splitting documents with TokenTextSplitter falling back to RecursiveCharacterTextSplitter',
				error,
			);

			const textSplitter = new RecursiveCharacterTextSplitter({
				chunkSize,
				chunkOverlap,
			});

			splitDocuments = await textSplitter.splitDocuments(docs);
		}

		const graph = new StateGraph(OverallState)
			.addNode('generateSummary', this.generateSummary)
			.addNode('collectSummaries', this.collectSummaries)
			.addNode('collapseSummaries', this.collapseSummaries)
			.addNode('generateFinalSummary', this.generateFinalSummary)
			.addConditionalEdges('__start__', this.mapSummaries, [
				'generateSummary',
			])
			.addEdge('generateSummary', 'collectSummaries')
			.addConditionalEdges('collectSummaries', this.shouldCollapse, [
				'collapseSummaries',
				'generateFinalSummary',
			])
			.addConditionalEdges('collapseSummaries', this.shouldCollapse, [
				'collapseSummaries',
				'generateFinalSummary',
			])
			.addEdge('generateFinalSummary', '__end__');

		const app = graph.compile();
		let finalSummary: string | undefined = '';
		for await (const step of await app.stream(
			{ contents: splitDocuments.map((doc) => doc.pageContent) },
			{ recursionLimit: 10 },
		)) {
			if ('generateFinalSummary' in step) {
				finalSummary = step.generateFinalSummary?.finalSummary;
			}
		}

		return finalSummary;
	}

	private async _reduce(input: Document[]): Promise<string> {
		const prompt = await this.reducePrompt.invoke({
			docs: input,
		});

		const response = await this.llm.invoke(prompt);

		return String(
			typeof response.content === 'object'
				? JSON.stringify(response.content)
				: response.content,
		);
	}

	private async lengthFunction(documents: Document[]): Promise<number> {
		const tokenCounts = await Promise.all(
			documents.map(async (doc) => {
				return this.llm.getNumTokens(doc.pageContent);
			}),
		);

		return tokenCounts.reduce((sum, count) => sum + count, 0);
	}

	private mapSummaries = (state: typeof OverallState.State) => {
		return state.contents.map(
			(content) => new Send('generateSummary', { content }),
		);
	};

	private shouldCollapse = async (
		state: typeof OverallState.State,
	): Promise<'collapseSummaries' | 'generateFinalSummary'> => {
		const numTokens = await this.lengthFunction(state.collapsedSummaries);

		return numTokens > this.maxTokens
			? 'collapseSummaries'
			: 'generateFinalSummary';
	};

	private generateSummary = async (state: SummaryState) => {
		const prompt = await this.mapPrompt.invoke({ context: state.content });
		const response = await this.llm.invoke(prompt);

		return {
			summaries: [
				typeof response.content === 'object'
					? JSON.stringify(response.content)
					: String(response.content),
			],
		};
	};

	private collectSummaries = (state: typeof OverallState.State) => {
		return {
			collapsedSummaries: state.summaries.map(
				(summary) => new Document({ pageContent: summary }),
			),
		};
	};

	private collapseSummaries = async (state: typeof OverallState.State) => {
		const docLists = splitListOfDocs(
			state.collapsedSummaries,
			(docs: Document[]) => this.lengthFunction(docs),
			this.maxTokens,
		);

		const results: Document[] = [];
		for (const docList of docLists) {
			results.push(
				await collapseDocs(docList, (input: Document[]) =>
					this._reduce(input),
				),
			);
		}

		return { collapsedSummaries: results };
	};

	private generateFinalSummary = async (state: typeof OverallState.State) => {
		const response = await this._reduce(state.collapsedSummaries);
		return { finalSummary: response };
	};
}
