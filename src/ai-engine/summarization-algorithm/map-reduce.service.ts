import { Document } from '@langchain/core/documents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import { Annotation, Send, StateGraph } from '@langchain/langgraph';
import { Injectable } from '@nestjs/common';
import {
	collapseDocs,
	splitListOfDocs,
} from 'langchain/chains/combine_documents/reduce';
import { TokenTextSplitter } from 'langchain/text_splitter';
import { ProjectSummarySchema } from '../types/output';

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
	finalSummaryObject: Annotation<ProjectSummarySchema>,
});

@Injectable()
export class MapReduceService {
	private llm: BaseChatModel;
	private mapPrompt: ChatPromptTemplate;
	private reducePrompt: ChatPromptTemplate;
	private finalPrompt: PromptTemplate;
	private jsonOutputParser: JsonOutputParser<ProjectSummarySchema>;
	private maxTokens: number;

	private initialize(
		llm: BaseChatModel,
		mapPrompt: ChatPromptTemplate,
		reducePrompt: ChatPromptTemplate,
		finalPrompt: PromptTemplate,
		maxTokens: number,
	) {
		this.llm = llm;
		this.mapPrompt = mapPrompt;
		this.reducePrompt = reducePrompt;
		this.finalPrompt = finalPrompt;
		this.jsonOutputParser = new JsonOutputParser<ProjectSummarySchema>();
		this.maxTokens = maxTokens;
	}

	async summarize(
		llm: BaseChatModel,
		docs: Document[],
		mapPrompt: ChatPromptTemplate,
		reducePrompt: ChatPromptTemplate,
		finalPrompt: PromptTemplate,
		chunkSize: number = 1_000,
		chunkOverlap: number = 0,
		maxTokens: number = 250_000,
	): Promise<ProjectSummarySchema> {
		// Initialize shared state.
		this.initialize(llm, mapPrompt, reducePrompt, finalPrompt, maxTokens);

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
		let finalSummaryObject: ProjectSummarySchema | undefined;
		for await (const step of await app.stream(
			{ contents: splitDocuments.map((doc) => doc.pageContent) },
			{ recursionLimit: 10 },
		)) {
			if ('generateFinalSummary' in step) {
				finalSummaryObject =
					step.generateFinalSummary?.finalSummaryObject;
			}
		}

		if (!finalSummaryObject) {
			throw new Error('Failed to generate final summary');
		}

		return finalSummaryObject;
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
		// Use the final prompt template with format instructions for structured output
		const prompt = await this.finalPrompt.invoke({
			context: state.collapsedSummaries,
			format_instructions: this.jsonOutputParser.getFormatInstructions(),
		});

		const response = await this.llm.invoke(prompt);

		const parsedResponse = await this.jsonOutputParser.parse(
			typeof response.content === 'object'
				? JSON.stringify(response.content)
				: String(response.content),
		);

		return {
			finalSummary: JSON.stringify(parsedResponse),
			finalSummaryObject: parsedResponse,
		};
	};
}
