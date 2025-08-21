import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as readline from 'readline';
import { GoogleCredentials, GoogleTokens } from './types/index';
import { GOOGLE_CONFIG } from '../config';

@Injectable()
export class GoogleAuthService {
	private logger = new Logger(GoogleAuthService.name);

	async authorize(): Promise<any> {
		const credentials: GoogleCredentials = JSON.parse(
			fs.readFileSync(GOOGLE_CONFIG.CREDENTIALS_PATH, 'utf8'),
		) as GoogleCredentials;
		const { client_secret, client_id, redirect_uris } =
			credentials.installed || credentials.web || {};
		const oAuth2Client = new google.auth.OAuth2(
			client_id,
			client_secret,
			redirect_uris?.[0],
		);

		try {
			const token: GoogleTokens = JSON.parse(
				fs.readFileSync(GOOGLE_CONFIG.TOKEN_PATH, 'utf8'),
			) as GoogleTokens;
			oAuth2Client.setCredentials(token);
		} catch {
			await this.getNewToken(oAuth2Client);
		}

		oAuth2Client.on('tokens', (tokens) => {
			if (tokens.refresh_token || tokens.access_token) {
				fs.writeFileSync(
					GOOGLE_CONFIG.TOKEN_PATH,
					JSON.stringify(oAuth2Client.credentials, null, 2),
				);
				this.logger.log(
					'Tokens updated and saved to ' + GOOGLE_CONFIG.TOKEN_PATH,
				);
			}
		});

		return oAuth2Client;
	}
	private getNewToken(oAuth2Client: OAuth2Client): Promise<void> {
		return new Promise((resolve, reject) => {
			const authUrl = oAuth2Client.generateAuthUrl({
				access_type: GOOGLE_CONFIG.AUTH.ACCESS_TYPE,
				scope: [...GOOGLE_CONFIG.SCOPES],
				prompt: GOOGLE_CONFIG.AUTH.PROMPT,
			});

			this.logger.log(
				'Authorize this app by visiting this URL:\n' + authUrl,
			);

			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			});

			rl.question(
				'Enter the authorization code from that page here: ',
				(code) => {
					rl.close();
					oAuth2Client
						.getToken(code.trim())
						.then(({ tokens }) => {
							oAuth2Client.setCredentials(tokens);
							fs.writeFileSync(
								GOOGLE_CONFIG.TOKEN_PATH,
								JSON.stringify(tokens, null, 2),
							);
							this.logger.log(
								'Token saved to ' + GOOGLE_CONFIG.TOKEN_PATH,
							);
							resolve();
						})
						.catch((err) => {
							this.logger.error(
								'Error retrieving access token',
								err,
							);
							reject(
								err instanceof Error
									? err
									: new Error(String(err)),
							);
						});
				},
			);
		});
	}

	getDrive(auth: GoogleAuth) {
		return google.drive({
			version: GOOGLE_CONFIG.API_VERSIONS.DRIVE,
			auth,
		});
	}

	getDocs(auth: GoogleAuth) {
		return google.docs({ version: GOOGLE_CONFIG.API_VERSIONS.DOCS, auth });
	}
}
