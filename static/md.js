/* ---------------------------------------------------------------
   md.js — mini lecteur Markdown, sans dépendance.

   Expose une seule fonction globale : renderMarkdown(texte) -> HTML.

   Gère : titres, gras, italique, barré, code inline, blocs de code
   (avec bouton copier), listes à puces et numérotées (imbriquées),
   citations, tableaux, liens, images, lignes horizontales.

   Sécurité : le texte est échappé AVANT toute génération de balise,
   donc du HTML renvoyé par le modèle s'affiche littéralement au lieu
   d'être exécuté. Les URL sont filtrées (http, https, mailto seulement).
   --------------------------------------------------------------- */

(function () {
  "use strict";

  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, (c) => ESCAPES[c]);
  }

  function safeUrl(url) {
    const u = url.trim();
    return /^(https?:\/\/|mailto:|\/|#)/i.test(u) ? u : "#";
  }

  // --- niveau ligne (gras, liens, code inline…) --------------------------

  // jeton de substitution du code inline : caractère de contrôle, donc
  // impossible à produire accidentellement par le texte du modèle
  const MARK = String.fromCharCode(1);
  const RE_MARK = new RegExp(MARK + "([0-9]+)" + MARK, "g");

  function inline(text) {
    // le code inline est mis de côté pour ne pas y interpréter le reste
    const codes = [];
    text = text.replace(/`([^`\n]+)`/g, (_, code) => {
      codes.push(code);
      return MARK + (codes.length - 1) + MARK;
    });

    text = text.replace(
      /!\[([^\]]*)\]\(([^)\s]+)\)/g,
      (_, alt, url) => '<img src="' + safeUrl(url) + '" alt="' + alt + '">'
    );
    text = text.replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_, label, url) =>
        '<a href="' + safeUrl(url) + '" target="_blank" rel="noopener noreferrer">' + label + "</a>"
    );

    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/(^|[\s(])__([^_]+)__/g, "$1<strong>$2</strong>");
    text = text.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    text = text.replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>");
    text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");

    return text.replace(RE_MARK, (_, i) => "<code>" + codes[i] + "</code>");
  }

  // --- briques de bloc ---------------------------------------------------

  function codeBlock(code, lang) {
    return (
      '<div class="code-block">' +
        '<div class="code-head">' +
          '<span class="code-lang">' + escapeHtml(lang || "code") + "</span>" +
          '<button class="code-copy" type="button">Copier</button>' +
        "</div>" +
        "<pre><code>" + escapeHtml(code) + "</code></pre>" +
      "</div>"
    );
  }

  const RE_FENCE   = /^\s*```(.*)$/;
  const RE_HEADING = /^(#{1,6})\s+(.*)$/;
  const RE_HR      = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
  const RE_QUOTE   = /^\s*>/;
  const RE_ITEM    = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  const RE_ALIGN   = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

  function isBlockStart(line) {
    return (
      RE_FENCE.test(line) ||
      RE_HEADING.test(line) ||
      RE_HR.test(line) ||
      RE_QUOTE.test(line) ||
      RE_ITEM.test(line)
    );
  }

  function indentOf(line) {
    return line.match(/^\s*/)[0].length;
  }

  function isOrdered(line) {
    return /^\s*\d+[.)]\s+/.test(line);
  }

  function parseList(lines, start) {
    const ordered = isOrdered(lines[start]);
    const base = indentOf(lines[start]);
    const items = [];
    let i = start;

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) {
        const next = lines[i + 1];
        if (next && RE_ITEM.test(next) && indentOf(next) >= base) { i++; continue; }
        break;
      }

      const m = line.match(RE_ITEM);
      const indent = indentOf(line);

      if (m && indent === base) {
        // "1. …" après "- …" : c'est une autre liste, on s'arrête
        if (isOrdered(line) !== ordered) break;
        items.push([m[3]]);
        i++;
      } else if (indent > base && items.length) {
        // continuation ou sous-liste : on retire l'indentation du parent
        items[items.length - 1].push(line.slice(base + 2));
        i++;
      } else {
        break;
      }
    }

    const body = items
      .map((item) => {
        const content = parseBlocks(item);
        // un seul paragraphe -> on retire le <p> pour un <li> compact
        const only = content.match(/^<p>([\s\S]*)<\/p>$/);
        return "<li>" + (only && !only[1].includes("<p>") ? only[1] : content) + "</li>";
      })
      .join("");

    return [(ordered ? "<ol>" : "<ul>") + body + (ordered ? "</ol>" : "</ul>"), i];
  }

  function parseTable(lines, start) {
    const cells = (row) =>
      row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

    const head = cells(lines[start]);
    const aligns = cells(lines[start + 1]).map((c) => {
      if (c.startsWith(":") && c.endsWith(":")) return "center";
      if (c.endsWith(":")) return "right";
      return "";
    });

    const rows = [];
    let i = start + 2;
    while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
      rows.push(cells(lines[i]));
      i++;
    }

    const attr = (k) => (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : "");
    const th = head.map((c, k) => "<th" + attr(k) + ">" + inline(escapeHtml(c)) + "</th>").join("");
    const tb = rows
      .map((r) => "<tr>" + r.map((c, k) => "<td" + attr(k) + ">" + inline(escapeHtml(c)) + "</td>").join("") + "</tr>")
      .join("");

    return [
      '<div class="table-wrap"><table><thead><tr>' + th + "</tr></thead><tbody>" + tb + "</tbody></table></div>",
      i
    ];
  }

  // --- boucle principale -------------------------------------------------

  function parseBlocks(lines) {
    let html = "";
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) { i++; continue; }

      const fence = line.match(RE_FENCE);
      if (fence) {
        const buf = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;                                   // ligne de fermeture
        html += codeBlock(buf.join("\n"), fence[1].trim());
        continue;
      }

      const heading = line.match(RE_HEADING);
      if (heading) {
        const lvl = heading[1].length;
        html += "<h" + lvl + ">" + inline(escapeHtml(heading[2])) + "</h" + lvl + ">";
        i++;
        continue;
      }

      if (RE_HR.test(line)) { html += "<hr>"; i++; continue; }

      if (RE_QUOTE.test(line)) {
        const buf = [];
        while (i < lines.length && RE_QUOTE.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        html += "<blockquote>" + parseBlocks(buf) + "</blockquote>";
        continue;
      }

      if (line.includes("|") && i + 1 < lines.length && RE_ALIGN.test(lines[i + 1])) {
        const [tableHtml, next] = parseTable(lines, i);
        html += tableHtml;
        i = next;
        continue;
      }

      if (RE_ITEM.test(line)) {
        const [listHtml, next] = parseList(lines, i);
        html += listHtml;
        i = next;
        continue;
      }

      // paragraphe : les retours à la ligne simples deviennent des <br>
      const buf = [];
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      html += "<p>" + inline(escapeHtml(buf.join("\n"))).replace(/\n/g, "<br>") + "</p>";
    }

    return html;
  }

  window.renderMarkdown = function (src) {
    return parseBlocks(String(src == null ? "" : src).replace(/\r\n?/g, "\n").split("\n"));
  };
})();
