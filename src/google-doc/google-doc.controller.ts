import { Controller, Post, Body } from '@nestjs/common';
import { GoogleDocService } from './google-doc.service';
import type { GenerateDocRequest, GenerateDocResponse } from './types/index';

@Controller('google-doc')
export class GoogleDocController {
	constructor(private readonly googleDocService: GoogleDocService) {}

	@Post('generate-doc')
	async generateDoc(
		@Body() body: GenerateDocRequest,
	): Promise<GenerateDocResponse> {
		return this.googleDocService.generateDocument(body);
	}
}
