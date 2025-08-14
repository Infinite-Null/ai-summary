import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
	@Get('health')
	/**
	 * Health check endpoint to verify if the AI Engine API is running.
	 *
	 * @returns {Object} An object containing a health message.
	 */
	healthCheck(): { message: string } {
		return {
			message: 'API is healthy!',
		};
	}
}
