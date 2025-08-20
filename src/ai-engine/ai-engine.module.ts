import { Module } from '@nestjs/common';
import { AiEngineController } from './ai-engine.controller';
import { AiEngineService } from './ai-engine.service';
import { MapReduceService } from './summarization-algorithm/map-reduce.service';
import { StuffService } from './summarization-algorithm/stuff.service';
import { SlackModule } from 'src/slack/slack.module';

@Module({
	imports: [SlackModule],
	controllers: [AiEngineController],
	providers: [AiEngineService, MapReduceService, StuffService],
})
export class AiEngineModule {}
