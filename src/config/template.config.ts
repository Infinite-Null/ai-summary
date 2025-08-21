import dotenv from 'dotenv';

dotenv.config();

export const TEMPLATE_CONFIG = {
	TEMPLATE_DOC_ID: process.env.TEMPLATE_DOC_ID || '',
	OUTPUT_FOLDER_ID: process.env.OUTPUT_FOLDER_ID || '',
	TAG_PREFIX: 'rtai-',
	TAG_SUFFIX: '-rtai',
	DEFAULT_DOC_NAME: 'Generated Document',
} as const;

export const getTemplateTag = (key: string): string => {
	return `{{{${TEMPLATE_CONFIG.TAG_PREFIX}${key}${TEMPLATE_CONFIG.TAG_SUFFIX}}}}`;
};
