import { Injectable, HttpException } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { HttpService } from '@nestjs/axios';

const GITHUB_API_GQL_ENDPOINT = process.env.GITHUB_API_GQL_ENDPOINT;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

@Injectable()
export class GithubService {
	private readonly client: AxiosInstance;
	private loadQuery(fileName: string): string {
		return fs.readFileSync(
			path.join(__dirname, 'queries', fileName),
			'utf8',
		);
	}

	constructor(private readonly httpService: HttpService) {
		if (!GITHUB_TOKEN && !GITHUB_API_GQL_ENDPOINT) {
			throw new HttpException('Environment variable is not set.', 500);
		}
	}

	async fetchIssues(owner: string, repo: string, since: Date) {
		const query = this.loadQuery('issues.graphql');

		let issues: any[] = [];
		let after: string | null = null;
		const variables = { owner, repo, since, after: null };

		while (true) {
			const response = await this.httpService.axiosRef.post(
				GITHUB_API_GQL_ENDPOINT ?? '',
				{ query, variables },
				{ headers: { Authorization: `Bearer ${GITHUB_TOKEN}` } },
			);

			const data = response.data;
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
