/* CSV et texte tabulé (EF-93, RG-30, EX-21). */
const Csv = (() => {
  /** EX-21 : une cellule de texte qui commence par =, +, -, −, @, tabulation ou retour chariot est
   * précédée d'une apostrophe, pour qu'un tableur ne l'exécute jamais comme une formule. */
  function neutralize(v) {
    const s = String(v ?? '');
    return /^[=+\-−@\t\r]/.test(s) ? "'" + s : s;
  }

  /** Lignes → texte CSV (UTF-8 avec BOM, séparateur « ; », fins de ligne CRLF). Les nombres restent nus. */
  function write(rows, sep = ';', bom = true) {
    const cell = v => {
      if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
      const s = neutralize(v);
      return /["\n\r]/.test(s) || s.includes(sep) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return (bom ? '﻿' : '') + rows.map(r => r.map(cell).join(sep)).join('\r\n') + '\r\n';
  }

  /** Séparateur reconnu sur la première ligne non vide, hors guillemets : « ; », « , » ou tabulation. */
  function detect(text) {
    const line = text.split(/\r?\n/).find(l => l.trim()) || '';
    let best = ';', n = -1;
    for (const sep of [';', '\t', ',']) {
      let c = 0, q = false;
      for (const ch of line) { if (ch === '"') q = !q; else if (ch === sep && !q) c++; }
      if (c > n) { n = c; best = sep; }
    }
    return best;
  }

  /** Texte → lignes (RFC 4180 : guillemets doublés, champs multilignes). BOM retiré. */
  function parse(text, sep = null, maxRows = 5000) {
    let s = String(text);
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
    const d = sep || detect(s);
    const rows = [];
    let row = [], f = '', q = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) {
        if (ch === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += ch;
      } else if (ch === '"' && f === '') q = true;
      else if (ch === d) { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && s[i + 1] === '\n') i++;
        row.push(f); f = '';
        rows.push(row); row = [];
        if (rows.length > maxRows) throw new Error('csv.tooMany');
      } else f += ch;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return { rows: rows.filter(r => r.some(c => c.trim() !== '')), sep: d };
  }

  return { neutralize, write, parse, detect };
})();
