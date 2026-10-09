/* Copier-coller (EF-83) : Ctrl + C copie la sélection en mémoire (avec ses liens internes) ET en
 * texte tabulé ; Ctrl + V colle après la sélection, soit la copie mémoire, soit un texte tabulé
 * venant d'un tableur (RG-30, même compte rendu d'erreurs qu'EF-96). */
App.clipboard = null;
// Sans ligne d'en-tête, un collage depuis un tableur se lit : nom, durée, prédécesseurs, ressources,
// catégorie, avancement, étiquettes (ordre documenté dans le guide).
const CLIP_COLS = ['name', 'dur', 'deps', 'res', 'cat', 'pct', 'tags'];

function clipboardTsv(ids) {
  const p = App.project;
  const head = [t('xp.id'), t('xp.name'), t('xp.dur'), t('xp.deps'), t('xp.res'), t('xp.cat'), t('xp.pct'), t('xp.tags')];
  const rows = ids.map(id => {
    const x = taskById(id);
    const cat = (p.categories.find(c => c.id === x.cat) || { name: '' }).name;
    const res = x.assign.map(a => (resById(a.res) || { name: '' }).name + (a.units !== 100 ? ` ${a.units} %` : '')).join('; ');
    return [x.id, x.name, x.type === 'task' ? x.dur : 0, depsText(x).replace(/, /g, '; '), res, cat, x.pct, x.tags.join('; ')];
  });
  return Csv.write([head, ...rows], '\t', false).replace(/\r\n$/, '');
}

function pasteInternal(clip) {
  const p = App.project;
  if (p.tasks.length + clip.tasks.length > Model.LIMITS.tasks) { Dialog.message(t('clip.paste'), t('err.limit', { max: Model.LIMITS.tasks, what: 'tâches' })); return; }
  const anchor = selectedIds().slice(-1)[0];
  const used = p.tasks.map(x => x.id), map = new Map();
  for (const x of clip.tasks) { const id = Model.nextTaskId(used); used.push(id); map.set(x.id, id); }
  const exists = id => p.tasks.some(y => y.id === id);
  const copies = clip.tasks.map(x => ({
    ...clone(x), id: map.get(x.id), parent: map.get(x.parent) || (anchor ? (taskById(anchor).type === 'summary' ? '' : taskById(anchor).parent) : ''),
    deps: x.deps.map(d => ({ ...d, id: map.get(d.id) || d.id })).filter(d => map.has(d.id) || [...map.values()].includes(d.id) || exists(d.id)),
    pct: 0, realStart: '', realEnd: '', comments: [],
    assign: x.assign.filter(a => resById(a.res)), cat: catById(x.cat) ? x.cat : '',
  }));
  const trial = clone(p);
  const at = anchor ? trial.tasks.indexOf(trial.tasks.find(y => y.id === anchor)) + 1 + descendants(anchor, trial.tasks).length : trial.tasks.length;
  trial.tasks.splice(at, 0, ...copies);
  normalizeOrder(trial);
  try { Model.sanitize(Model.serialize(trial)); } catch (e) { Dialog.message(t('clip.paste'), e instanceof Model.Invalid ? I18n.error(e) : t('imp.unreadable')); return; }
  commit(q => { q.tasks.splice(at, 0, ...clone(copies)); });
  App.multi = new Set(copies.map(c => c.id));
  render();
  announce(t('clip.pasted', { count: copies.length }));
}

async function pasteText(text) {
  const { rows } = Csv.parse(text, '\t');
  if (!rows.length) return;
  let map = Exchange.guessMapping(rows[0]);
  let header = map.name !== undefined;
  if (!header) { map = {}; CLIP_COLS.forEach((f, i) => { map[f] = i; }); }
  let res;
  try { res = Exchange.rowsToTasks(rows, map, App.project.tasks.map(x => x.id), { skipHeader: header }); } catch (e) { Dialog.message(t('clip.paste'), e instanceof Model.Invalid ? I18n.error(e) : t('imp.unreadable')); return; }
  if (res.errors.length) {
    const ok = await Dialog.open({ title: t('clip.paste'), body: [h('p', { text: t('wiz.valid', { count: res.rows.length, total: res.total }) }),
      h('ul', {}, res.errors.slice(0, 50).map(e => h('li', { text: `${t('wiz.line')} ${e.line} : ${e.msg}` })))],
      actions: [{ label: t('dlg.cancel'), value: 'cancel', focus: true }, { label: t('wiz.importValid', { count: res.rows.length }), value: 'ok', kind: 'primary' }] });
    if (ok !== 'ok' || !res.rows.length) return;
  }
  if (!res.rows.length) return;
  let merged;
  try { merged = Exchange.mergeRows(App.project, res.rows, 'add'); } catch (e) { Dialog.message(t('clip.paste'), e instanceof Model.Invalid ? I18n.error(e) : t('imp.unreadable')); return; }
  commit(p => { for (const k of Object.keys(merged.project)) if (k !== 'versions') p[k] = merged.project[k]; });
  App.multi = new Set(merged.added);
  render();
  announce(t('clip.pasted', { count: merged.added.length }));
}

function initClipboard() {
  const blocked = ev => document.querySelector('dialog[open]') || (ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable]'));
  document.addEventListener('copy', ev => {
    if (blocked(ev)) return;
    const top = topSelected();
    if (!top.length) return;
    const ids = top.flatMap(id => [id, ...descendants(id).map(x => x.id)]);
    const tsv = clipboardTsv(ids);
    App.clipboard = { tsv, tasks: clone(ids.map(taskById)) };
    ev.clipboardData.setData('text/plain', tsv);
    ev.preventDefault();
    announce(t('clip.copied', { count: ids.length }));
  });
  document.addEventListener('paste', ev => {
    if (blocked(ev)) return;
    const text = ev.clipboardData.getData('text/plain');
    if (!text) return;
    ev.preventDefault();
    if (App.clipboard && text.replace(/\r\n/g, '\n') === App.clipboard.tsv.replace(/\r\n/g, '\n')) pasteInternal(App.clipboard);
    else pasteText(text);
  });
}
