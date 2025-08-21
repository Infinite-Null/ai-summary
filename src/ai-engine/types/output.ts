export interface ProjectSummarySchema {
	summary: string;
	riskBlockerActionNeeded: string;
	taskDetails: {
		completed: string;
		inProgress: string;
		inReview: string;
	};
}
