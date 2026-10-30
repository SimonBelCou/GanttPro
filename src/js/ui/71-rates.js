/* Profils de coût et taux des ressources (étape C, EF-147 à EF-150, RG-54 à RG-58).
 * Un profil porte un taux moyen par jour ouvré, fixé par la comptabilité ; une ressource peut avoir son propre taux
 * (prestataire externe). Un taux peut changer en cours de projet : des lignes « à partir du ». Un taux est un montant :
 * il suit le masquage à l'écran (saisie désactivée) et la case « Inclure les montants » des fichiers. */

const pdText = hundredths => t('rt.pd', { n: I18n.number(hundredths / 100, hundredths % 100 ? (hundredths % 10 ? 2 : 1) : 0) });

/** Phrase traduite qui contient un montant ({amount}) : le montant est un nœud, masquable (RG-41). */
function amountSentence(key, params, cents) {
  const [before, after = ''] = t(key, { ...params, amount: '\u0001' }).split('\u0001');
  return [before, Money.node(cents), after];
}

/** Taux en vigueur aujourd'hui pour une ressource : { cents|null, source:'own'|'profile'|'none' }. */
function rateToday(r) {
  const lines = Rates.linesOf(App.project, r);
  return { cents: lines.length ? Rates.rateOn(lines, Dates.todayDn()) : null, source: Rates.sourceOf(App.project, r) };
}

/** Texte du taux du jour d'une ressource, ou « sans taux ». */
function rateTodayNode(r) {
  const { cents, source } = rateToday(r);
  if (cents == null) return h('span', { class: 'hint', text: t('rt.noRate') });
  return h('span', {}, Money.node(cents), ' ', h('span', { class: 'hint', text: `(${t(source === 'own' ? 'rt.srcOwn' : 'rt.srcProfile')})` }));
}

/** Les vues ouvertes qui montrent des taux ou des coûts sont redessinées après une modification. */
function refreshRateViews() {
  if (profilesWindow.paint) profilesWindow.paint();
  if (resourcesWindow.paint) resourcesWindow.paint();
  if (resourceSheet.body) paintResourceSheet(resourceSheet.body, resourceSheet.id);
  if (typeof repaintDashboard === 'function') repaintDashboard();
}

/** Propriétaire d'une liste de lignes de taux : un profil ('p') ou une ressource ('r', taux nominatif). */
function rateOwner(kind, id) {
  return kind === 'p' ? (App.project.profiles || []).find(x => x.id === id) : resById(id);
}

/**
 * Éditeur des lignes de taux d'un propriétaire (EF-148). La ligne sans date vaut « depuis le début » ; les autres
 * s'appliquent à partir de leur date. Saisie désactivée quand les montants sont masqués.
 */
function rateLinesEditor(kind, id, label) {
  const owner = rateOwner(kind, id), key = kind + id, masked = Money.masked(), lang = I18n.getLang();
  const box = h('fieldset', { class: 'sub', id: 'rl-' + key }, h('legend', { text: t('rt.lines') }));
  if (masked) box.append(h('p', { class: 'note', text: t('rt.maskedLines') }));
  const list = h('ul', { class: 'rows' });
  owner.rates.forEach((l, i) => {
    const when = l.from === '' ? t('rt.fromStart') : I18n.date(Dates.parse(l.from));
    const arg = f => `${kind}:${id}:${i}:${f}`;
    const from = l.from === ''
      ? h('span', { class: 'who', text: t('rt.fromStart') })
      : h('span', { class: 'who' }, h('label', { for: `rl-${key}-from-${i}`, text: t('rt.from') + ' ' }),
        h('input', { type: 'date', id: `rl-${key}-from-${i}`, value: l.from, min: '1970-01-01', max: '2199-12-31', disabled: masked,
          aria: { label: `${t('rt.from')} (${label})`, describedby: 'rl-err-' + key }, data: { change: 'rlField', arg: arg('from') } }));
    const rate = h('input', { type: 'text', id: `rl-${key}-rate-${i}`, inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', maxlength: 20, disabled: masked,
      value: masked ? Money.DOTS : Budget.toInput(l.rate, lang), aria: { label: `${t('rt.rate')} (${label}, ${when}) (${Money.symbol()})`, describedby: 'rl-err-' + key }, data: { change: 'rlField', arg: arg('rate') } });
    list.append(h('li', {}, from, rate,
      h('button', { type: 'button', class: 'icon', disabled: masked, data: { click: 'rlRemove', arg: `${kind}:${id}:${i}` }, aria: { label: t('rt.removeLine', { name: `${label}, ${when}` }) } }, '✕')));
  });
  box.append(list, h('p', { class: 'field-error', id: 'rl-err-' + key, role: 'alert', hidden: true }));
  if (owner.rates.length < Model.LIMITS.rateLines) {
    box.append(h('button', { type: 'button', id: `rl-${key}-add`, disabled: masked, data: { click: 'rlAdd', arg: `${kind}:${id}` } }, t('rt.addLine')));
  }
  return box;
}

