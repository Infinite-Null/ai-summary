import { Module } from '@nestjs/common';
import { SlackService } from './slack.service';
import { ConfigModule } from '@nestjs/config';
import { SlackTestController } from './slack-test.controller';

@Module({
	imports: [ConfigModule],
	controllers: [SlackTestController], // Temporary controller for testing
	providers: [SlackService],
	exports: [SlackService],
})
export class SlackModule {}
