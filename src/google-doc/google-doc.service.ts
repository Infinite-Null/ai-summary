import {
	Injectable,
	BadRequestException,
	InternalServerErrorException,
} from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { DocGeneratorService } from './doc-generator.service';
import { GenerateDocRequest, GenerateDocResponse } from './types/index';
import { TEMPLATE_CONFIG } from 'src/config';

@Injectable()
export class GoogleDocService {
	constructor(
		private readonly googleAuthService: GoogleAuthService,
		private readonly docGeneratorService: DocGeneratorService,
	) {}

	async generateDocument(
		requestData: GenerateDocRequest,
	): Promise<GenerateDocResponse> {
		try {
			const auth = await this.googleAuthService.authorize();
			const { replacements, docName } = requestData;

			if (!replacements || typeof replacements !== 'object') {
				throw new BadRequestException(
					'Missing or invalid replacements object in body',
				);
			}

			const outputName = docName || TEMPLATE_CONFIG.DEFAULT_DOC_NAME;
			const url = await this.docGeneratorService.createDocFromTemplate(
				auth,
				replacements,
				outputName,
			);

			return { documentUrl: url };
		} catch (err) {
			if (err instanceof BadRequestException) {
				throw err;
			}
			const errorMessage =
				err instanceof Error
					? err.message
					: 'An unexpected error occurred';
			throw new InternalServerErrorException(errorMessage);
		}
	}
}
