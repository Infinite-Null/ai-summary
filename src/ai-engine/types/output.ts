export interface ProjectSummarySchema {
	summary: string;
	risk_Blocker_Action_Needed: string;
	task_details: {
		completed: string;
		inProgress: string;
	};
}
