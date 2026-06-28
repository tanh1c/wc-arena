function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isSafeHref(href: string) {
  return href.startsWith('https://') || href.startsWith('http://') || href.startsWith('/');
}

function formatInlineNoLinks(value: string) {
  const codeTokens: string[] = [];
  let html = escapeHtml(value).replace(/`([^`\n]+)`/g, (_, code: string) => {
    const token = `@@CODE_${codeTokens.length}@@`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });

  html = html
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  codeTokens.forEach((code, index) => {
    html = html.replaceAll(`@@CODE_${index}@@`, code);
  });

  return html;
}

function formatInline(value: string) {
  const linkPattern = /\[([^\]\n]+)]\(((?:[^()\s]+|\([^)\n]*\))+)\)/g;
  let html = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(value)) !== null) {
    const [raw, label, href] = match;
    html += formatInlineNoLinks(value.slice(lastIndex, match.index));

    if (isSafeHref(href)) {
      html += `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${formatInlineNoLinks(label)}</a>`;
    } else {
      html += formatInlineNoLinks(label);
    }

    lastIndex = match.index + raw.length;
  }

  html += formatInlineNoLinks(value.slice(lastIndex));
  return html;
}

function renderList(items: string[], ordered: boolean) {
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag} class="agent-md-list">${items.map((item) => `<li>${formatInline(item)}</li>`).join('')}</${tag}>`;
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replaceAll('\\|', '|').trim());
}

function isTableDivider(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function renderTable(lines: string[]) {
  const [headerLine, , ...bodyLines] = lines;
  const headers = splitTableRow(headerLine);
  const rows = bodyLines.map(splitTableRow);
  return `<div class="agent-md-table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${formatInline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${formatInline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function renderAgentMarkdown(markdown: string) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let unorderedItems: string[] = [];
  let orderedItems: string[] = [];
  let tableLines: string[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${formatInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function flushLists() {
    if (unorderedItems.length > 0) {
      blocks.push(renderList(unorderedItems, false));
      unorderedItems = [];
    }
    if (orderedItems.length > 0) {
      blocks.push(renderList(orderedItems, true));
      orderedItems = [];
    }
  }

  function flushTable() {
    if (tableLines.length > 0) {
      blocks.push(renderTable(tableLines));
      tableLines = [];
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.trim().startsWith('```')) {
      flushParagraph();
      flushLists();
      flushTable();
      if (inCodeBlock) {
        blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushLists();
      flushTable();
      continue;
    }

    if (line.includes('|') && (tableLines.length > 0 || isTableDivider(lines[index + 1] ?? '') || isTableDivider(line))) {
      flushParagraph();
      flushLists();
      tableLines.push(line);
      continue;
    }

    flushTable();

    const unorderedMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (orderedItems.length > 0) flushLists();
      unorderedItems.push(unorderedMatch[1]);
      continue;
    }

    const orderedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (unorderedItems.length > 0) flushLists();
      orderedItems.push(orderedMatch[1]);
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushLists();
      const level = headingMatch[1].length + 1;
      blocks.push(`<h${level} class="agent-md-heading">${formatInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    flushLists();
    paragraph.push(line.trim());
  }

  if (inCodeBlock) {
    blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }
  flushParagraph();
  flushLists();
  flushTable();

  return blocks.join('');
}
