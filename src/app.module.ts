import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiEngineModule } from './ai-engine/ai-engine.module';
import { AppController } from './app.controller';
import { GithubModule } from './github/github.module';
import { SlackModule } from './slack/slack.module';
import { GoogleDocModule } from './google-doc/google-doc.module';
import { ModelFactoryModule } from './model-factory/model-factory.module';

@Module({
	imports: [
		ConfigModule.forRoot(),
		AiEngineModule,
		GithubModule,
		SlackModule,
		GoogleDocModule,
		ModelFactoryModule,
	],
	controllers: [AppController],
	providers: [],
})
export class AppModule {}
