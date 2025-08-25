import { Injectable, HttpException } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { HttpService } from '@nestjs/axios';
import {
	GithubIssuesResponse,
	Issue,
	GitHubSearchIssueResponse,
} from './types/output';
import {
	getFetchIssueQuery,
	getFetchIssueQueryWitDateRange,
} from './queries/graphql';

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

	private formatToYYMMDD(isoString: string): string {
		const date = new Date(isoString);

		const yy = String(date.getUTCFullYear()).slice();
		const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
		const dd = String(date.getUTCDate()).padStart(2, '0');

		return `${yy}-${mm}-${dd}`;
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

	async fetchIssuesWithDateRange(
		owner: string,
		repo: string,
		fromdate: string,
		todate: string,
		projectboard: string,
	): Promise<Issue[]> {
		const nonBlockedIssueGQLQuery = getFetchIssueQueryWitDateRange(true);
		const nonBlockedIssueSearchQuery = `repo:${owner}/${repo} is:issue updated:${this.formatToYYMMDD(fromdate)}..${this.formatToYYMMDD(todate)}`;

		let issues: Issue[] = [];
		let nonBlockedIssueAfterPointer: string | null = null;

		while (true) {
			const response = await this.client.post(
				this.GITHUB_API_GQL_ENDPOINT ?? '',
				{
					query: nonBlockedIssueGQLQuery,
					variables: {
						searchQuery: nonBlockedIssueSearchQuery,
						after: nonBlockedIssueAfterPointer,
					},
				},
				{ headers: { Authorization: `Bearer ${this.GITHUB_TOKEN}` } },
			);

			const data = response.data as GitHubSearchIssueResponse;

			if (data.errors) {
				throw new HttpException(data.errors, 500);
			}

			const searchData = data?.data?.search;

			if (!searchData) break;

			issues = issues.concat(searchData.nodes);
			const pageInfo = searchData.pageInfo;
			if (!pageInfo.hasNextPage) break;

			nonBlockedIssueAfterPointer = pageInfo.endCursor;
		}

		const processedIssues = issues
			.map((item) => {
				const projectItems = item.projectItems.items
					.filter((e) => e.project?.title === projectboard) // Filter issues by project board name.
					.map((e) => ({
						...e,
						fieldValues: e.fieldValues
							? {
									...e.fieldValues,
									items: e.fieldValues.items.filter(
										(f) => 'name' in f, // Type guard to ensure 'name' exists to exclude any empty objects.
									),
								}
							: e.fieldValues,
					}))
					.filter((e) => e.fieldValues.items.length > 0); // Exclude issues which aren't assigned to any columns.
				const isBlocked = projectItems.some((item) =>
					item.fieldValues.items.some(
						(status) => status.name === 'Blocked',
					),
				);

				const { comments, ...rest } = item;

				return {
					...rest,
					projectItems: { ...item.projectItems, items: projectItems },
					...(isBlocked ? { comments: comments } : {}), // Include comments property only for blocked issues.
				};
			})
			.filter((item) => item.projectItems.items.length > 0); // Exclude issues which aren't assigned to any projects.

		return processedIssues;
	}
}