function rlError(key, msg, el) {
  const e = $('rl-err-' + key);
  if (e) { e.textContent = msg; e.hidden = false; }
  if (el) el.setAttribute('aria-invalid', 'true');
  announce(msg);
  if (el) el.focus();
}

/** Applique de nouvelles lignes à un propriétaire (contrôle commun avec l'import) ; renvoie les lignes triées ou null. */
function rlApply(kind, id, key, lines, focusEl) {
  const norm = Rates.normalize(lines);
  if (!norm.ok) {
    const msg = norm.reason === 'dup' ? t('rt.errDup') : norm.reason === 'max' ? t('rt.errMax', { max: Model.LIMITS.rateLines }) : t('rt.errDate');
    rlError(key, msg, focusEl); return null;
  }
  commit(p => { (kind === 'p' ? p.profiles.find(x => x.id === id) : p.resources.find(x => x.id === id)).rates = norm.lines; });
  return norm.lines;
}

action('rlField', (arg, el) => {
  const [kind, id, idx, field] = arg.split(':'), i = Number(idx), key = kind + id, owner = rateOwner(kind, id);
  if (!owner || !owner.rates[i] || Money.masked()) return;
  const e = $('rl-err-' + key); if (e) e.hidden = true;
  el.removeAttribute('aria-invalid');
  const lines = owner.rates.map(l => ({ ...l }));
  if (field === 'rate') {
    const r = Budget.parse(el.value, Money.symbol());
    if (!r.ok) return rlError(key, t('err.amount.' + r.reason, { field: t('rt.rate'), max: Budget.format(Model.LIMITS.rate, { lang: I18n.getLang(), symbol: Money.symbol() }) }), el);
    if (r.cents > Model.LIMITS.rate) return rlError(key, t('err.amount.max', { field: t('rt.rate'), max: Budget.format(Model.LIMITS.rate, { lang: I18n.getLang(), symbol: Money.symbol() }) }), el);
    lines[i].rate = r.cents;
  } else {
    if (Dates.parse(el.value) == null) return rlError(key, t('rt.errDate'), el);
    lines[i].from = el.value;
  }
  const done = rlApply(kind, id, key, lines, el);
  if (!done) return;
  refreshRateViews();
  const j = done.findIndex(l => l.from === lines[i].from && l.rate === lines[i].rate);
  const target = document.getElementById(`rl-${key}-${field}-${Math.max(0, j)}`);
  if (target) target.focus();
});

