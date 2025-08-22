export interface ProjectSummarySchema {
	summary: string;
	riskBlockerActionNeeded: string;
	taskDetails: {
		completed: string;
		inProgress: string;
		inReview: string;
	};
}

export enum ProjectStatus {
	Green = 'Green',
	Amber = 'Amber',
	Red = 'Red',
}

export enum Algorithm {
	MapReduce = 'map-reduce',
	Stuff = 'stuff',
	Auto = 'auto',
}
