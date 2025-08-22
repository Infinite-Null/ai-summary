import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ProjectStatus } from '../types';

export class MetadataQueryDTO {
	@IsOptional()
	@IsDateString()
	@ApiProperty({
		description: 'The start date for fetching messages (ISO format).',
		default: '2025-08-18T01:30:04.549Z',
		example: '2025-08-18T01:30:04.549Z',
	})
	startDate: string;

	@IsOptional()
	@IsDateString()
	@ApiProperty({
		description: 'The end date for fetching messages (ISO format).',
		default: '2025-08-18T17:30:04.549Z',
		example: '2025-08-18T17:30:04.549Z',
	})
	endDate: string;

	@IsOptional()
	@IsString()
	@ApiProperty({
		description: 'The name of the document to summarize.',
		default: 'Merge Tags Replacement - New',
		example: 'Merge Tags Replacement - New',
	})
	docName: string;

	@IsOptional()
	@IsEnum(ProjectStatus)
	@ApiProperty({
		description: 'The project status.',
		default: ProjectStatus.Green,
		enum: ProjectStatus,
		example: ProjectStatus.Green,
	})
	projectStatus: ProjectStatus;

	@IsOptional()
	@IsString()
	@ApiProperty({
		description: 'The name of the project to summarize.',
		default: 'AI Internal',
		example: 'AI Internal',
	})
	projectName: string;
}
