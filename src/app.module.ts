import { Module } from '@nestjs/common';
import { AiEngineModule } from './ai-engine/ai-engine.module';
import { AppController } from './app.controller';

@Module({
	imports: [AiEngineModule],
	controllers: [AppController],
	providers: [],
})
export class AppModule {}
