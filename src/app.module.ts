import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiEngineModule } from './ai-engine/ai-engine.module';
import { AppController } from './app.controller';
import { SlackModule } from './slack/slack.module';

@Module({
	imports: [ConfigModule.forRoot(), AiEngineModule, SlackModule],
	controllers: [AppController],
	providers: [],
})
export class AppModule {}
