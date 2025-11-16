/**
 * Validate expression syntax by parsing (without evaluating)
 * Returns true if the expression is valid (or empty), false otherwise
 * Note: variableNames parameter is kept for backward compatibility but not used
 */
export function isValidExpression(expr: string, _variableNames?: string[]): boolean {
  if (!expr || expr.trim() === '') {
    return true;
  }

  try {
    // Parse without evaluation - only checks syntax
    parseExpression(expr);
    return true;
  } catch (e) {
    console.warn(`Expression '${expr}' validation error:`, e);
    return false;
  }
}

/**
 * Evaluate arithmetic expression using AST-based parser
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
  const ast = parseExpression(expr);
  return evaluateAst(ast, variables);
}

/**
 * Parse expression into AST (Abstract Syntax Tree)
 * Does NOT check if variables exist - only validates syntax
 */
export function parseExpression(expr: string): AstNode {
  const parser = new ExpressionParser(expr.trim());
  const result = parser.parse();
  if (parser.pos < parser.tokens.length && parser.tokens[parser.pos].type !== 'eof') {
    throw new Error(`Unexpected token: ${parser.tokens[parser.pos].value}`);
  }
  return result;
}

/**
 * Evaluate AST with given variables
 * Throws an error if a variable is not found or evaluation fails
 */
export function evaluateAst(node: AstNode, variables: Record<string, number[]>): number[] {
  switch (node.type) {
    case 'number':
      return [node.value];

    case 'variable':
      if (!(node.name in variables)) {
        throw new Error(`Unknown variable: ${node.name}`);
      }
      return variables[node.name];

    case 'unary': {
      const operand = evaluateAst(node.operand, variables);
      return node.operator === '-' ? elementWiseUnary(operand, (a) => -a) : operand;
    }

    case 'binary': {
      const left = evaluateAst(node.left, variables);
      const right = evaluateAst(node.right, variables);

      switch (node.operator) {
        case '+':
          return elementWise(left, right, (a, b) => a + b);
        case '-':
          return elementWise(left, right, (a, b) => a - b);
        case '*':
          return elementWise(left, right, (a, b) => a * b);
        case '/':
          return elementWise(left, right, (a, b) => {
            if (b === 0) {
              throw new Error('Division by zero');
            }
            return a / b;
          });
        case '^':
          return elementWise(left, right, (a, b) => a ** b);
        case '<':
          return elementWise(left, right, (a, b) => (a < b ? 1 : 0));
        case '<=':
          return elementWise(left, right, (a, b) => (a <= b ? 1 : 0));
        case '>':
          return elementWise(left, right, (a, b) => (a > b ? 1 : 0));
        case '>=':
          return elementWise(left, right, (a, b) => (a >= b ? 1 : 0));
        case '==':
          return elementWise(left, right, (a, b) => (a === b ? 1 : 0));
        case '!=':
          return elementWise(left, right, (a, b) => (a !== b ? 1 : 0));
        default:
          // TypeScript should ensure all cases are covered
          throw new Error(`Unknown binary operator: ${(node as BinaryNode).operator}`);
      }
    }

    case 'function': {
      // Special case: random() takes no arguments
      if (node.name === 'random') {
        if (node.args.length !== 0) {
          throw new Error('random() takes no arguments');
        }
        return [Math.random()];
      }

      // All other functions take exactly one argument
      if (node.args.length !== 1) {
        throw new Error(`${node.name}() requires exactly one argument`);
      }

      const arg = evaluateAst(node.args[0], variables);

      // Element-wise functions
      if (node.name === 'log') {
        return elementWiseUnary(arg, (a) => {
          if (a <= 0) {
            throw new Error('log() requires positive argument');
          }
          return Math.log(a);
        });
      }

      if (node.name === 'ceil') {
        return elementWiseUnary(arg, Math.ceil);
      }

      if (node.name === 'floor') {
        return elementWiseUnary(arg, Math.floor);
      }

      // Aggregation functions (array -> single number, wrapped in length-1 array)
      if (node.name === 'avg' || node.name === 'max' || node.name === 'min') {
        if (arg.length === 0) {
          throw new Error(`${node.name}() requires non-empty array`);
        }

        if (node.name === 'avg') {
          const sum = arg.reduce((acc, val) => acc + val, 0);
          return [sum / arg.length];
        }

        if (node.name === 'max') {
          return [Math.max(...arg)];
        }

        if (node.name === 'min') {
          return [Math.min(...arg)];
        }
      }

      throw new Error(`Unknown function: ${node.name}`);
    }

    default:
      // TypeScript should ensure all cases are covered
      throw new Error(`Unknown AST node type: ${(node as AstNode).type}`);
  }
}

