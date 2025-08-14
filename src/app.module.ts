import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiEngineModule } from './ai-engine/ai-engine.module';

@Module({
	imports: [AiEngineModule],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
