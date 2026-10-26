import { readFileSync, writeFileSync } from "node:fs";

/**
 * `npm run changelog`: the page's journal of versions (web/changelog.html, linked from the page) from its data,
 * docs/changelog.json (Sami, 26/10/2026; until then a script outside the repository wrote it). A new version is a new
 * first entry of `versions` there, with its commits; then this script, and both files are committed.
 */
const ROOT = new URL("../", import.meta.url);
const data = JSON.parse(readFileSync(new URL("docs/changelog.json", ROOT), "utf8"));

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const numClass = (i) => (i > 0 ? ' class="num"' : "");

const versionHtml = (v) => `
      <article class="version">
        <h3><span class="tag">${v.version}</span> ${esc(v.title)} <span class="date">${v.date}</span></h3>
        <ul>
          ${v.items.map((item) => `<li>${item}</li>`).join("\n          ")}
        </ul>
        <p class="commits">${v.commits.map((c) => `<code>${c}</code>`).join(" ")}</p>
      </article>`;

const cellHtml = (c, i) => `<td${numClass(i)}>${c}</td>`;
const rowHtml = (cells) => `<tr>${cells.map(cellHtml).join("")}</tr>`;

const gainsHtml = ({ gainsTitle, gainsNote, gainsHead, gainsRows }) => `      <section>
        <h2>${esc(gainsTitle)}</h2>
        <p class="hint">${gainsNote}</p>
        <div class="scroll"><table>
          <thead><tr>${gainsHead.map((h, i) => `<th${numClass(i)}>${h}</th>`).join("")}</tr></thead>
          <tbody>
          ${gainsRows.map(rowHtml).join("\n          ")}
          </tbody>
        </table></div>
      </section>`;

const page = (project) => `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Journal des versions</title>
    <link rel="stylesheet" href="style.css" />
    <link rel="stylesheet" href="changelog.css" />
  </head>
  <body>
    <header class="masthead">
      <p class="links"><a href="index.html">← ${esc(project.back)}</a></p>
      <h1>${esc(project.name)} : journal des versions</h1>
      <p>${project.intro}</p>
    </header>
    <main class="changelog">
${gainsHtml(project)}
      <section>
        <h2>Les versions</h2>
${project.versions.map(versionHtml).join("\n")}
      </section>
      <p class="hint">Le détail de chaque version, ses chiffres et ses erreurs corrigées, est dans <code>docs/modele.md</code> du dépôt ${project.repo}.</p>
    </main>
  </body>
</html>
`;

writeFileSync(new URL("web/changelog.html", ROOT), page(data));
console.log(`web/changelog.html : ${data.versions.length} versions, la dernière ${data.versions[0].version}`);
