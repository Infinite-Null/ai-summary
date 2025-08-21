import * as path from 'path';

export const GOOGLE_CONFIG = {
	SCOPES: [
		'https://www.googleapis.com/auth/drive',
		'https://www.googleapis.com/auth/documents',
	],
	TOKEN_PATH: path.join(process.cwd(), 'src/config/tokens/token.json'),
	CREDENTIALS_PATH: path.join(
		process.cwd(),
		'src/config/credentials/credentials.json',
	),
	API_VERSIONS: {
		DRIVE: 'v3',
		DOCS: 'v1',
	},
	AUTH: {
		ACCESS_TYPE: 'offline',
		PROMPT: 'consent',
	},
} as const;
