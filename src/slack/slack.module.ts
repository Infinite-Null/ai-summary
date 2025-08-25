import { Module } from '@nestjs/common';
import { SlackService } from './slack.service';
import { ConfigModule } from '@nestjs/config';
import { SlackController } from './slack.controller';

@Module({
	imports: [ConfigModule],
	controllers: [SlackController],
	providers: [SlackService],
	exports: [SlackService],
})
export class SlackModule {}
