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
	getStatusV2(
		@Query('owner') owner: string,
		@Query('repo') repo: string,
		@Query('fromdate') fromdate: string,
		@Query('todate') todate: string,
		@Query('projectboard') projectboard: string,
	) {
		return this.githubService.fetchIssuesWithDateRange(
			owner,
			repo,
			fromdate,
			todate,
			projectboard,
		);
	}
}
