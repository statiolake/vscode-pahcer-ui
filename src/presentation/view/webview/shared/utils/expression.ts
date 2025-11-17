/**
 * 式の構文を検証（評価なし）
 * 式が有効な場合、または空の場合は true を返す。それ以外は false を返す
 * 注：variableNames パラメータは後方互換性のため保持されていますが使用されません
 */
export function isValidExpression(expr: string, _variableNames?: string[]): boolean {
  if (!expr || expr.trim() === '') {
    return true;
  }

  try {
    // 構文のみをチェック（評価なし）
    parseExpression(expr);
    return true;
  } catch (e) {
    console.warn(`式 '${expr}' の検証エラー:`, e);
    return false;
  }
}

/**
 * AST ベースのパーサーを使用して算術式を評価
 * サポート：+, -, *, /, ^, 比較演算子、括弧、変数
 * 比較演算子：<, <=, >, >=, ==, != （true で 1、false で 0 を返す）
 * 関数：
 *   - 要素ごと：log()、ceil()、floor()
 *   - 集約：avg()、max()、min() （配列 -> スカラー）
 *   - 特殊：random() （引数なし）
 * すべての値は内部的に配列です（要素ごと操作、長さ1の配列はブロードキャスト可能）
 * 式が無効な場合はエラーをスロー
 */
export function evaluateExpression(expr: string, variables: Record<string, number[]>): number[] {
  const ast = parseExpression(expr);
  return evaluateAst(ast, variables);
}

/**
 * 式を AST（抽象構文木）にパース
 * 変数の存在をチェックしません。構文のみ検証します
 */
export function parseExpression(expr: string): AstNode {
  const parser = new ExpressionParser(expr.trim());
  const result = parser.parse();
  if (parser.pos < parser.tokens.length && parser.tokens[parser.pos].type !== 'eof') {
    throw new Error(`予期しないトークン: ${parser.tokens[parser.pos].value}`);
  }
  return result;
}

/**
 * 与えられた変数で AST を評価
 * 変数が見つからない、または評価に失敗した場合はエラーをスロー
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
          // TypeScript が全ケースがカバーされていることを保証すべき
          throw new Error(`未知の二項演算子: ${(node as BinaryNode).operator}`);
      }
    }

    case 'function': {
      // 特殊ケース：random() は引数を取らない
      if (node.name === 'random') {
        if (node.args.length !== 0) {
          throw new Error('random() は引数を取りません');
        }
        return [Math.random()];
      }

      // 他のすべての関数はちょうど1つの引数を取る
      if (node.args.length !== 1) {
        throw new Error(`${node.name}() は正確に1つの引数が必要です`);
      }

      const arg = evaluateAst(node.args[0], variables);

      // 要素ごと関数
      if (node.name === 'log') {
        return elementWiseUnary(arg, (a) => {
          if (a <= 0) {
            throw new Error('log() は正の値の引数が必要です');
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

      // 集約関数（配列 -> 単一の数値、長さ1の配列でラップ）
      if (node.name === 'avg' || node.name === 'max' || node.name === 'min') {
        if (arg.length === 0) {
          throw new Error(`${node.name}() は空でない配列が必要です`);
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

      throw new Error(`未知の関数: ${node.name}`);
    }

    default:
      // TypeScript が全ケースがカバーされていることを保証すべき
      throw new Error(`未知の AST ノードタイプ: ${(node as AstNode).type}`);
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
 * 要素ごと操作のヘルパー関数
 * すべての値は配列です。長さ1の配列はブロードキャスト可能です
 */
function elementWise(
  left: number[],
  right: number[],
  op: (a: number, b: number) => number,
): number[] {
  // ブロードキャスト：どちらかが長さ1の場合、もう一方の長さにブロードキャスト
  if (left.length === 1 && right.length === 1) {
    return [op(left[0], right[0])];
  }

  if (left.length === 1) {
    return right.map((b: number) => op(left[0], b));
  }

  if (right.length === 1) {
    return left.map((a: number) => op(a, right[0]));
  }

  // 要素ごと：両方の配列は同じ長さでなければならない
  if (left.length !== right.length) {
    throw new Error(
      `配列の長さが不一致です: ${left.length} vs ${right.length} （長さ1の配列のみブロードキャスト可能）`,
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
