/* Rapport d'état (EF-88, RG-28) : aperçu, choix des blocs, note, impression ou PDF, texte brut.
 * Le voyant est toujours écrit en toutes lettres (jamais la couleur seule, EX-03). */
const Report = { blocks: { kpis: true, curve: true, late: true, soon: true, milestones: true, critical: true, alerts: true, baseline: true, note: true }, baseline: '' };
const REPORT_BLOCKS = ['kpis', 'curve', 'late', 'soon', 'milestones', 'critical', 'alerts', 'baseline', 'note'];

function reportData() {
  const today = Dates.todayDn();
  const bl = App.project.baselines.find(b => b.id === Report.baseline) || null;
  return { today, bl, r: Metrics.report(App.project, App.sched, today, bl) };
}
const taskLabel = id => { const x = taskById(id); return x ? `${id} ${x.name}` : id; };

/** Contenu du rapport sous forme de sections {title, lines[]} : sert à l'aperçu ET au texte brut. */
function reportSections() {
  const { today, bl, r } = reportData();
  const s = App.sched;
  const out = [];
  const B = Report.blocks;
  out.push({ key: 'head', title: `${App.project.emoji} ${App.project.name}`, lines: [
    t('rep.date', { date: I18n.date(today) }),
    t('rep.light', { light: t('rep.light.' + r.light) }) + (r.drift != null && bl ? ' — ' + t('rep.drift', { name: bl.name, days: r.drift > 0 ? '+' + r.drift : String(r.drift) }) : ''),
  ] });
  if (B.kpis) out.push({ key: 'kpis', title: t('rep.kpis'), lines: [
    t('rep.progress', { real: I18n.number(r.progress), planned: I18n.number(r.planned), gap: (r.gap >= 0 ? '+' : '') + I18n.number(r.gap) }),
    t('rep.counters', { done: r.counters.done, ongoing: r.counters.ongoing, late: r.counters.late, total: r.counters.total }),
    t('rep.end', { date: I18n.date(s.projectEndDn) }),
  ] });
  if (B.curve) out.push({ key: 'curve', title: t('dash.curve'), lines: [], chart: true });
  if (B.late) out.push({ key: 'late', title: t('rep.late'), lines: r.late.length ? r.late.map(x => `${taskLabel(x.id)} — ${t('dash.dev')} ${signed(x.dev)}`) : [t('rep.none')] });
  if (B.soon) out.push({ key: 'soon', title: t('rep.soon'), lines: r.soon.length ? r.soon.map(id => `${I18n.shortDate(s.tasks.get(id).startDn)} — ${taskLabel(id)}`) : [t('rep.none')] });
  if (B.milestones) out.push({ key: 'milestones', title: t('rep.milestones'), lines: [
    ...r.msPast.map(id => `✓ ${I18n.shortDate(s.tasks.get(id).startDn)} — ${taskLabel(id)} (${t('status.done')})`),
    ...r.msNext.map(id => `◇ ${I18n.shortDate(s.tasks.get(id).startDn)} — ${taskLabel(id)}`),
  ].concat(r.msPast.length || r.msNext.length ? [] : [t('rep.none')]) });
  if (B.critical) out.push({ key: 'critical', title: t('kpi.critical'), lines: r.critical.length ? [r.critical.join(' → ')] : [t('rep.none')] });
  if (B.alerts) { const a = alertMessages(); out.push({ key: 'alerts', title: t('alerts.label'), lines: a.length ? a.map(m => '⚠ ' + m.text) : [t('rep.none')] }); }
  if (B.baseline && bl) out.push({ key: 'baseline', title: t('rep.vsBaseline', { name: bl.name }), lines: [t('rep.drift', { name: bl.name, days: r.drift > 0 ? '+' + r.drift : String(r.drift) })] });
  if (B.note && App.project.reportNote) out.push({ key: 'note', title: t('rep.note'), lines: App.project.reportNote.split('\n') });
  return out;
}

function reportArticle() {
  const art = h('article', { class: 'report-page', id: 'report-preview', aria: { label: t('rep.preview') } });
  const { r } = reportData();
  for (const sec of reportSections()) {
    const el = h('section', { class: 'rep-sec rep-' + sec.key },
      sec.key === 'head' ? h('h3', { class: 'rep-title', text: sec.title }) : h('h4', { text: sec.title }));
    if (sec.key === 'head') el.prepend(h('span', { class: 'voyant ' + r.light, aria: { hidden: 'true' }, text: { red: '■', orange: '▲', green: '●' }[r.light] }));
    if (sec.chart) {
      const curve = Metrics.sCurve(App.project, App.sched, Dates.todayDn(), 'week');
      const c = sCurveChart(curve);
      c.removeAttribute('tabindex');
      el.append(c);
    }
    if (sec.lines.length) el.append(h('ul', {}, sec.lines.map(l => h('li', { text: l }))));
    art.append(el);
  }
  return art;
}

