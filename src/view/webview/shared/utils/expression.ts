/**
 * Validate expression syntax by attempting to evaluate it
 * Returns true if the expression is valid (or empty), false otherwise
 */
export function isValidExpression(expr: string, variableNames: string[]): boolean {
	if (!expr || expr.trim() === '') {
		return true;
	}

	try {
		// Build dummy variables
		const variables: Record<string, number> = {};
		for (const name of variableNames) {
			variables[name] = 1;
		}

		// Try to evaluate with dummy variables
		evaluateExpression(expr, variables);
		return true;
	} catch (e) {
		console.warn(`Expression '${expr}' validation error:`, e);
		return false;
	}
}

/**
 * Evaluate arithmetic expression using recursive descent parser
 * Supports: +, -, *, /, ^, log(), parentheses, variables
 * Throws an error if the expression is invalid
 */
export function evaluateExpression(expr: string, variables: Record<string, number>): number {
	const parser = new ExpressionParser(expr.trim(), variables);
	const result = parser.parse();
	if (parser.pos < parser.tokens.length && parser.tokens[parser.pos].type !== 'eof') {
		throw new Error(`Unexpected token: ${parser.tokens[parser.pos].value}`);
	}
	return result;
}

type TokenType = 'number' | 'identifier' | 'operator' | 'lparen' | 'rparen' | 'eof';

interface Token {
	type: TokenType;
	value: string;
}

class ExpressionParser {
	tokens: Token[];
	pos: number;
	variables: Record<string, number>;

	constructor(expr: string, variables: Record<string, number>) {
		this.tokens = this.tokenize(expr);
		this.pos = 0;
		this.variables = variables;
	}

	tokenize(expr: string): Token[] {
		const tokens: Token[] = [];
		let i = 0;

		while (i < expr.length) {
			const char = expr[i];

			// Skip whitespace
			if (/\s/.test(char)) {
				i++;
				continue;
			}

			// Numbers
			if (/\d/.test(char)) {
				let num = '';
				while (i < expr.length && /[\d.]/.test(expr[i])) {
					num += expr[i];
					i++;
				}
				tokens.push({ type: 'number', value: num });
				continue;
			}

			// Identifiers (variables and functions)
			if (/[a-zA-Z_]/.test(char)) {
				let ident = '';
				while (i < expr.length && /[a-zA-Z_0-9]/.test(expr[i])) {
					ident += expr[i];
					i++;
				}
				tokens.push({ type: 'identifier', value: ident });
				continue;
			}

			// Operators
			if ('+-*/^'.includes(char)) {
				tokens.push({ type: 'operator', value: char });
				i++;
				continue;
			}

			// Parentheses
			if (char === '(') {
				tokens.push({ type: 'lparen', value: char });
				i++;
				continue;
			}

			if (char === ')') {
				tokens.push({ type: 'rparen', value: char });
				i++;
				continue;
			}

			throw new Error(`Unexpected character: ${char}`);
		}

		tokens.push({ type: 'eof', value: '' });
		return tokens;
	}

	parse(): number {
		return this.parseAddSub();
	}

	// Addition and subtraction (lowest precedence)
	parseAddSub(): number {
		let left = this.parseMulDiv();

		while (this.pos < this.tokens.length) {
			const token = this.tokens[this.pos];
			if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
				this.pos++;
				const right = this.parseMulDiv();
				left = token.value === '+' ? left + right : left - right;
			} else {
				break;
			}
		}

		return left;
	}

	// Multiplication and division
	parseMulDiv(): number {
		let left = this.parsePower();

		while (this.pos < this.tokens.length) {
			const token = this.tokens[this.pos];
			if (token.type === 'operator' && (token.value === '*' || token.value === '/')) {
				this.pos++;
				const right = this.parsePower();
				if (token.value === '*') {
					left = left * right;
				} else {
					if (right === 0) {
						throw new Error('Division by zero');
					}
					left = left / right;
				}
			} else {
				break;
			}
		}

		return left;
	}

	// Power (right associative)
	parsePower(): number {
		let left = this.parseUnary();

		if (this.pos < this.tokens.length) {
			const token = this.tokens[this.pos];
			if (token.type === 'operator' && token.value === '^') {
				this.pos++;
				const right = this.parsePower(); // Right associative
				left = left ** right;
			}
		}

		return left;
	}

	// Unary operators (+, -)
	parseUnary(): number {
		if (this.pos < this.tokens.length) {
			const token = this.tokens[this.pos];
			if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
				this.pos++;
				const value = this.parseUnary();
				return token.value === '-' ? -value : value;
			}
		}

		return this.parsePrimary();
	}

	// Primary expressions (numbers, variables, functions, parentheses)
	parsePrimary(): number {
		if (this.pos >= this.tokens.length) {
			throw new Error('Unexpected end of expression');
		}

		const token = this.tokens[this.pos];

		// EOF or unexpected token
		if (token.type === 'eof') {
			throw new Error('Unexpected end of expression');
		}

		// Number
		if (token.type === 'number') {
			this.pos++;
			const num = parseFloat(token.value);
			if (isNaN(num)) {
				throw new Error(`Invalid number: ${token.value}`);
			}
			return num;
		}

		// Identifier (variable or function)
		if (token.type === 'identifier') {
			this.pos++;

			// Function call
			if (this.pos < this.tokens.length && this.tokens[this.pos].type === 'lparen') {
				return this.parseFunctionCall(token.value);
			}

			// Variable
			if (!(token.value in this.variables)) {
				throw new Error(`Unknown variable: ${token.value}`);
			}
			return this.variables[token.value];
		}

		// Parenthesized expression
		if (token.type === 'lparen') {
			this.pos++;
			const value = this.parseAddSub();
			if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'rparen') {
				throw new Error('Missing closing parenthesis');
			}
			this.pos++;
			return value;
		}

		throw new Error(`Unexpected token: ${token.value}`);
	}

	parseFunctionCall(name: string): number {
		// Consume '('
		this.pos++;

		// Parse argument
		const arg = this.parseAddSub();

		// Expect ')'
		if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'rparen') {
			throw new Error('Missing closing parenthesis in function call');
		}
		this.pos++;

		// Evaluate function
		if (name === 'log') {
			if (arg <= 0) {
				throw new Error('log() requires positive argument');
			}
			return Math.log(arg);
		}

		throw new Error(`Unknown function: ${name}`);
	}
}
