/**
 * Validate expression syntax by attempting to evaluate it
 * Returns true if the expression is valid (or empty), false otherwise
 */
export function isValidExpression(expr: string, variableNames: string[]): boolean {
	if (!expr || expr.trim() === '') {
		return true;
	}

	try {
		// Build dummy variables (all as single-element arrays)
		const variables: Record<string, number[]> = {};
		for (const name of variableNames) {
			variables[name] = [1];
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
 * Supports: +, -, *, /, ^, comparison operators, parentheses, variables
 * Comparison operators: <, <=, >, >=, ==, != (return 1 for true, 0 for false)
 * Functions:
 *   - Element-wise: log(), ceil(), floor()
 *   - Aggregation: avg(), max(), min() (array -> scalar)
 *   - Special: random() (no arguments)
 * All values are arrays internally (element-wise operations, length-1 arrays can broadcast)
 * Throws an error if the expression is invalid
 */
export function evaluateExpression(expr: string, variables: Record<string, number[]>): number[] {
	const parser = new ExpressionParser(expr.trim(), variables);
	const result = parser.parse();
	if (parser.pos < parser.tokens.length && parser.tokens[parser.pos].type !== 'eof') {
		throw new Error(`Unexpected token: ${parser.tokens[parser.pos].value}`);
	}
	return result;
}

type TokenType = 'number' | 'identifier' | 'operator' | 'comparison' | 'lparen' | 'rparen' | 'eof';

interface Token {
	type: TokenType;
	value: string;
}

/**
 * Helper functions for element-wise operations
 * All values are arrays; length-1 arrays can be broadcast
 */
function elementWise(
	left: number[],
	right: number[],
	op: (a: number, b: number) => number,
): number[] {
	// Broadcast: if one is length 1, broadcast to the other's length
	if (left.length === 1 && right.length === 1) {
		return [op(left[0], right[0])];
	}

	if (left.length === 1) {
		return right.map((b: number) => op(left[0], b));
	}

	if (right.length === 1) {
		return left.map((a: number) => op(a, right[0]));
	}

	// Element-wise: both arrays must have same length
	if (left.length !== right.length) {
		throw new Error(
			`Array length mismatch: ${left.length} vs ${right.length} (only length-1 arrays can be broadcast)`,
		);
	}

	return left.map((a: number, i: number) => op(a, right[i]));
}

function elementWiseUnary(value: number[], op: (a: number) => number): number[] {
	return value.map(op);
}

class ExpressionParser {
	tokens: Token[];
	pos: number;
	variables: Record<string, number[]>;

	constructor(expr: string, variables: Record<string, number[]>) {
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

			// Comparison operators (must check before single-char operators)
			if (char === '<' || char === '>' || char === '=' || char === '!') {
				let op = char;
				i++;
				if (i < expr.length && expr[i] === '=') {
					op += '=';
					i++;
				}
				// Validate comparison operators
				if (op === '<' || op === '<=' || op === '>' || op === '>=' || op === '==' || op === '!=') {
					tokens.push({ type: 'comparison', value: op });
					continue;
				}
				throw new Error(`Invalid operator: ${op}`);
			}

			// Arithmetic operators
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

	parse(): number[] {
		return this.parseComparison();
	}

	// Comparison operators (lowest precedence)
	parseComparison(): number[] {
		let left = this.parseAddSub();

		while (this.pos < this.tokens.length) {
			const token = this.tokens[this.pos];
			if (token.type === 'comparison') {
				this.pos++;
				const right = this.parseAddSub();
				const op = token.value;

				left = elementWise(left, right, (a, b) => {
					let result: boolean;
					if (op === '<') {
						result = a < b;
					} else if (op === '<=') {
						result = a <= b;
					} else if (op === '>') {
						result = a > b;
					} else if (op === '>=') {
						result = a >= b;
					} else if (op === '==') {
						result = a === b;
					} else if (op === '!=') {
						result = a !== b;
					} else {
						throw new Error(`Unknown comparison operator: ${op}`);
					}
					return result ? 1 : 0;
				});
			} else {
				break;
			}
		}

		return left;
	}

	// Addition and subtraction
	parseAddSub(): number[] {
		let left = this.parseMulDiv();

		while (this.pos < this.tokens.length) {
			const token = this.tokens[this.pos];
			if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
				this.pos++;
				const right = this.parseMulDiv();
				left =
					token.value === '+'
						? elementWise(left, right, (a, b) => a + b)
						: elementWise(left, right, (a, b) => a - b);
			} else {
				break;
			}
		}

		return left;
	}

	// Multiplication and division
	parseMulDiv(): number[] {
		let left = this.parsePower();

		while (this.pos < this.tokens.length) {
			const token = this.tokens[this.pos];
			if (token.type === 'operator' && (token.value === '*' || token.value === '/')) {
				this.pos++;
				const right = this.parsePower();
				if (token.value === '*') {
					left = elementWise(left, right, (a, b) => a * b);
				} else {
					left = elementWise(left, right, (a, b) => {
						if (b === 0) {
							throw new Error('Division by zero');
						}
						return a / b;
					});
				}
			} else {
				break;
			}
		}

		return left;
	}

	// Power (right associative)
	parsePower(): number[] {
		let left = this.parseUnary();

		if (this.pos < this.tokens.length) {
			const token = this.tokens[this.pos];
			if (token.type === 'operator' && token.value === '^') {
				this.pos++;
				const right = this.parsePower(); // Right associative
				left = elementWise(left, right, (a, b) => a ** b);
			}
		}

		return left;
	}

	// Unary operators (+, -)
	parseUnary(): number[] {
		if (this.pos < this.tokens.length) {
			const token = this.tokens[this.pos];
			if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
				this.pos++;
				const value = this.parseUnary();
				return token.value === '-' ? elementWiseUnary(value, (a) => -a) : value;
			}
		}

		return this.parsePrimary();
	}

	// Primary expressions (numbers, variables, functions, parentheses)
	parsePrimary(): number[] {
		if (this.pos >= this.tokens.length) {
			throw new Error('Unexpected end of expression');
		}

		const token = this.tokens[this.pos];

		// EOF or unexpected token
		if (token.type === 'eof') {
			throw new Error('Unexpected end of expression');
		}

		// Number (wrap in array)
		if (token.type === 'number') {
			this.pos++;
			const num = parseFloat(token.value);
			if (isNaN(num)) {
				throw new Error(`Invalid number: ${token.value}`);
			}
			return [num];
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

	parseFunctionCall(name: string): number[] {
		// Special case: random() takes no arguments
		if (name === 'random') {
			// Consume '('
			this.pos++;
			// Expect ')'
			if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'rparen') {
				throw new Error('random() takes no arguments');
			}
			this.pos++;
			return [Math.random()];
		}

		// All other functions take one argument
		// Consume '('
		this.pos++;

		// Parse argument
		const arg = this.parseAddSub();

		// Expect ')'
		if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'rparen') {
			throw new Error('Missing closing parenthesis in function call');
		}
		this.pos++;

		// Element-wise functions
		if (name === 'log') {
			return elementWiseUnary(arg, (a) => {
				if (a <= 0) {
					throw new Error('log() requires positive argument');
				}
				return Math.log(a);
			});
		}

		if (name === 'ceil') {
			return elementWiseUnary(arg, Math.ceil);
		}

		if (name === 'floor') {
			return elementWiseUnary(arg, Math.floor);
		}

		// Aggregation functions (array -> single number, wrapped in length-1 array)
		if (name === 'avg' || name === 'max' || name === 'min') {
			if (arg.length === 0) {
				throw new Error(`${name}() requires non-empty array`);
			}

			if (name === 'avg') {
				const sum = arg.reduce((acc, val) => acc + val, 0);
				return [sum / arg.length];
			}

			if (name === 'max') {
				return [Math.max(...arg)];
			}

			if (name === 'min') {
				return [Math.min(...arg)];
			}
		}

		throw new Error(`Unknown function: ${name}`);
	}
}
