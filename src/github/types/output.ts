export interface GithubIssuesResponse {
	data: {
		repository: {
			issues: {
				nodes: any[];
				pageInfo: {
					hasNextPage: boolean;
					endCursor: string | null;
				};
			};
		} | null;
	};
	errors?: any;
}

export interface Issue {
	issue_id: number;
	title: string;
	state: 'OPEN' | 'CLOSED'; // enum-like restriction
	url: string;
	updatedAt: string; // ISO date string
	closedAt: string | null; // nullable ISO date
	labels: {
		nodes: Label[];
	};
	milestone: Milestone | null;
	crossReferencedPRs: {
		nodes: CrossReferencedPR[];
	};
	projectItems: {
		nodes: ProjectItem[];
	};
}

export interface Label {
	id?: string;
	name?: string;
	color?: string;
}

export interface Milestone {
	id: string;
	title: string;
	dueOn?: string | null;
}

export interface CrossReferencedPR {
	id?: string;
	title?: string;
	url?: string;
	state?: 'OPEN' | 'CLOSED' | 'MERGED';
}

export interface ProjectItem {
	id: string;
	project: {
		title: string;
		number: number;
	};
	fieldValues: {
		nodes: ProjectFieldValue[];
	};
}

export type ProjectFieldValue =
	| {
			__typename: 'ProjectV2ItemFieldRepositoryValue';
	  }
	| {
			__typename: 'ProjectV2ItemFieldTextValue';
	  }
	| {
			__typename: 'ProjectV2ItemFieldSingleSelectValue';
			name: string;
			field: {
				name: string;
			};
	  };
