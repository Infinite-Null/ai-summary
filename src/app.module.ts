import { Module } from '@nestjs/common';
import { AiEngineModule } from './ai-engine/ai-engine.module';

@Module({
	imports: [AiEngineModule],
	controllers: [],
	providers: [],
})
export class AppModule {}
