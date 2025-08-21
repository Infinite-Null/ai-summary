export interface GenerateDocRequest {
	replacements: Record<string, string | string[]>;
	docName?: string;
}

export interface GenerateDocResponse {
	url: string;
}

export interface GoogleCredentials {
	installed?: {
		client_secret: string;
		client_id: string;
		redirect_uris: string[];
	};
	web?: {
		client_secret: string;
		client_id: string;
		redirect_uris: string[];
	};
}

export interface GoogleTokens {
	access_token?: string;
	refresh_token?: string;
	scope?: string;
	token_type?: string;
	expiry_date?: number;
}

export interface DocumentReplacement {
	key: string;
	value: string | string[];
}

export interface BatchUpdateRequest {
	replaceAllText: {
		containsText: {
			text: string;
			matchCase: boolean;
		};
		replaceText: string;
	};
}

export interface DriveFileResponse {
	id: string;
	name?: string;
	parents?: string[];
}

export interface DocumentCreateOptions {
	templateId: string;
	outputName: string;
	outputFolderId?: string;
	replacements: Record<string, string | string[]>;
}
