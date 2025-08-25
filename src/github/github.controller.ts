import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GithubService } from './github.service';

@ApiTags('GitHub')
@Controller({
	version: '1',
	path: 'github',
})
export class GithubController {
	constructor(private readonly githubService: GithubService) {}

	@Get('/issues')
	getStatus(
		@Query('owner') owner: string,
		@Query('repo') repo: string,
		@Query('fromDate') fromDate: string,
		@Query('toDate') toDate: string,
		@Query('projectBoard') projectBoard: string,
	) {
		return this.githubService.fetchIssues(
			owner,
			repo,
			fromDate,
			toDate,
			projectBoard,
		);
	}
}
