import { Injectable } from '@nestjs/common';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Document } from 'langchain/document';

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
	): Promise<{ summary: string }> {
		const chain = await createStuffDocumentsChain({
			llm,
			outputParser: new StringOutputParser(),
			prompt,
		});

		const result = await chain.invoke({ context: docs });
		return { summary: result };
	}
}
