export const getFetchIssueQuery = (body: boolean, comment: boolean) => {
	return `
	query ($owner: String!, $repo: String!, $since: DateTime!, $after: String) {
	repository(owner: $owner, name: $repo) {
		issues(
			first: 100
			after: $after
			orderBy: { field: UPDATED_AT, direction: ASC }
			filterBy: { since: $since }
			states: [OPEN, CLOSED]
		) {
			pageInfo {
				hasNextPage
				endCursor
			}
			nodes {
				issue_id: number
				title
				state
				${body ? 'body' : ''}
				url
				updatedAt
				closedAt
				labels(first: 50) {
					nodes {
						name
					}
				}
				milestone {
					title
					dueOn
					state
				}
				crossReferencedPRs: timelineItems(
					first: 100
					itemTypes: [CROSS_REFERENCED_EVENT]
				) {
					nodes {
						... on CrossReferencedEvent {
							source {
								... on PullRequest {
									pr_id: number
									title
									url
								}
							}
						}
					}
				}
				projectItems(first: 10) {
					nodes {
						id
						project {
							title
							number
						}
						fieldValues(first: 20) {
							nodes {
								__typename

								# Single-select fields (e.g. Status, Priority, etc.)
								... on ProjectV2ItemFieldSingleSelectValue {
									name
									field {
										... on ProjectV2SingleSelectField {
											name
										}
									}
								}
							}
						}
					}
				}
				${
					comment
						? `comments(first: 100) {
					pageInfo {
						hasNextPage
						endCursor
					}
					nodes {
						author {
							login
						}
						body
						createdAt
						updatedAt
						url
					}
				}`
						: ''
				}
			}
		}
	}
}
	`;
};
