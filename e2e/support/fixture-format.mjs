/** Pretty-print a gesture fixture with one point per line, so fixtures diff sensibly in review. */
export function formatFixture(f) {
  const gestures = f.gestures
    .map(
      (g) =>
        `    {\n      "pointerType": ${JSON.stringify(g.pointerType)},${
          g.release === false ? '\n      "release": false,' : ''
        }\n      "points": [\n${g.points.map((p) => `        ${JSON.stringify(p)}`).join(',\n')}\n      ]\n    }`
    )
    .join(',\n');
  const { gestures: _gestures, ...rest } = f;
  const head = JSON.stringify(rest, null, 2).replace(/\n}$/, '');
  return `${head},\n  "gestures": [\n${gestures}\n  ]\n}\n`;
}
