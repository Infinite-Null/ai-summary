import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiEngineModule } from './ai-engine/ai-engine.module';
import { AppController } from './app.controller';

@Module({
	imports: [ConfigModule.forRoot(), AiEngineModule],
	controllers: [AppController],
	providers: [],
})
export class AppModule {}
