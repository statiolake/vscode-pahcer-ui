/**
 * Evaluate arithmetic expression without using eval
 * Supports: +, -, *, /, ^, log(), parentheses
 */
export function evaluateExpression(expr: string, variables: Record<string, number>): number {
	try {
		let expression = expr.trim();

		// Sort variables by name length (longest first) to avoid partial replacements
		const sortedVars = Object.entries(variables).sort((a, b) => b[0].length - a[0].length);

		// Replace variables with their values
		for (const [name, value] of sortedVars) {
			// Escape special regex characters in variable name
			const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const regex = new RegExp('\\b' + escapedName + '\\b', 'g');
			expression = expression.replace(regex, String(value));
		}

		// Handle log(x) function
		expression = expression.replace(/log\s*\(([^)]+)\)/g, (match, arg) => {
			const argValue = parseFloat(arg);
			return String(Math.log(argValue));
		});

		// Handle power operator x^n
		expression = expression.replace(/([\d.]+)\s*\^\s*([\d.]+)/g, (match, base, exp) => {
			return String(parseFloat(base) ** parseFloat(exp));
		});

		// Simple arithmetic evaluation
		const result = evalArithmetic(expression);
		return isNaN(result) || !isFinite(result) ? 0 : result;
	} catch (e) {
		console.error(
			'Failed to evaluate expression:',
			expr,
			'with variables:',
			variables,
			'error:',
			e,
		);
		return 0;
	}
}

function evalArithmetic(expr: string): number {
	// Remove whitespace
	expr = expr.replace(/\s+/g, '');

	// Evaluate parentheses first
	while (expr.includes('(')) {
		expr = expr.replace(/\(([^()]+)\)/g, (match, inner) => {
			return String(evalArithmetic(inner));
		});
	}

	// Evaluate multiplication and division (left to right)
	while (/[\d.]+[*/][\d.]+/.test(expr)) {
		expr = expr.replace(/([\d.]+)([*/])([\d.]+)/, (match, a, op, b) => {
			const numA = parseFloat(a);
			const numB = parseFloat(b);
			return String(op === '*' ? numA * numB : numA / numB);
		});
	}

	// Evaluate addition and subtraction (left to right)
	while (/[\d.]+[+-][\d.]+/.test(expr)) {
		expr = expr.replace(/([\d.]+)([+-])([\d.]+)/, (match, a, op, b) => {
			const numA = parseFloat(a);
			const numB = parseFloat(b);
			return String(op === '+' ? numA + numB : numA - numB);
		});
	}

	return parseFloat(expr);
}
