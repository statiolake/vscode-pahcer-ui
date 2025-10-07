import { populateVariables } from './features';

/**
 * Validate expression syntax by attempting to evaluate it
 * Returns true if the expression is valid (or empty), false otherwise
 */
export function isValidExpression(expr: string, features: string[]): boolean {
	if (!expr || expr.trim() === '') {
		return true;
	}

	try {
		// Build dummy variables from features + seed
		const variables = populateVariables(0, features, '');

		// Try to evaluate with dummy variables
		const _ = evaluateExpression(expr, variables);
		return true;
	} catch {
		return false;
	}
}

/**
 * Evaluate arithmetic expression without using eval
 * Supports: +, -, *, /, ^, log(), parentheses
 * Throws an error if the expression is invalid
 */
export function evaluateExpression(expr: string, variables: Record<string, number>): number {
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
	expression = expression.replace(/log\s*\(([^)]+)\)/g, (_match, arg) => {
		const argValue = parseFloat(arg);
		return String(Math.log(argValue));
	});

	// Handle power operator x^n
	expression = expression.replace(/([\d.]+)\s*\^\s*([\d.]+)/g, (_match, base, exp) => {
		return String(parseFloat(base) ** parseFloat(exp));
	});

	// Simple arithmetic evaluation (may throw)
	const result = evalArithmetic(expression);
	if (isNaN(result) || !isFinite(result)) {
		throw new Error('Invalid expression result');
	}
	return result;
}

function evalArithmetic(expr: string): number {
	// Remove whitespace
	expr = expr.replace(/\s+/g, '');

	// Check for empty expression
	if (expr === '') {
		throw new Error('Empty expression');
	}

	// Evaluate parentheses first
	let lastExpr = '';
	let iterations = 0;
	while (expr.includes('(') && expr !== lastExpr && iterations < 100) {
		lastExpr = expr;
		expr = expr.replace(/\(([^()]+)\)/g, (_match, inner) => {
			return String(evalArithmetic(inner));
		});
		iterations++;
	}

	// If unmatched parentheses remain, throw error
	if (expr.includes('(') || expr.includes(')')) {
		throw new Error('Unmatched parentheses');
	}

	// Evaluate multiplication and division (left to right)
	while (/[\d.]+[*/][\d.]+/.test(expr)) {
		expr = expr.replace(/([\d.]+)([*/])([\d.]+)/, (_match, a, op, b) => {
			const numA = parseFloat(a);
			const numB = parseFloat(b);
			if (isNaN(numA) || isNaN(numB)) {
				throw new Error('Invalid number in expression');
			}
			const result = op === '*' ? numA * numB : numA / numB;
			if (!isFinite(result)) {
				throw new Error('Division by zero or infinite result');
			}
			return String(result);
		});
	}

	// Evaluate addition and subtraction (left to right)
	while (/[\d.]+[+-][\d.]+/.test(expr)) {
		expr = expr.replace(/([\d.]+)([+-])([\d.]+)/, (_match, a, op, b) => {
			const numA = parseFloat(a);
			const numB = parseFloat(b);
			if (isNaN(numA) || isNaN(numB)) {
				throw new Error('Invalid number in expression');
			}
			return String(op === '+' ? numA + numB : numA - numB);
		});
	}

	const result = parseFloat(expr);
	if (isNaN(result)) {
		throw new Error('Invalid expression result');
	}
	if (!isFinite(result)) {
		throw new Error('Infinite result');
	}
	return result;
}
