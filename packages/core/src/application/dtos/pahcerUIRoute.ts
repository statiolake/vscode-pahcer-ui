import type { CaseFileKind } from '../openCaseFileUseCase';

export type PahcerUIRoute =
  | { kind: 'home' }
  | { kind: 'execution'; executionId: string }
  | { kind: 'case'; executionId: string; seed: number; fileKind?: CaseFileKind }
  | { kind: 'visualizer'; executionId: string; seed: number }
  | { kind: 'comparison'; executionIds: string[] }
  | { kind: 'diff'; executionIds: string[] }
  | { kind: 'source'; executionId: string };

export function buildPahcerUIPath(route: PahcerUIRoute): string {
  switch (route.kind) {
    case 'home':
      return '/';
    case 'execution':
      return `/executions/${encodePathSegment(route.executionId)}`;
    case 'source':
      return `/executions/${encodePathSegment(route.executionId)}/source`;
    case 'case':
      return `/${[
        'executions',
        encodePathSegment(route.executionId),
        'seeds',
        String(route.seed),
        route.fileKind,
      ]
        .filter(Boolean)
        .join('/')}`;
    case 'visualizer':
      return `/executions/${encodePathSegment(route.executionId)}/seeds/${route.seed}/visualizer`;
    case 'comparison':
      return `/comparison/${route.executionIds.map(encodePathSegment).join('/')}`;
    case 'diff':
      return `/diff/${route.executionIds.map(encodePathSegment).join('/')}`;
  }
}

export function parsePahcerUIPath(pathname: string): PahcerUIRoute | undefined {
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodePathSegment(segment));
  if (segments.some((segment) => segment === undefined)) {
    return undefined;
  }

  const decoded = segments as string[];
  if (decoded.length === 0) {
    return { kind: 'home' };
  }

  if (decoded[0] === 'executions' && decoded[1]) {
    const executionId = decoded[1];
    if (decoded.length === 2) {
      return { kind: 'execution', executionId };
    }
    if (decoded.length === 3 && decoded[2] === 'source') {
      return { kind: 'source', executionId };
    }
    if (decoded[2] === 'seeds' && decoded[3]) {
      const seed = parseSeed(decoded[3]);
      if (seed === undefined) {
        return undefined;
      }
      if (decoded.length === 4) {
        return { kind: 'case', executionId, seed };
      }
      if (decoded.length === 5 && isCaseFileKind(decoded[4])) {
        return { kind: 'case', executionId, seed, fileKind: decoded[4] };
      }
      if (decoded.length === 5 && decoded[4] === 'visualizer') {
        return { kind: 'visualizer', executionId, seed };
      }
    }
    return undefined;
  }

  if ((decoded[0] === 'comparison' || decoded[0] === 'diff') && decoded.length > 1) {
    const executionIds = decoded.slice(1).filter(Boolean);
    if (executionIds.length === 0) {
      return undefined;
    }
    return { kind: decoded[0], executionIds };
  }

  return undefined;
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function decodePathSegment(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function parseSeed(value: string): number | undefined {
  const seed = Number(value);
  return Number.isInteger(seed) && seed >= 0 ? seed : undefined;
}

function isCaseFileKind(value: string): value is CaseFileKind {
  return value === 'input' || value === 'output' || value === 'error';
}
