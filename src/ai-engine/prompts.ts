export const QUICK_ASK_SYSTEM_PROMPT = `You are a helpful AI assistant. Your task is to answer user queries based on the provided model and provider.`;

export const FORMAT = `
{{
    "summary": "A comprehensive narrative summary of the project's current state, key accomplishments, and overall progress. This should be 34 paragraphs providing a complete overview of where the project stands, what has been achieved, and what is currently happening. Include specific details about deliverables, milestones, and current focus areas.\\n\\nUse proper paragraph breaks between sections for readability.",
    "riskBlockerActionNeeded": "Detailed description of any risks, blockers, or critical actions that need immediate attention. If there are no explicit blockers mentioned, state 'No explicit blockers reported.' Include specific action items, dependencies, and any issues that could impact project timeline or success.\\n\\nUse line breaks between different risk categories or action items.",
    "taskDetails": {{
        "completed": "Format as: Main Issue Title: Brief description of the completed work.\\n\\t Specific action item completed\\n\\t Another specific action item completed\\n\\t Additional completed task details\\n\\nRepeat this format for each major completed area. Include PR numbers, issue references, and specific achievements.\\n\\nExample format:\\nFeature Development: Core functionality implementation\\n\\t API endpoints created and tested\\n\\t Database schema updated\\n\\t Unit tests added",
        "inProgress": "Format as: Main Issue Title: Brief description of ongoing work.\\n\\t Current task being worked on\\n\\t Another ongoing task\\n\\t Status of current work\\n\\nRepeat this format for each major inprogress area. Include current status, next steps, and any dependencies.\\n\\nExample format:\\nUI Development: User interface improvements\\n\\t Dashboard components in development\\n\\t User authentication flow being refined\\n\\t Responsive design adjustments ongoing",
        "inReview": "Format as: Main Issue Title: Brief description of work under review.\\n\\t Pull request or deliverable under review\\n\\t Code review or approval process\\n\\t Documentation or design review status\\n\\nRepeat this format for each major review area. Include PR numbers, reviewer information, and review status when available. If there are no explicit in review, state 'Nothing is in review.'\\n\\nExample format:\\nCode Review: Backend improvements under review\\n\\t PR #123 awaiting senior developer review\\n\\t Security audit documentation pending approval\\n\\t Performance optimization changes being tested"
    }}
}}
`;

export const CONTENT_GUIDELINES = `
- Summary: Should read like a professional project status report narrative with proper paragraph breaks using \\n\\n
- Risk/Blockers: Focus on actionable items that need attention or resolution, separated by line breaks \\n
- Completed Tasks: Group related completed work under descriptive main titles with tabbed bullet points using \\n\\t
- In-Progress Tasks: Group ongoing work under descriptive main titles with tabbed bullet points using \\n\\t
- In-Review Tasks: Group work under review under descriptive main titles with tabbed bullet points using \\n\\t
`;

export const FORMATTING_RULES = `
- Use only double quotes for JSON keys and string values
- Escape any double quotes within string values using backslash
- Use \\n for new lines and \\t for tabs in formatted content
- For nested bullet points, use \\n\\t\\t for sub-items under main bullet points
- Keep descriptions clear and professional
- Include specific details like PR numbers, dates, and technical specifics when mentioned
- Use bullet points for individual task items within each main category, properly tabbed with \\t
- Each main issue title should be followed by a colon and brief description
- Maintain professional tone throughout
- Separate different sections and categories with proper line breaks (\\n\\n)
`;

export const CRITICAL_INSTRUCTIONS = `
1. ONLY include information explicitly mentioned in the context
2. Create a comprehensive narrative summary of the project progress
3. Categorize tasks into completed and in-progress with detailed descriptions
4. Identify risks, blockers, and actions needed based on the provided data
5. Format task details with main issue titles followed by bullet points of specific actions
`;
