import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AiEngineService } from './ai-engine.service';
import { SummarizeDTO } from './dto/summarize-dto';

/**
 * Controller responsible for handling AI Engine endpoints.
 *
 * This controller exposes REST endpoints for AI-related features,
 * such as processing requests, running inferences, summarization,
 * and returning AI-generated responses.
 *
 * @version 1.0
 * @routePrefix ai-engine
 * @controller AiEngineController
 */
@ApiTags('AI Engine')
@Controller({
	version: '1',
	path: 'ai-engine',
})
export class AiEngineController {
	constructor(private readonly aiEngineService: AiEngineService) {}

	@Post('/summarize')
	summarize(@Body(new ValidationPipe()) summarizeDto: SummarizeDTO) {
		return this.aiEngineService.summarize(summarizeDto);
	}
}
