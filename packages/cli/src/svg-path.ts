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
