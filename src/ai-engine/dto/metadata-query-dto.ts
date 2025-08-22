import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export class MetadataQueryDTO {
	@IsOptional()
	@ApiProperty({
		description: 'The start date for fetching messages (ISO format).',
		default: '2025-08-18T01:30:04.549Z',
		example: '2025-08-18T01:30:04.549Z',
	})
	startDate: string;

	@IsOptional()
	@ApiProperty({
		description: 'The end date for fetching messages (ISO format).',
		default: '2025-08-18T17:30:04.549Z',
		example: '2025-08-18T17:30:04.549Z',
	})
	endDate: string;

	@IsOptional()
	@ApiProperty({
		description: 'The name of the document to summarize.',
		default: 'Merge Tags Replacement - New',
		example: 'Merge Tags Replacement - New',
	})
	docName: string;

	@IsOptional()
	@IsEnum(['Green', 'Amber', 'Red'])
	@ApiProperty({
		description: 'The project status.',
		default: 'Green',
		enum: ['Green', 'Amber', 'Red'],
		example: 'Green',
	})
	projectStatus: 'Green' | 'Amber' | 'Red';

	@IsOptional()
	@ApiProperty({
		description: 'The name of the project to summarize.',
		default: 'AI Internal',
		example: 'AI Internal',
	})
	projectName: string;
}
