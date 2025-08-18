export interface ProjectSummarySchema {
	projectName: string;
	from: string;
	to: string;
	projectStatus: 'Green' | 'Amber' | 'Red';
	riskBlockersActionsNeeded: string;
	taskDetails: {
		completed: string;
		inProgress: string;
		inReview: string;
	};
}
