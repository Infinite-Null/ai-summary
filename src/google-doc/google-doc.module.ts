import { Module } from '@nestjs/common';
import { GoogleDocController } from './google-doc.controller';
import { GoogleDocService } from './google-doc.service';
import { GoogleAuthService } from './google-auth.service';
import { DocGeneratorService } from './doc-generator.service';

@Module({
	controllers: [GoogleDocController],
	providers: [GoogleDocService, GoogleAuthService, DocGeneratorService],
	exports: [GoogleDocService],
})
export class GoogleDocModule {}
