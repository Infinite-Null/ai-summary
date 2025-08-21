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
		@Query('since') since: Date,
		@Query('body') body: boolean,
		@Query('comment') comment: boolean,
	) {
		return this.githubService.fetchIssues(
			owner,
			repo,
			since,
			body,
			comment,
		);
	}

	@Get('V2/issues')
	getStatusV2(
		@Query('owner') owner: string,
		@Query('repo') repo: string,
		@Query('fromdate') fromdate: string,
		@Query('todate') todate: string,
	) {
		return this.githubService.fetchIssuesWithDateRange(
			owner,
			repo,
			fromdate,
			todate,
		);
	}
}
