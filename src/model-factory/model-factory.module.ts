import { Module } from '@nestjs/common';
import { ModelFactoryService } from './model-factory.service';

@Module({
	providers: [ModelFactoryService],
	exports: [ModelFactoryService],
})
export class ModelFactoryModule {}
