export function formatToYYMMDD(isoString: string): string {
	const date = new Date(isoString);

	const yy = String(date.getUTCFullYear()).slice();
	const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(date.getUTCDate()).padStart(2, '0');

	return `${yy}-${mm}-${dd}`;
}
