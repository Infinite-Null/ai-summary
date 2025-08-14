import {
	AIMessageChunk,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import {
	ChatGoogleGenerativeAI,
	GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { Annotation, Send, StateGraph } from '@langchain/langgraph';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { BadRequestException, Injectable } from '@nestjs/common';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import {
	collapseDocs,
	splitListOfDocs,
} from 'langchain/chains/combine_documents/reduce';
import { Document } from 'langchain/document';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { TokenTextSplitter } from 'langchain/text_splitter';
import { Langfuse } from 'langfuse';
import {
	GoogleModels,
	ModelProvider,
	OpenAIModels,
	QuickAskDTO,
	SupportedModels,
} from './dto/quick-ask.dto';
import { SummaryStuffDTO } from './dto/summary-dto';
import { QUICK_ASK_SYSTEM_PROMPT } from './prompts';

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
export class AiEngineService {
	private readonly tokenMax = 4000;
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

	/**
	 * Performs a map-reduce summarization of the provided data.
	 */
	async mapReduceSummarization() {
		const provider = ModelProvider.OPENAI;
		const model = OpenAIModels.GPT_3_5_TURBO;
		const temperature = 0.8;

		const llm = this.createModelInstance(provider, model, temperature);

		const trace = this.langfuse.trace({
			name: 'ai-poc-map-reduce-summarization',
			metadata: {
				provider,
				model,
				temperature,
			},
		});

		// Load documents using a text based loader.
		const loader = new TextLoader('dataset.txt');
		const docs = await loader.load();

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

		const textSplitter = new TokenTextSplitter({
			chunkSize: 1000,
			chunkOverlap: 0,
		});

		const splitDocs = await textSplitter.splitDocuments(docs);
		const maxTokens = this.tokenMax;

		// UTILS METHODS.
		async function lengthFunction(documents: Document[]) {
			const tokenCounts = await Promise.all(
				documents.map(async (doc) => {
					return llm.getNumTokens(doc.pageContent);
				}),
			);
			return tokenCounts.reduce((sum, count) => sum + count, 0);
		}

		async function _reduce(input: Document[]) {
			const prompt = await reducePrompt.invoke({
				docs: input,
			});

			const generation = trace.generation({
				name: `${provider}-${model}-generation`,
				model: model,
				input: { messages: prompt },
				modelParameters: {
					temperature: temperature,
				},
			});

			const response = await llm.invoke(prompt);

			generation.end({
				output: response.content,
			});

			return String(
				typeof response.content === 'object'
					? JSON.stringify(response.content)
					: response.content,
			);
		}

		const mapSummaries = (state: typeof OverallState.State) => {
			return state.contents.map(
				(content) => new Send('generateSummary', { content }),
			);
		};

		async function shouldCollapse(state: typeof OverallState.State) {
			const numTokens = await lengthFunction(state.collapsedSummaries);
			if (numTokens > maxTokens) {
				return 'collapseSummaries';
			} else {
				return 'generateFinalSummary';
			}
		}

		// GENERATE SUMMARY.
		const generateSummary = async (
			state: SummaryState,
		): Promise<{ summaries: string[] }> => {
			const generation = trace.generation({
				name: `${provider}-${model}-generation`,
				model: model,
				input: { messages: state.content },
				modelParameters: {
					temperature: temperature,
				},
			});

			const prompt = await mapPrompt.invoke({ context: state.content });
			const response = await llm.invoke(prompt);

			generation.end({
				output: response.content,
			});

			return {
				summaries: [
					typeof response.content === 'object'
						? JSON.stringify(response.content)
						: String(response.content),
				],
			};
		};

		// COLLECT SUMMARIES.
		const collectSummaries = (state: typeof OverallState.State) => {
			return {
				collapsedSummaries: state.summaries.map(
					(summary) => new Document({ pageContent: summary }),
				),
			};
		};

		// COLLAPSE SUMMARIES.
		const collapseSummaries = async (state: typeof OverallState.State) => {
			const docLists = splitListOfDocs(
				state.collapsedSummaries,
				lengthFunction,
				this.tokenMax,
			);
			const results: Document[] = [];
			for (const docList of docLists) {
				results.push(await collapseDocs(docList, _reduce));
			}

			return { collapsedSummaries: results };
		};

		// GENERATE FINAL SUMMARY.
		const generateFinalSummary = async (
			state: typeof OverallState.State,
		) => {
			const response = await _reduce(state.collapsedSummaries);
			return { finalSummary: response };
		};

		// Construct the graph.
		const graph = new StateGraph(OverallState)
			.addNode('generateSummary', generateSummary)
			.addNode('collectSummaries', collectSummaries)
			.addNode('collapseSummaries', collapseSummaries)
			.addNode('generateFinalSummary', generateFinalSummary)
			.addConditionalEdges('__start__', mapSummaries, ['generateSummary'])
			.addEdge('generateSummary', 'collectSummaries')
			.addConditionalEdges('collectSummaries', shouldCollapse, [
				'collapseSummaries',
				'generateFinalSummary',
			])
			.addConditionalEdges('collapseSummaries', shouldCollapse, [
				'collapseSummaries',
				'generateFinalSummary',
			])
			.addEdge('generateFinalSummary', '__end__');

		const app = graph.compile();

		let finalSummary: string | undefined = '';
		for await (const step of await app.stream(
			{ contents: splitDocs.map((doc) => doc.pageContent) },
			{ recursionLimit: 10 },
		)) {
			console.log(Object.keys(step));
			if ('generateFinalSummary' in step) {
				finalSummary = step.generateFinalSummary?.finalSummary;
			}
		}

		await this.langfuse.shutdownAsync();
		return finalSummary;
	}

	async summerizeStuff({ provider, model, temperature }: SummaryStuffDTO) {
		const trace = this.langfuse.trace({
			name: 'ai-poc-stuff-summarization',
			metadata: {
				provider,
				model,
				temperature,
			},
		});

		const loader = new TextLoader('dataset.txt');
		const docs = await loader.load();

		const llm = this.createModelInstance(provider, model, temperature);
		const prompt = PromptTemplate.fromTemplate(
			'Write a detailed summary of the following: \n\n{context}',
		);

		const chain = await createStuffDocumentsChain({
			llm,
			outputParser: new StringOutputParser(),
			prompt,
		});

		const generation = trace.generation({
			name: `${provider}-${model}-generation`,
			model: model,
			input: { messages: prompt },
			modelParameters: {
				temperature: temperature || 0.7,
			},
		});

		// Normal
		const result = await chain.invoke({ context: docs });

		generation.end({
			output: result,
		});

		await this.langfuse.shutdownAsync();

		return { summary: result };
	}
}
