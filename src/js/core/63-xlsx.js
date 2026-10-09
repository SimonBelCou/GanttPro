/* Classeurs Excel (.xlsx) : écriture (EF-94) et lecture des valeurs (EF-96, EX-27).
 * Écriture : chaînes en ligne, jamais de formule ; en-tête en gras, figée, avec filtre automatique.
 * Lecture : valeurs seulement ; une formule est lue comme sa dernière valeur calculée. */
const Xlsx = (() => {
  const esc = Xml.escape;
  const colName = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const colIndex = ref => { let n = 0; for (const ch of ref.replace(/[0-9]/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const sheetName = (n, i) => (String(n).replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).trim() || `Feuille${i + 1}`);

  function sheetXml(rows, widths) {
    const n = Math.max(1, ...rows.map(r => r.length));
    const cols = widths && widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const data = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      const ref = colName(ci) + (ri + 1), st = ri === 0 ? ' s="1"' : '';
      if (v === null || v === undefined || v === '') return '';
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${esc(Csv.neutralize(v))}</t></is></c>`;
    }).join('')}</row>`).join('');
    const last = colName(n - 1) + Math.max(1, rows.length);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      cols + `<sheetData>${data}</sheetData>` + (rows.length > 1 ? `<autoFilter ref="A1:${last}"/>` : '') + '</worksheet>';
  }

  /** @param {{name:string, rows:(string|number|null)[][]}[]} sheets → octets .xlsx */
  function build(sheets) {
    const names = sheets.map((s, i) => sheetName(s.name, i));
    const widthsOf = rows => {
      const n = Math.max(0, ...rows.map(r => r.length));
      return Array.from({ length: n }, (_, c) => Math.min(60, Math.max(8, ...rows.slice(0, 500).map(r => String(r[c] ?? '').length + 2))));
    };
    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets>' +
        (sheets.some(s => s.rows.length > 1) ? '<definedNames>' + names.map((n, i) => sheets[i].rows.length > 1
          ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(n.replace(/'/g, "''"))}'!$A$1:$${colName(Math.max(0, ...sheets[i].rows.map(r => r.length)) - 1)}$${sheets[i].rows.length}</definedName>` : '').join('') + '</definedNames>' : '') + '</workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
      ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s.rows, widthsOf(s.rows)) })),
    ];
    return Zip.write(files);
  }

  /** Classeur → [{name, rows}] (valeurs texte ou nombre). */
  async function read(bytes) {
    const files = await Zip.read(bytes);
    const text = name => { const b = files.get(name); return b ? new TextDecoder().decode(b) : null; };
    const wbText = text('xl/workbook.xml');
    if (!wbText) throw new Error('xlsx');
    const wb = Xml.parse(wbText);
    const rels = new Map();
    const relText = text('xl/_rels/workbook.xml.rels');
    if (relText) for (const r of Xml.children(Xml.child(Xml.parse(relText), 'Relationships'), 'Relationship')) rels.set(r.attrs.Id, r.attrs.Target);
    const shared = [];
    const ss = text('xl/sharedStrings.xml');
    if (ss) for (const si of Xml.children(Xml.child(Xml.parse(ss), 'sst'), 'si')) shared.push(Xml.deepText({ ...si, children: si.children.filter(c => c.name !== 'rPh') }));
    const sheets = [];
    for (const sh of Xml.children(Xml.child(Xml.child(wb, 'workbook'), 'sheets'), 'sheet')) {
      let target = rels.get(sh.attrs.id) || '';
      target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
      const xml = text(target);
      if (!xml) continue;
      const data = Xml.child(Xml.child(Xml.parse(xml), 'worksheet'), 'sheetData');
      const rows = [];
      for (const row of Xml.children(data, 'row')) {
        const ri = Number(row.attrs.r || rows.length + 1) - 1;
        if (ri > 5000) throw new Error('xlsx.tooMany');
        const cells = [];
        let ci = 0;
        for (const c of Xml.children(row, 'c')) {
          if (c.attrs.r) ci = colIndex(c.attrs.r);
          const tp = c.attrs.t, v = Xml.textOf(c, 'v');
          let val;
          if (tp === 's') val = shared[Number(v)] ?? '';
          else if (tp === 'inlineStr') { const is = Xml.child(c, 'is'); val = is ? Xml.deepText(is) : ''; }
          else if (tp === 'str' || tp === 'e') val = v;
          else if (tp === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
          else val = v === '' ? '' : Number(v);
          cells[ci++] = val;
        }
        rows[ri] = Array.from(cells, x => (x === undefined ? '' : x));
      }
      sheets.push({ name: sh.attrs.name || `Feuille${sheets.length + 1}`, rows: Array.from(rows, r => r || []) });
    }
    return sheets;
  }

  return { build, read, colName };
})();
