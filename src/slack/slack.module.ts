import { Module } from '@nestjs/common';
import { SlackService } from './slack.service';
import { ConfigModule } from '@nestjs/config';
import { SlackTestController } from './slack.controller';

@Module({
	imports: [ConfigModule],
	controllers: [SlackTestController],
	providers: [SlackService],
	exports: [SlackService],
})
export class SlackModule {}
