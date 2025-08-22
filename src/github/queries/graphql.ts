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

export const getFetchIssueQueryWitDateRange = (comments: boolean = false) => {
	return `
	query ($searchQuery: String!, $after: String) {
  search(query: $searchQuery, type: ISSUE, first: 100, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      ... on Issue {
        number
        title
        state
        url
        updatedAt
        repository {
          owner {
            login
          }
          name
        }
        labels(first: 50) {
          items: nodes {
            name
          }
        }
		  crossReferencedPRs: timelineItems(
					first: 100
					itemTypes: [CROSS_REFERENCED_EVENT]
				) {
					items: nodes {
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
					items: nodes {
						id
						project {
							title
							number
						}
						fieldValues(first: 20) {
							items: nodes {
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
				comments
					? `comments(first: 100) {
					pageInfo {
						hasNextPage
						endCursor
					}
					items: nodes {
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
}`;
};
