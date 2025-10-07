/**
 * Parse features string into array
 */
export function parseFeatures(featuresStr: string): string[] {
	return featuresStr
		.trim()
		.split(/\s+/)
		.filter((f) => f.length > 0);
}

/**
 * Populate variables from input line and features
 * Returns a record containing seed and parsed feature values
 */
export function populateVariables(
	seed: number,
	features: string[],
	line: string,
): Record<string, number> {
	const variables: Record<string, number> = { seed };

	const values = line
		.trim()
		.split(/\s+/)
		.filter((v) => v.length > 0);

	for (let i = 0; i < features.length; i++) {
		if (i < values.length) {
			const num = parseFloat(values[i]);
			variables[features[i]] = isNaN(num) ? 0 : num;
		} else {
			variables[features[i]] = 0;
		}
	}

	return variables;
}