function reportText() {
  return reportSections().map(sec => [sec.key === 'head' ? sec.title.toUpperCase() : `\n${sec.title}`, ...sec.lines.map(l => (sec.key === 'head' ? l : `- ${l}`))].join('\n')).join('\n');
}

function paintReport(body, focusSel) {
  clear(body);
  const opts = h('div', { class: 'rep-options' },
    h('fieldset', { class: 'sub' }, h('legend', { text: t('rep.blocks') }),
      REPORT_BLOCKS.map(k => h('div', { class: 'check' }, h('input', { type: 'checkbox', id: 'rb-' + k, checked: Report.blocks[k], data: { change: 'repBlock', arg: k } }),
        h('label', { for: 'rb-' + k, text: t('rep.b.' + k) })))),
    h('div', { class: 'field' }, h('label', { for: 'rep-bl', text: t('rep.baseline') }),
      h('select', { id: 'rep-bl', data: { change: 'repBaseline' } }, h('option', { value: '' }, t('dash.noBl')),
        App.project.baselines.map(b => h('option', { value: b.id, selected: Report.baseline === b.id }, b.name)))),
    h('div', { class: 'field' }, h('label', { for: 'rep-note', text: t('rep.note') }),
      h('textarea', { id: 'rep-note', rows: 4, maxlength: 2000, text: App.project.reportNote, data: { change: 'repNote' } })),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'primary', data: { click: 'repPrint' } }, t('rep.print')),
      h('button', { type: 'button', data: { click: 'repCopy' } }, t('rep.copy'))));
  body.append(h('div', { class: 'rep-layout' }, opts, reportArticle()));
  const el = focusSel && body.querySelector(focusSel);
  if (el) el.focus();
}

function reportWindow() {
  if (!App.sched) return;
  if (Report.baseline && !App.project.baselines.some(b => b.id === Report.baseline)) Report.baseline = '';
  const body = h('div', { id: 'rep-win' });
  reportWindow.body = body;
  paintReport(body);
  return Dialog.open({ title: t('rep.title'), body: [body], size: 'wide', actions: [{ label: t('dlg.close'), value: 'close' }] }).then(() => { reportWindow.body = null; });
}

/** Impression : le contenu est copié dans #print-area, seul visible à l'impression (EX-26). */
function printNode(node, cls, pageRule) {
  const area = clear($('print-area'));
  area.append(node);
  area.hidden = false;
  document.body.classList.add('printing', cls);
  const sheet = document.styleSheets[0];
  let ruleIndex = -1;
  // Feuille de style via le CSSOM (autorisé par la CSP) ; textes échappés pour une chaîne CSS.
  const cssStr = v => '"' + String(v).replace(/[\\"]/g, '\\$&').replace(/[\n\r]/g, ' ') + '"';
  try {
    ruleIndex = sheet.insertRule(`@page { size: ${pageRule}; margin: 12mm; @top-left { content: ${cssStr(App.project.name)}; } @top-right { content: ${cssStr(I18n.date(Dates.todayDn()))}; } @bottom-right { content: counter(page) " / " counter(pages); } }`, sheet.cssRules.length);
  } catch {
    try { ruleIndex = sheet.insertRule(`@page { size: ${pageRule}; margin: 12mm; }`, sheet.cssRules.length); } catch { ruleIndex = -1; }
  }
  const done = () => {
    document.body.classList.remove('printing', cls);
    area.hidden = true; clear(area);
    if (ruleIndex >= 0) try { sheet.deleteRule(ruleIndex); } catch { /* règle déjà retirée */ }
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
  // Certains navigateurs n'émettent pas afterprint : nettoyage de secours.
  setTimeout(() => { if (document.body.classList.contains('printing')) done(); }, 1500);
}

function copyText(text) {
  const fallback = () => {
    const ta = h('textarea', { class: 'sr-only', aria: { hidden: 'true' } });
    ta.value = text; document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  };
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => fallback());
  return Promise.resolve(fallback());
}

action('openReport', () => reportWindow());
action('repBlock', (k, el) => { Report.blocks[k] = el.checked; paintReport(reportWindow.body, '#rb-' + k); });
action('repBaseline', (a, el) => { Report.baseline = el.value; paintReport(reportWindow.body, '#rep-bl'); });
action('repNote', (a, el) => { const v = el.value.slice(0, 2000); if (v !== App.project.reportNote) commit(p => { p.reportNote = v; }); paintReport(reportWindow.body, '#rep-note'); });
action('repPrint', () => printNode(reportArticle(), 'print-report', 'A4 portrait'));
action('repCopy', async () => { const ok = await copyText(reportText()); announce(t(ok ? 'rep.copied' : 'rep.copyFail')); toast(t(ok ? 'rep.copied' : 'rep.copyFail')); });
