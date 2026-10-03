// Drawing. The teaching happens here rather than in prose: two aliases either
// look identical or they do not, and the player decides that by eye in about a
// second. Nothing in this file needs the player to read anything.

const NS = "http://www.w3.org/2000/svg";

const svg = (w, h, extra = {}) => {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", `0 0 ${w} ${h}`);
  s.setAttribute("width", extra.width ?? w);
  s.setAttribute("height", extra.height ?? h);
  s.setAttribute("aria-hidden", "true");
  return s;
};

const node = (name, attrs) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

/**
 * An alias, drawn.
 *
 * Every pixel is a function of the alias bytes, so the same (person, context)
 * always produces the same picture and a different context produces one with no
 * visual relationship to it. That is the entire mechanic: the player does not
 * compare hex strings, they see "that is the same token" or "those are
 * unrelated" the way they would recognise a face.
 *
 * Mirrored left-to-right so the shapes read as objects rather than noise.
 */
export function aliasToken(bytes, size = 46) {
  const hue = (bytes[0] / 255) * 360;
  const hue2 = (hue + 40 + (bytes[1] / 255) * 60) % 360;
  const cells = 5;
  const pad = 3;
  const cell = (size - pad * 2) / cells;
  const s = svg(size, size, { width: size, height: size });
  s.classList.add("token");

  s.append(node("rect", {
    x: 0, y: 0, width: size, height: size, rx: 9,
    fill: `hsl(${hue} 55% 92%)`, stroke: `hsl(${hue} 45% 70%)`, "stroke-width": 1,
  }));

  // 15 independent cells (3 columns, mirrored), one bit each from the digest.
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < cells; row++) {
      const bit = (bytes[2 + col * cells + row] ?? 0) & 1;
      if (!bit) continue;
      const fill = ((bytes[2 + col * cells + row] >> 1) & 1)
        ? `hsl(${hue} 62% 42%)` : `hsl(${hue2} 58% 50%)`;
      for (const c of [col, cells - 1 - col]) {
        s.append(node("rect", {
          x: pad + c * cell, y: pad + row * cell,
          width: cell + 0.5, height: cell + 0.5, rx: 1.5, fill,
        }));
      }
    }
  }
  return s;
}

/** A person. The player always knows who this is; the tally never does. */
export function avatar(person, size = 38) {
  const s = svg(40, 40, { width: size, height: size });
  s.classList.add("avatar");
  s.append(node("circle", { cx: 20, cy: 20, r: 18, fill: person.color,
    stroke: "rgba(0,0,0,.18)", "stroke-width": 1 }));
  const t = node("text", {
    x: 20, y: 20, "text-anchor": "middle", "dominant-baseline": "central",
    "font-size": 15, "font-weight": 650, fill: "#fff",
    "font-family": "system-ui, sans-serif",
  });
  t.textContent = person.initial;
  s.append(t);
  if (person.disguised) {
    // Only the player sees this. It is the difference between what you know and
    // what the chain can tell, drawn.
    s.append(node("rect", { x: 6, y: 14, width: 28, height: 8, rx: 4,
      fill: "rgba(0,0,0,.62)" }));
  }
  return s;
}

/**
 * The ring.
 *
 * Twelve drawn members and a count for the rest, because the point is not how
 * many there are — it is that a verified proof lights *all* of them. Lighting
 * one member would draw the opposite of what a ring signature does.
 */
export function ringCircle(shown, ringSize, { lit = false, extra = [] } = {}) {
  const size = 190, cx = size / 2, cy = size / 2, r = 66;
  const s = svg(size, size, { width: size, height: size });
  s.classList.add("ring");
  s.append(node("circle", {
    cx, cy, r, fill: "none",
    stroke: lit ? "var(--ok)" : "var(--line)",
    "stroke-width": lit ? 2 : 1,
    "stroke-dasharray": lit ? "none" : "3 4",
  }));
  const all = [...shown, ...extra];
  all.forEach((p, i) => {
    const a = (i / all.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    const g = node("g", { transform: `translate(${x - 13} ${y - 13})` });
    const dot = node("circle", {
      cx: 13, cy: 13, r: 12, fill: p.color,
      stroke: lit ? "var(--ok)" : "rgba(0,0,0,.15)",
      "stroke-width": lit ? 2.5 : 1,
      opacity: lit ? 1 : 0.85,
    });
    g.append(dot);
    const t = node("text", {
      x: 13, y: 13, "text-anchor": "middle", "dominant-baseline": "central",
      "font-size": 11, "font-weight": 650, fill: "#fff",
      "font-family": "system-ui, sans-serif",
    });
    t.textContent = p.initial;
    g.append(t);
    if (p.disguised) g.append(node("rect", { x: 4, y: 9, width: 18, height: 5.5, rx: 2.75,
      fill: "rgba(0,0,0,.62)" }));
    s.append(g);
  });
  // Derived from what is actually drawn, not passed in. A hardcoded remainder
  // goes stale the moment the ring grows, and this app is about numbers meaning
  // exactly what they say. Omitted entirely when the whole ring is on screen —
  // "and 0 more" is noise, and it appears exactly when the ring is small enough
  // for the player to be counting the dots.
  const hidden = Math.max(0, ringSize - all.length);
  if (hidden > 0) {
    const label = node("text", {
      x: cx, y: cy - 5, "text-anchor": "middle", "font-size": 12,
      fill: "currentColor", opacity: .65, "font-family": "system-ui, sans-serif",
    });
    label.textContent = `and ${hidden} more`;
    s.append(label);
  }
  if (lit) {
    const l2 = node("text", {
      x: cx, y: cy + 13, "text-anchor": "middle", "font-size": 11.5,
      fill: "var(--ok)", "font-weight": 650, "font-family": "system-ui, sans-serif",
    });
    l2.textContent = "one of these signed";
    s.append(l2);
  }
  return s;
}
