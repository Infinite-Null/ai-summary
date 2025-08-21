import { Injectable, HttpException } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { HttpService } from '@nestjs/axios';
import { GithubIssuesResponse, Issue } from './types/output';
import { getFetchIssueQuery } from './queries/graphql';

@Injectable()
export class GithubService {
	private readonly GITHUB_API_GQL_ENDPOINT =
		process.env.GITHUB_API_GQL_ENDPOINT;
	private readonly GITHUB_TOKEN = process.env.GITHUB_TOKEN;

	private readonly client: AxiosInstance;

	constructor(private readonly httpService: HttpService) {
		if (!this.GITHUB_TOKEN && !this.GITHUB_API_GQL_ENDPOINT) {
			throw new HttpException('Environment variable is not set.', 500);
		}
		this.client = this.httpService.axiosRef;
	}

	async fetchIssues(
		owner: string,
		repo: string,
		since: Date,
		body: boolean = false,
		comment: boolean = false,
	): Promise<Issue[]> {
		const query = getFetchIssueQuery(body, comment);

		let issues: Issue[] = [];
		let after: string | null = null;

		while (true) {
			const response = await this.client.post(
				this.GITHUB_API_GQL_ENDPOINT ?? '',
				{
					query,
					variables: { owner, repo, since, after },
				},
				{ headers: { Authorization: `Bearer ${this.GITHUB_TOKEN}` } },
			);

			const data = response.data as GithubIssuesResponse;
			if (data.errors) {
				throw new HttpException(data.errors, 500);
			}

			const repoData = data.data.repository;
			if (!repoData) break;

			issues = issues.concat(repoData.issues.nodes);

			const pageInfo = repoData.issues.pageInfo;
			if (!pageInfo.hasNextPage) break;

			after = pageInfo.endCursor;
		}

		return issues;
	}
}
