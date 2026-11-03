/** A 2D point in the 300x300 Akshara stroke coordinate space. */
export interface Point {
  x: number;
  y: number;
}

/** A normalized absolute path segment (all commands reduced to M / L / C / Z). */
export type Segment =
  | { type: 'M'; to: Point }
  | { type: 'L'; from: Point; to: Point }
  | { type: 'C'; from: Point; c1: Point; c2: Point; to: Point }
  | { type: 'Z'; from: Point; to: Point };

const ARG_COUNTS: Record<string, number> = {
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, Z: 0, A: 7,
};

const TOKEN_RE = /([MmLlHhVvCcSsQqTtZzAa])|([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)/g;

function tokenize(d: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const stripped = d.replace(/[\s,]+/g, ' ');
  let consumed = 0;
  for (const m of stripped.matchAll(TOKEN_RE)) {
    const between = stripped.slice(consumed, m.index).trim();
    if (between) throw new Error(`Unexpected characters in SVG path: "${between}"`);
    tokens.push(m[1] ?? Number(m[2]));
    consumed = (m.index ?? 0) + m[0].length;
  }
  if (stripped.slice(consumed).trim()) {
    throw new Error(`Unexpected characters in SVG path: "${stripped.slice(consumed).trim()}"`);
  }
  return tokens;
}

function quadToCubic(p0: Point, q: Point, p1: Point): { c1: Point; c2: Point } {
  return {
    c1: { x: p0.x + (2 / 3) * (q.x - p0.x), y: p0.y + (2 / 3) * (q.y - p0.y) },
    c2: { x: p1.x + (2 / 3) * (q.x - p1.x), y: p1.y + (2 / 3) * (q.y - p1.y) },
  };
}

/**
 * Parse an SVG path `d` attribute into absolute M / L / C / Z segments.
 * Supports M, L, H, V, C, S, Q, T, Z in absolute and relative form.
 * Elliptical arcs (A) are rejected: Akshara stroke data is authored with Béziers.
 */
export function parseSvgPath(d: string): Segment[] {
  const tokens = tokenize(d);
  const segments: Segment[] = [];
  let i = 0;
  let cmd = '';
  let cur: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  let lastCubicCtrl: Point | null = null;
  let lastQuadCtrl: Point | null = null;

  const num = (): number => {
    const t = tokens[i++];
    if (typeof t !== 'number') throw new Error(`Expected number in SVG path for command "${cmd}"`);
    return t;
  };

  while (i < tokens.length) {
    const t = tokens[i];
    if (typeof t === 'string') {
      cmd = t;
      i++;
      if (cmd === 'A' || cmd === 'a') throw new Error('SVG arc commands (A/a) are not supported; use cubic Béziers.');
    } else if (!cmd) {
      throw new Error('SVG path must begin with a command.');
    } else if (cmd === 'Z' || cmd === 'z') {
      throw new Error('Unexpected number after Z.');
    }

    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;
    if (!(upper in ARG_COUNTS)) throw new Error(`Unknown SVG path command "${cmd}"`);
    const ox = rel ? cur.x : 0;
    const oy = rel ? cur.y : 0;
    let nextCubic: Point | null = null;
    let nextQuad: Point | null = null;

    switch (upper) {
      case 'M': {
        const to = { x: ox + num(), y: oy + num() };
        segments.push({ type: 'M', to });
        cur = start = to;
        // Subsequent coordinate pairs after M are implicit line-tos.
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L':
      case 'H':
      case 'V': {
        const to =
          upper === 'L' ? { x: ox + num(), y: oy + num() }
          : upper === 'H' ? { x: ox + num(), y: cur.y }
          : { x: cur.x, y: oy + num() };
        segments.push({ type: 'L', from: cur, to });
        cur = to;
        break;
      }
      case 'C': {
        const c1 = { x: ox + num(), y: oy + num() };
        const c2 = { x: ox + num(), y: oy + num() };
        const to = { x: ox + num(), y: oy + num() };
        segments.push({ type: 'C', from: cur, c1, c2, to });
        nextCubic = c2;
        cur = to;
        break;
      }
      case 'S': {
        const c1 = lastCubicCtrl
          ? { x: 2 * cur.x - lastCubicCtrl.x, y: 2 * cur.y - lastCubicCtrl.y }
          : cur;
        const c2 = { x: ox + num(), y: oy + num() };
        const to = { x: ox + num(), y: oy + num() };
        segments.push({ type: 'C', from: cur, c1, c2, to });
        nextCubic = c2;
        cur = to;
        break;
      }
      case 'Q':
      case 'T': {
        const q: Point =
          upper === 'Q'
            ? { x: ox + num(), y: oy + num() }
            : lastQuadCtrl
              ? { x: 2 * cur.x - lastQuadCtrl.x, y: 2 * cur.y - lastQuadCtrl.y }
              : cur;
        const to = { x: ox + num(), y: oy + num() };
        const { c1, c2 } = quadToCubic(cur, q, to);
        segments.push({ type: 'C', from: cur, c1, c2, to });
        nextQuad = q;
        cur = to;
        break;
      }
      case 'Z': {
        segments.push({ type: 'Z', from: cur, to: start });
        cur = start;
        break;
      }
    }
    lastCubicCtrl = nextCubic;
    lastQuadCtrl = nextQuad;
  }
  return segments;
}