action('rlAdd', arg => {
  const [kind, id] = arg.split(':'), key = kind + id, owner = rateOwner(kind, id);
  if (!owner || Money.masked()) return;
  // Première ligne : depuis le début. Suivantes : un jour libre à partir d'aujourd'hui, au dernier taux connu.
  const used = new Set(owner.rates.map(l => l.from));
  let from = '';
  if (owner.rates.length) { let dn = Dates.todayDn(); while (used.has(Dates.toISO(dn))) dn++; from = Dates.toISO(dn); }
  const last = owner.rates.length ? owner.rates[owner.rates.length - 1].rate : 0;
  const done = rlApply(kind, id, key, [...owner.rates.map(l => ({ ...l })), { from, rate: last }], $(`rl-${key}-add`));
  if (!done) return;
  refreshRateViews();
  const j = done.findIndex(l => l.from === from);
  const target = document.getElementById(`rl-${key}-${from === '' ? 'rate' : 'from'}-${Math.max(0, j)}`);
  if (target) target.focus();
});

action('rlRemove', arg => {
  const [kind, id, idx] = arg.split(':'), i = Number(idx), key = kind + id, owner = rateOwner(kind, id);
  if (!owner || !owner.rates[i] || Money.masked()) return;
  commit(p => { (kind === 'p' ? p.profiles.find(x => x.id === id) : p.resources.find(x => x.id === id)).rates.splice(i, 1); });
  refreshRateViews();
  const next = document.getElementById(`rl-${key}-add`) || document.getElementById(`rl-${key}`);
  if (next) next.focus();
});

/* ---------- Fenêtre « Profils de coût » (EF-147) ---------- */

function profilesWindow() {
  const body = h('div', { id: 'prof-win' });
  const paint = () => {
    const keep = document.activeElement && body.contains(document.activeElement) ? document.activeElement.id : '';
    clear(body);
    body.append(h('p', { class: 'hint', text: t('rt.intro') }));
    const profiles = App.project.profiles || [];
    profiles.forEach(pf => {
      const used = App.project.resources.filter(r => r.profile === pf.id).length;
      const nameIn = h('input', { type: 'text', id: 'prof-name-' + pf.id, value: pf.name, maxlength: 100, aria: { label: `${t('rt.name')} (${pf.name})`, describedby: 'perr-' + pf.id }, data: { change: 'profName', arg: pf.id } });
      body.append(h('section', { class: 'prof-card', aria: { label: pf.name } },
        h('div', { class: 'field' }, h('label', { for: 'prof-name-' + pf.id, text: t('rt.name') }), nameIn, h('p', { class: 'field-error', id: 'perr-' + pf.id, hidden: true })),
        rateLinesEditor('p', pf.id, pf.name),
        h('p', { class: 'hint', text: t('rt.usedBy', { count: used }) }),
        h('button', { type: 'button', class: 'danger', data: { click: 'profDelete', arg: pf.id } }, t('rt.delete', { name: pf.name }))));
    });
    if (profiles.length < Model.LIMITS.profiles) body.append(h('button', { type: 'button', id: 'prof-add', data: { click: 'profAdd' } }, t('rt.add')));
    const again = keep && document.getElementById(keep); if (again) again.focus();
  };
  profilesWindow.paint = paint;
  paint();
  return Dialog.open({ title: t('rt.title'), body: [body], size: 'wide', actions: [{ label: t('dlg.close'), value: 'close', kind: 'primary' }] })
    .then(() => {
      profilesWindow.paint = null;
      if (resourcesWindow.paint) { resourcesWindow.paint(); const b = $('btn-profiles'); if (b) b.focus(); } // le bouton a été redessiné : le focus lui revient
    });
}

action('openProfiles', () => profilesWindow());

action('profAdd', () => {
  const list = App.project.profiles || [];
  if (list.length >= Model.LIMITS.profiles) { Dialog.message(t('rt.title'), t('err.limit', { max: Model.LIMITS.profiles, what: t('rt.title').toLowerCase() })); return; }
  let n = list.length + 1, name;
  do { name = `${t('rt.new')} ${n++}`; } while (nameError(list, '', name, ''));
  let k = 1; while (list.some(x => x.id === 'P' + k)) k++;
  commit(p => { p.profiles = p.profiles || []; p.profiles.push({ id: 'P' + k, name, rates: [] }); });
  refreshRateViews();
  const inp = $('prof-name-P' + k); if (inp) { inp.focus(); inp.select(); }
});

