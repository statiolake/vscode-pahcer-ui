/**
 * Parse stderr output to extract variables in the format: $varname = value
 * Checks first 100 lines and last 100 lines
 * If same variable appears multiple times, the last one wins
 */
export function parseStderrVariables(stderr: string): Record<string, number> {
	const variables: Record<string, number> = {};
	const lines = stderr.split('\n');

	// Pattern: $varname = value
	// Captures: $varname and value
	const pattern = /\$([a-zA-Z_][a-zA-Z_0-9]*)\s*=\s*(-?\d+(?:\.\d+)?)/;

	// Process first 100 lines
	const firstLines = lines.slice(0, 100);
	for (const line of firstLines) {
		const match = line.match(pattern);
		if (match) {
			const varName = match[1]; // Without $
			const value = parseFloat(match[2]);
			if (!isNaN(value)) {
				variables[varName] = value;
			}
		}
	}

	// Process last 100 lines (these override earlier values)
	const lastLines = lines.slice(-100);
	for (const line of lastLines) {
		const match = line.match(pattern);
		if (match) {
			const varName = match[1]; // Without $
			const value = parseFloat(match[2]);
			if (!isNaN(value)) {
				variables[varName] = value;
			}
		}
	}

	return variables;
}
