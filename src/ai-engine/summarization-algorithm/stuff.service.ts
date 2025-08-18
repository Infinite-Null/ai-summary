import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { Injectable } from '@nestjs/common';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { Document } from 'langchain/document';
import { ProjectSummarySchema } from '../types/output';

@Injectable()
export class StuffService {
	/**
	 * Summarizes documents using a "stuff" approach.
	 *
	 * @param llm - The language model to use for summarization.
	 * @param prompt - The prompt template to use for the summarization.
	 * @param docs - The documents to summarize.
	 * @returns A promise that resolves to an object containing the summary.
	 */
	async summarize(
		llm: BaseChatModel,
		prompt: PromptTemplate,
		docs: Document[],
	): Promise<ProjectSummarySchema> {
		const jsonOutputParser = new JsonOutputParser<ProjectSummarySchema>();

		const chain = await createStuffDocumentsChain({
			llm,
			outputParser: jsonOutputParser,
			prompt,
		});

		const result = await chain.invoke({
			context: docs,
			format_instructions: jsonOutputParser.getFormatInstructions(),
		});

		return result;
	}
}
