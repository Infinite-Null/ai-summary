import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { AiEngineService } from './ai-engine.service';
import { QuickAskDTO } from './dto/quick-ask.dto';
import { ApiTags } from '@nestjs/swagger';

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

	@Post('/quick-ask')
	quickAsk(@Body(new ValidationPipe()) quickAskDto: QuickAskDTO) {
		return this.aiEngineService.quickAsk(quickAskDto);
	}

	@Post('/summarize')
	summarize() {
		return this.aiEngineService.mapReduceSummarization();
	}
}
