import { Module } from '@nestjs/common';
import { AiEngineController } from './ai-engine.controller';
import { AiEngineService } from './ai-engine.service';
import { MapReduceService } from './summarization-algorithm/map-reduce.service';
import { StuffService } from './summarization-algorithm/stuff.service';
import { SlackModule } from 'src/slack/slack.module';
import { GithubModule } from 'src/github/github.module';

@Module({
	imports: [SlackModule, GithubModule],
	controllers: [AiEngineController],
	providers: [AiEngineService, MapReduceService, StuffService],
})
export class AiEngineModule {}
