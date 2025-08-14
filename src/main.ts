import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	const config = new DocumentBuilder()
		.setTitle('AI Summary API')
		.setDescription('The AI Summary API description')
		.setVersion('1.0')
		.build();

	const documentFactory = () => SwaggerModule.createDocument(app, config);

	/**
	 * Setup Swagger UI for the application.
	 * Visible at `/api` endpoint.
	 *
	 * @see https://docs.nestjs.com/openapi/introduction#bootstrap
	 */
	SwaggerModule.setup('api', app, documentFactory);

	/**
	 * Enable versioning for the application.
	 *
	 * @see https://docs.nestjs.com/techniques/versioning#uri-versioning-type
	 */
	app.enableVersioning({ type: VersioningType.URI });

	await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((err) => {
	console.error('Error starting the application:', err);
	process.exit(1);
});
