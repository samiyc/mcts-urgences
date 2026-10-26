/** The page's small DOM helpers: an element, an SVG element, a text in an SVG, a select of knobs. */

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== null && value !== false && value !== undefined) node.setAttribute(key, value === true ? "" : value);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

export const svg = (tag, attrs = {}) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

export function text(x, y, content, attrs = {}) {
  const node = svg("text", { x, y, ...attrs });
  node.textContent = content;
  return node;
}

/** A `<title>` (the tooltip of an SVG element). */
export function titled(content) {
  const node = svg("title");
  node.textContent = content;
  return node;
}

export function select(name, options, current) {
  return el("select", { "data-knob": name }, ...options.map(([value, label]) => el("option", { value, selected: value === current }, label)));
}

export const fixed = (value) => Math.round(value).toLocaleString("fr-FR");