// AST Node Types
type AstNode = NumberNode | VariableNode | UnaryNode | BinaryNode | FunctionNode;

interface NumberNode {
  type: 'number';
  value: number;
}

interface VariableNode {
  type: 'variable';
  name: string;
}

interface UnaryNode {
  type: 'unary';
  operator: '+' | '-';
  operand: AstNode;
}

interface BinaryNode {
  type: 'binary';
  operator: '+' | '-' | '*' | '/' | '^' | '<' | '<=' | '>' | '>=' | '==' | '!=';
  left: AstNode;
  right: AstNode;
}

interface FunctionNode {
  type: 'function';
  name: string;
  args: AstNode[];
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

  constructor(expr: string) {
    this.tokens = this.tokenize(expr);
    this.pos = 0;
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

      // Identifiers starting with $ (stderr variables)
      if (char === '$') {
        let ident = '$';
        i++;
        if (i < expr.length && /[a-zA-Z_]/.test(expr[i])) {
          while (i < expr.length && /[a-zA-Z_0-9]/.test(expr[i])) {
            ident += expr[i];
            i++;
          }
          tokens.push({ type: 'identifier', value: ident });
          continue;
        }
        throw new Error('Invalid variable name after $');
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

  parse(): AstNode {
    return this.parseComparison();
  }

  // Comparison operators (lowest precedence)
  parseComparison(): AstNode {
    let left = this.parseAddSub();

    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token.type === 'comparison') {
        this.pos++;
        const right = this.parseAddSub();
        left = {
          type: 'binary',
          operator: token.value as '<' | '<=' | '>' | '>=' | '==' | '!=',
          left,
          right,
        };
      } else {
        break;
      }
    }

    return left;
  }

  // Addition and subtraction
  parseAddSub(): AstNode {
    let left = this.parseMulDiv();

    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
        this.pos++;
        const right = this.parseMulDiv();
        left = {
          type: 'binary',
          operator: token.value as '+' | '-',
          left,
          right,
        };
      } else {
        break;
      }
    }

    return left;
  }

  // Multiplication and division
  parseMulDiv(): AstNode {
    let left = this.parsePower();

    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token.type === 'operator' && (token.value === '*' || token.value === '/')) {
        this.pos++;
        const right = this.parsePower();
        left = {
          type: 'binary',
          operator: token.value as '*' | '/',
          left,
          right,
        };
      } else {
        break;
      }
    }

    return left;
  }

  // Power (right associative)
  parsePower(): AstNode {
    let left = this.parseUnary();

    if (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token.type === 'operator' && token.value === '^') {
        this.pos++;
        const right = this.parsePower(); // Right associative
        left = {
          type: 'binary',
          operator: '^',
          left,
          right,
        };
      }
    }

    return left;
  }

  // Unary operators (+, -)
  parseUnary(): AstNode {
    if (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
        this.pos++;
        const operand = this.parseUnary();
        return {
          type: 'unary',
          operator: token.value as '+' | '-',
          operand,
        };
      }
    }

    return this.parsePrimary();
  }

  // Primary expressions (numbers, variables, functions, parentheses)
  parsePrimary(): AstNode {
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
      if (Number.isNaN(num)) {
        throw new Error(`Invalid number: ${token.value}`);
      }
      return { type: 'number', value: num };
    }

    // Identifier (variable or function)
    if (token.type === 'identifier') {
      this.pos++;

      // Function call
      if (this.pos < this.tokens.length && this.tokens[this.pos].type === 'lparen') {
        return this.parseFunctionCall(token.value);
      }

      // Variable (no validation at parse time)
      return { type: 'variable', name: token.value };
    }

    // Parenthesized expression
    if (token.type === 'lparen') {
      this.pos++;
      const value = this.parseComparison();
      if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'rparen') {
        throw new Error('Missing closing parenthesis');
      }
      this.pos++;
      return value;
    }

    throw new Error(`Unexpected token: ${token.value}`);
  }

  parseFunctionCall(name: string): FunctionNode {
    // Consume '('
    this.pos++;

    // Special case: random() takes no arguments
    if (name === 'random') {
      // Expect ')'
      if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'rparen') {
        throw new Error('random() takes no arguments');
      }
      this.pos++;
      return { type: 'function', name, args: [] };
    }

    // All other functions take one argument
    const arg = this.parseComparison();

    // Expect ')'
    if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'rparen') {
      throw new Error('Missing closing parenthesis in function call');
    }
    this.pos++;

    return { type: 'function', name, args: [arg] };
  }
}
