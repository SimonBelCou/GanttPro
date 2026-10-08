/* Infobulle des barres (EF-23) : au survol ET au focus clavier ; Échap la ferme.
 * Contenu en texte seul (textContent) ; position par le CSSOM. Les mêmes informations sont dans
 * le nom accessible de la barre et dans le panneau d'édition. */
const Tooltip = (() => {
  let current = null;

  function lines(task) {
    const s = App.sched, r = s && s.tasks.get(task.id);
    if (!r || r.empty) return [];
    const out = [`${task.id} — ${task.name}`];
    out.push(`${t('tip.planned')} : ${I18n.date(r.startDn)} → ${I18n.date(r.endDn)} (${durText(task, r)})`);
    if (task.realStart || task.realEnd) out.push(`${t('tip.real')} : ${task.realStart ? I18n.date(Dates.parse(task.realStart)) : '…'} → ${task.realEnd ? I18n.date(Dates.parse(task.realEnd)) : '…'}`);
    const st = Metrics.status(task, s, Dates.todayDn());
    out.push(`${t('f.pct')} : ${Metrics.pctOf(task, s)} % — ${st ? t('status.' + st) : ''}`);
    if (task.deps.length) out.push(`${t('f.deps')} : ${depsText(task)}`);
    if (task.type === 'task') out.push(`${t('col.res')} : ${resText(task) || t('list.noRes')}`);
    if (r.shift) out.push(shiftText(r));
    if (task.type !== 'summary') out.push(`${t('tip.slack')} : ${r.slack}${r.critical ? ' — ' + t('list.critical') : ''}`);
    for (const b of baselineTexts(task.id)) out.push(b);
    return out;
  }

  function show(el) {
    const task = taskById(el.dataset.arg);
    if (!task) return;
    const tip = $('tooltip');
    clear(tip);
    for (const l of lines(task)) tip.append(h('div', { text: l }));
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth, hgt = tip.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
    const top = r.bottom + 8 + hgt > window.innerHeight ? r.top - hgt - 8 : r.bottom + 8;
    tip.style.setProperty('left', left + 'px');
    tip.style.setProperty('top', Math.max(8, top) + 'px');
    el.setAttribute('aria-describedby', 'tooltip');
    current = el;
  }
  function hide() {
    $('tooltip').hidden = true;
    if (current) current.removeAttribute('aria-describedby');
    current = null;
  }
  const target = ev => ev.target.closest && ev.target.closest('#gantt .bar, #gantt .ms[data-arg], #gantt .sbar');

  function init() {
    document.addEventListener('mouseover', ev => { const el = target(ev); if (el && el !== current) show(el); else if (!el && current && !current.contains(document.activeElement)) hide(); });
    document.addEventListener('focusin', ev => { const el = target(ev); if (el) show(el); else hide(); });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && current) { hide(); ev.stopPropagation(); } }, true);
  }
  return { init, hide };
})();
