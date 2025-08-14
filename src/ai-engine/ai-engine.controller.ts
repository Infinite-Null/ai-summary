import { Controller } from '@nestjs/common';
import { AiEngineService } from './ai-engine.service';

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
@Controller({
	version: '1',
	path: 'ai-engine',
})
export class AiEngineController {
	constructor(private readonly aiEngineService: AiEngineService) {}
}
