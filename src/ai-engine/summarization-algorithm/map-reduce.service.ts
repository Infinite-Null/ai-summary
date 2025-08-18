import { Injectable } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { TokenTextSplitter } from 'langchain/text_splitter';
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
	private llm: BaseChatModel;
	private mapPrompt: ChatPromptTemplate;
	private reducePrompt: ChatPromptTemplate;
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

	async summarize(
		llm: BaseChatModel,
		docs: Document[],
		mapPrompt: ChatPromptTemplate,
		reducePrompt: ChatPromptTemplate,
		chunkSize: number = 1_000,
		chunkOverlap: number = 0,
		maxTokens: number = 250_000,
	) {
		// Initialize shared state.
		this.initialize(llm, mapPrompt, reducePrompt, maxTokens);

		const textSplitter = new TokenTextSplitter({
			chunkSize,
			chunkOverlap,
		});

		const splitDocuments = await textSplitter.splitDocuments(docs);

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
