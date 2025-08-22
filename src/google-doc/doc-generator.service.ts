import { Injectable, Logger } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { GoogleAuthService } from './google-auth.service';
import { BatchUpdateRequest } from './types/index';
import { getTemplateTag, TEMPLATE_CONFIG } from 'src/config';

@Injectable()
export class DocGeneratorService {
	private logger = new Logger(DocGeneratorService.name);

	constructor(private readonly googleAuthService: GoogleAuthService) {}

	async createDocFromTemplate(
		auth: GoogleAuth,
		replacements: Record<string, string | string[]>,
		outputName: string,
	): Promise<string> {
		const drive = this.googleAuthService.getDrive(auth);
		const docs = this.googleAuthService.getDocs(auth);

		this.logger.log('Starting to copy document from template...');

		// Step 1: Copy the template doc
		const { data: copyDoc } = await drive.files.copy({
			fileId: TEMPLATE_CONFIG.TEMPLATE_DOC_ID,
			requestBody: { name: outputName },
		});

		const docId = copyDoc.id;

		this.logger.log(`Document copied successfully: ${docId}`);

		if (!docId) {
			throw new Error(
				'Failed to create document copy - no document ID returned',
			);
		}

		this.logger.log('Moving document to output folder...');

		await drive.files.update({
			fileId: docId,
			addParents: TEMPLATE_CONFIG.OUTPUT_FOLDER_ID,
			removeParents: copyDoc.parents ? copyDoc.parents.join(',') : '',
			fields: 'id, parents',
		});

		const requests: BatchUpdateRequest[] = [];
		for (const [key, value] of Object.entries(replacements)) {
			if (Array.isArray(value)) {
				requests.push({
					replaceAllText: {
						containsText: {
							text: getTemplateTag(key),
							matchCase: true,
						},
						replaceText: value.join('\n'),
					},
				});
			} else {
				requests.push({
					replaceAllText: {
						containsText: {
							text: getTemplateTag(key),
							matchCase: true,
						},
						replaceText: value,
					},
				});
			}
		}

		this.logger.log('Sending batch update request...');

		await docs.documents.batchUpdate({
			documentId: docId,
			requestBody: { requests },
		});

		return `https://docs.google.com/document/d/${docId}/edit`;
	}
}