action('profName', (id, el) => {
  const err = $('perr-' + id), list = App.project.profiles;
  if (err) err.hidden = true; el.removeAttribute('aria-invalid');
  const e = nameError(list, id, el.value, t('rt.name'));
  if (e) { err.textContent = e; err.hidden = false; el.setAttribute('aria-invalid', 'true'); announce(e); el.focus(); return; }
  commit(p => { p.profiles.find(x => x.id === id).name = el.value.trim(); });
  refreshRateViews();
});

action('profDelete', async id => {
  const pf = (App.project.profiles || []).find(x => x.id === id);
  if (!pf) return;
  const used = App.project.resources.filter(r => r.profile === id).length;
  const ok = await Dialog.confirm(t('rt.deleteTitle', { name: pf.name }), [used ? t('rt.deleteUsed', { count: used }) : ''], t('edit.delete'));
  if (!ok) return;
  commit(p => { p.profiles = p.profiles.filter(x => x.id !== id); for (const r of p.resources) if (r.profile === id) r.profile = ''; });
  refreshRateViews();
  const add = $('prof-add'); if (add) add.focus();
});

/* ---------- Dans la fenêtre Ressources et la fiche d'une ressource ---------- */

/** Liste déroulante du profil d'une ressource. */
function profileSelect(r, idAttr) {
  const sel = h('select', { id: idAttr, aria: { label: `${t('rt.profile')} (${r.name})` }, data: { change: 'resProfile', arg: r.id } },
    h('option', { value: '', selected: !r.profile }, t('rt.none')),
    (App.project.profiles || []).map(pf => h('option', { value: pf.id, selected: pf.id === r.profile }, pf.name)));
  return sel;
}

action('resProfile', (id, el) => {
  const r = resById(id);
  if (!r || (el.value && !(App.project.profiles || []).some(x => x.id === el.value))) return;
  commit(() => { r.profile = el.value; });
  refreshRateViews();
  // La liste modifiée peut être celle de la fiche ou celle de la fenêtre Ressources : on cherche dans la fenêtre du dessus.
  const top = [...document.querySelectorAll('dialog[open]')].pop();
  const again = top && top.querySelector(`[data-change="resProfile"][data-arg="${CSS.escape(id)}"]`); if (again) again.focus();
});

action('rsOwnClear', id => {
  const r = resById(id);
  if (!r || !r.rates.length || Money.masked()) return;
  commit(() => { r.rates = []; });
  refreshRateViews();
});

/** Rubrique « Coût des ressources » de la fiche d'une ressource : profil, taux nominatif, jours-personne et coût. */
function resourceCostSection(r, costs) {
  const box = h('fieldset', { class: 'sub', id: 'rs-cost' }, h('legend', { text: t('rs.costTitle') }));
  box.append(h('div', { class: 'field' }, h('label', { for: 'rs-profile', text: t('rt.profile') }), profileSelect(r, 'rs-profile')));
  box.append(h('p', {}, t('rt.rateCol'), ' : ', rateTodayNode(r)));
  box.append(h('p', { class: 'hint', text: t('rt.own.hint') }), rateLinesEditor('r', r.id, r.name));
  if (r.rates.length) box.append(h('button', { type: 'button', disabled: Money.masked(), data: { click: 'rsOwnClear', arg: r.id } }, t('rt.own.clear')));
  const c = costs.byRes.get(r.id);
  box.append(h('p', { id: 'rs-cost-total' }, `${t('rs.pd')} : ${pdText(c.pd)} · ${t('rs.cost')} : `, Money.node(c.cents), c.unrated ? ` — ${t('rt.partial', { count: c.unrated })}` : ''));
  return box;
}
