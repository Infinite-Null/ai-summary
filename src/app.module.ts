import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiEngineModule } from './ai-engine/ai-engine.module';
import { AppController } from './app.controller';
import { GithubModule } from './github/github.module';
import { SlackModule } from './slack/slack.module';

@Module({
	imports: [
		ConfigModule.forRoot(),
		AiEngineModule,
		GithubModule,
		SlackModule,
	],
	controllers: [AppController],
	providers: [],
})
export class AppModule {}
