/* Fichiers : nouveau projet (EF-49), import (EF-52), export (EF-50, EF-51).
 * Un fichier importé est contrôlé en entier par Model.parseFile AVANT tout changement :
 * en cas de refus, le projet ouvert reste intact (EX-14). */

/** Nom de fichier d'export : « <nom>_gantt.json », a-z et 0-9 seulement (EF-50). */
function exportFileName(name) {
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '_') || 'projet';
  return base + '_gantt.json';
}

function download(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: filename, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportWindow() {
  const anon = h('input', { type: 'checkbox', id: 'exp-anon' });
  const v = await Dialog.open({
    title: t('top.export'),
    body: [h('p', { text: t('exp.notice') }), h('div', { class: 'field check' }, anon, h('label', { for: 'exp-anon', text: t('exp.anonymize') }))],
    actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('top.export'), value: 'ok', kind: 'primary', focus: true }],
  });
  if (v !== 'ok') return;
  const file = Model.serialize(App.project, { anonymize: anon.checked });
  download(JSON.stringify(file, null, 2), exportFileName(App.project.name), 'application/json');
  if (!anon.checked) App.dirty = false; // un export anonymisé ne conserve pas le projet complet
  announce(t('exp.notice'));
}

async function importText(text) {
  let result;
  try {
    result = Model.parseFile(text);
  } catch (e) {
    if (e instanceof Model.Invalid) { await Dialog.message(t('top.import'), I18n.error(e)); return; }
    await Dialog.message(t('top.import'), t('imp.unreadable'));
    return;
  }
  if (result.encrypted) { await Dialog.message(t('top.import'), t('imp.encrypted')); return; }
  const p = result.project;
  const work = p.tasks.filter(x => x.type === 'task');
  const avg = work.length ? Math.round(Metrics.globalProgress(p)) : 0;
  const lines = [
    h('p', { class: 'strong', text: `${p.emoji} ${p.name}` }),
    p.desc ? h('p', { text: p.desc }) : null,
    h('p', { text: t('imp.summary', { tasks: p.tasks.length, resources: p.resources.length, categories: p.categories.length, baselines: p.baselines.length,
      start: I18n.date(Dates.parse(p.projectStart)), pct: avg }) }),
    result.notices.unknown ? h('p', { class: 'hint', text: t('imp.notice.unknown', { count: result.notices.unknown }) }) : null,
    result.notices.createdResources.length ? h('p', { class: 'hint', text: t('imp.notice.resources', { names: result.notices.createdResources.join(', ') }) }) : null,
    result.notices.createdCategories.length ? h('p', { class: 'hint', text: t('imp.notice.categories', { names: result.notices.createdCategories.join(', ') }) }) : null,
    App.dirty ? h('p', { class: 'warning', text: t('dlg.unsaved') }) : null,
  ];
  const v = await Dialog.open({
    title: t('imp.title'), body: lines,
    actions: [{ label: t('dlg.cancel'), value: 'cancel', focus: true }, { label: t('imp.replace'), value: 'ok', kind: 'primary' }],
  });
  if (v !== 'ok') return;
  Editor.close();
  loadProject(p);
  App.dirty = false;
  render();
}

/** Noms du projet initial dans la langue choisie (3.8). */
function initialNames() {
  return { project: t('init.project'), task: t('init.task'), resource: t('init.resource'), category: t('init.category') };
}

async function newProjectAction() {
  if (App.dirty) {
    const ok = await Dialog.confirm(t('dlg.new'), [t('dlg.unsaved')], t('top.new'));
    if (!ok) return;
  }
  Editor.close();
  loadProject(Model.newProject(Dates.toISO(Dates.todayDn()), Date.now(), initialNames()));
  render();
}
