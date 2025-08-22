## Google Doc Integration

This service retrieves JSON response summaries from AI models and creates new Google Docs by copying a standard template, replacing merge tags with the summary content, and generating project reports without manual effort to gather summaries from Slack and GitHub.

## Setup Requirements

### OAuth Client 2.0

1. Create a Google Cloud project.
2. Enable the Google Docs and Google Drive APIs to communicate with Docs and Drive respectively.
3. Create OAuth 2.0 credentials for the desktop app and save the JSON file when prompted.
4. Add this file to `/src/config/credentials/credentials.json`.
5. Create a file called `token.json` at `src/config/tokens/token.json`. This file is required when the user authenticates via client ID and saves tokens for quick authentication.
6. Need to add the required scopes that are needed to work with drive and docs such as, https://www.googleapis.com/auth/drive and https://www.googleapis.com/auth/documents.

### Google Docs Template and Folder ID

1. In `.env.example`, you will see two keys: `TEMPLATE_DOC_ID` and `OUTPUT_FOLDER_ID`. These are used to get document content that needs to be copied and specify where the new document should be added in the drive.
2. `TEMPLATE_DOC_ID` is the ID of the template Google Doc from which you need to create a new document with copied content.
3. `OUTPUT_FOLDER_ID` is the ID of the Google Drive folder where the newly created document should be moved and placed.

## Running the Integration

1. When you run `npm run start:dev`, the app starts and runs on the provided port.
2. Once you hit the API to summarize data from GitHub and Slack, and the AI model summarizes the data, it transfers the response to the Google Doc service.
3. When this service starts, it first goes through authorization and checks if tokens are present. If not, it prompts the user to visit a URL to authorize and enter the token back, which saves to the `tokens.json` file.
4. Next time, if tokens are already present, it checks if the tokens are expired or can be used. It then directly runs, copies the template, replaces the merge tags with the summary, creates a Google Doc, and moves it to the specified folder.