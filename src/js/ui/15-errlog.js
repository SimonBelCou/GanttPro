/*
 * Journal local d'erreurs (EF-151, RG-59 à RG-63) : interface et branchements.
 *
 * - Les lignes sont TOUJOURS tenues en mémoire pendant la session ; elles ne sont écrites sur l'appareil (par Store,
 *   espace « log ») que si l'utilisateur a coché « Conserver le journal sur cet appareil » (décision J1, désactivé par
 *   défaut). Rien n'est jamais envoyé : l'utilisateur exporte lui-même le fichier .jsonl pour un signalement (J3).
 * - Les lignes sont construites par ErrLog (moteur sans DOM), qui n'accepte que des valeurs de listes fermées : ni
 *   message d'exception, ni contenu de projet, ni nom de ressource, ni chemin de fichier (J4 à J6).
 * - Un échec d'écriture du journal lui-même n'est pas journalisé (J2) : il n'y a pas de récursion possible.
 * - Une exception imprévue (« app.unexpected ») affiche un bandeau non bloquant, au plus un toutes les 10 secondes,
 *   avec la référence de la ligne et le bouton « Exporter le journal ». Jamais de pile à l'écran.
 *
 * Appelle : Dialog, ErrLog, I18n, Model, Settings, Store
 * Appelée par : 14 modules et fichiers (voir Architecture.md)
 */
const Journal = (() => {
  const KEY = 'journal';
  const BANNER_GAP_MS = 10000;
  /** Erreurs des analyseurs du moteur (xml, zip, csv, xlsx, calendrier) : refus ATTENDUS d'un fichier mal formé. */
  const EXPECTED_RE = /^(xml|zip|csv|xlsx|calendar)(\.|$)/;
  /** Une ligne identique à la précédente (code, action, composant, type, origine) dans ce délai n'est pas ajoutée : un
   * projet au-delà de 2199 ferait sinon un « calc.error » à chaque modification et chasserait les lignes utiles. */
  const REPEAT_MS = 60000;
  let lines = [], sid = '00000000', busy = false, lastBanner = -Infinity, box = null, opener = null;

  /**
   * Appelle : Settings.get()
   * Appelée par : Journal.init(), Journal.save(), openSettings()
   */
  const keeping = () => Settings.get('errlog') === 'on';

  /**
   * Identifiant de corrélation : 8 chiffres hexadécimaux tirés au hasard à chaque chargement (J6).
   * Appelle : aucune
   * Appelée par : Journal.init()
   */
  function newSid() {
    const a = new Uint8Array(4);
    crypto.getRandomValues(a);
    return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Écrit le journal sur l'appareil si l'option est active. Le résultat n'est pas journalisé (J2).
   * Appelle : ErrLog.serialize(), Journal.keeping(), Store.write()
   * Appelée par : Journal.init(), Journal.record(), Journal.setKeep()
   */
  function save() {
    if (keeping()) Store.write('log', KEY, ErrLog.serialize(lines));
  }

  /**
   * Au lancement : relecture tolérante et purge du journal conservé, puis gestionnaires globaux d'erreurs.
   * Un événement « error » sans objet d'erreur (boucle de ResizeObserver, ressource) n'est pas une exception du
   * programme : il est ignoré.
   * Appelle : ErrLog.parse(), ErrLog.serialize(), h(), Journal.keeping(), Journal.newSid(), Journal.save(),
   *   Journal.unexpected(), Store.read()
   * Appelée par : init()
   */
  function init() {
    sid = newSid();
    if (keeping()) {
      const raw = Store.read('log', KEY);
      lines = ErrLog.parse(raw, Date.now());
      // Réécrit seulement si la relecture a retiré quelque chose (purge, ligne hostile, texte illisible) : GR491_Backend_4.
      if (raw === null || ErrLog.serialize(lines) !== raw) save();
    }
    // Zone d'alerte créée vide dès le lancement : un lecteur d'écran n'annonce pas toujours une zone insérée déjà pleine (RGAA 7.5).
    box = h('div', { id: 'errlog-banner', class: 'errlog-banner', role: 'alert', hidden: true });
    document.body.append(box);
    window.addEventListener('error', ev => { if (ev.error !== null && ev.error !== undefined) unexpected(ev.error, 'app', 'main'); });
    window.addEventListener('unhandledrejection', ev => unexpected(ev.reason, 'app', 'main'));
  }

  /**
   * Ajoute une ligne (refus attendu ou erreur imprévue). Un code hors catalogue ou hors des préfixes journalisés est
   * ignoré par ErrLog.make. Renvoie la ligne ou null.
   * @param {string} code clé du catalogue (imp.*, pwd.*, store.*, calc.*, app.unexpected)
   * @param {string} act action métier (ErrLog.ACTS)
   * @param {string} cmp composant (ErrLog.CMPS)
   * @param {*} [error] exception d'origine : seuls son type et « fonction:ligne » sont gardés
   * Appelle : ErrLog.make(), ErrLog.push(), Journal.save()
   * Appelée par : enableAutosave(), importFile(), Journal.calc(), Journal.failure(), Journal.store(),
   *   Journal.unexpected(), storageNotice()
   */
  function record(code, act, cmp, error) {
    if (busy) return null;
    busy = true;
    try {
      const now = Date.now();
      const line = ErrLog.make({ code, act, cmp, error }, { now, sid, ver: APP_VERSION });
      if (!line) return null;
      const last = lines[lines.length - 1];
      if (last && ['code', 'act', 'cmp', 'err', 'at', 'sid'].every(k => last[k] === line[k]) && now - Date.parse(last.ts) < REPEAT_MS) return last;
      lines = ErrLog.push(lines, line, now);
      save();
      return line;
    } finally { busy = false; }
  }

  /**
   * Référence affichée et cherchable dans le journal : identifiant de session et heure UTC de la ligne.
   * Appelle : aucune
   * Appelée par : Journal.banner(), Journal.view()
   */
  const ref = line => `${line.sid}-${line.ts.slice(11, 19).replace(/:/g, '')}`;

  /**
   * Bandeau non bloquant « Erreur inattendue (réf. …) », au plus un toutes les 10 secondes.
   * Appelle : clear(), h(), Journal.exportFile(), Journal.ref(), t()
   * Appelée par : Journal.unexpected()
   */
  function banner(line) {
    const now = Date.now();
    if (!line || now - lastBanner < BANNER_GAP_MS) return;
    lastBanner = now;
    if (!box) return;
    // Une fenêtre modale rend le reste de la page inerte : le bandeau va dans la fenêtre ouverte pour rester utilisable
    // au clavier (RGAA 12.8), puis revient dans la page quand elle se ferme.
    const dlgs = document.querySelectorAll('dialog[open]');
    const dlg = dlgs.length ? dlgs[dlgs.length - 1] : null;
    if (dlg) {
      if (box.parentNode !== dlg) dlg.append(box);
      dlg.addEventListener('close', () => document.body.append(box), { once: true });
    } else if (box.parentNode !== document.body) document.body.append(box);
    opener = document.activeElement;
    const exp = h('button', { type: 'button', id: 'errlog-export' }, t('log.export'));
    const close = h('button', { type: 'button', class: 'dlg-x', id: 'errlog-close', aria: { label: t('log.dismiss') } }, h('span', { aria: { hidden: 'true' }, text: '×' }));
    exp.addEventListener('click', () => exportFile());
    close.addEventListener('click', () => {
      box.hidden = true;
      if (opener && opener.isConnected && opener !== document.body) opener.focus(); // focus rendu (RGAA 12.8)
    });
    clear(box).append(h('span', { text: t('log.banner', { ref: ref(line) }) }), exp, close);
    box.hidden = false;
  }

  /**
   * Exception imprévue : ligne « app.unexpected » (ERROR, failed) et bandeau. Les exceptions levées ici même ne
   * peuvent pas être journalisées (le journal ne se journalise pas, J2) : elles sont abandonnées volontairement.
   * Appelle : Journal.banner(), Journal.record()
   * Appelée par : Journal.calc(), Journal.failure(), Journal.init()
   */
  function unexpected(error, act, cmp) {
    let line = null;
    try { line = record(ErrLog.UNEXPECTED, act, cmp, error); banner(line); } catch { /* le journal ne se journalise pas (J2) */ }
    return line;
  }

  /**
   * Message à montrer pour une exception attrapée, en distinguant le refus attendu de l'erreur imprévue :
   *  - Model.Invalid : refus d'un contrôle, journalisé par son code seul (un mot de passe refusé = « pwd.bad », J5) ;
   *  - erreur d'un analyseur du moteur (xml, zip, csv, xlsx, calendrier) : refus attendu « imp.zip » ou « imp.unreadable » ;
   *  - toute autre exception : « app.unexpected » et bandeau ; le message de repli `fallback` est rendu.
   * Le message de l'exception sert seulement à reconnaître l'analyseur : il n'est jamais écrit dans le journal.
   * Appelle : I18n.error(), Journal.record(), Journal.unexpected(), t()
   * Appelée par : action « verRestore », doExport(), importFile(), importText(), initHome(), newFromTemplate(),
   *   openLibrary(), pasteInternal(), pasteText(), Recovery.offer(), sheetWizard()
   */
  function failure(error, act, cmp, fallback = 'imp.unreadable') {
    if (error instanceof Model.Invalid) { record(error.key, act, cmp, error); return I18n.error(error); }
    const msg = error instanceof Error && typeof error.message === 'string' ? error.message : '';
    if (EXPECTED_RE.test(msg)) {
      const code = /^zip/.test(msg) ? 'imp.zip' : 'imp.unreadable';
      record(code, act, cmp, error);
      return t(code);
    }
    unexpected(error, act, cmp);
    return t(fallback);
  }

  /**
   * Échec d'un calcul de planning : une RangeError (date au-delà de 2199) est un refus attendu « calc.error » ; toute
   * autre exception est imprévue.
   * Appelle : Journal.record(), Journal.unexpected()
   * Appelée par : action « duplicateSelection », action « duplicateTask », action « rsAbsAdd », action «
   *   setProjectStart », bulkWindow(), calendarWindow(), Editor.save(), finishGesture(), nudge(), recompute()
   */
  function calc(error, cmp) {
    if (error instanceof RangeError) record('calc.error', 'calc', cmp, error);
    else unexpected(error, 'calc', cmp);
  }

  /**
   * Échec d'écriture du stockage ('full' ou 'off') ; tout autre résultat est ignoré.
   * Appelle : Journal.record()
   * Appelée par : homeSave(), Recovery.saveAll(), storeFailed()
   */
  function store(result, cmp) {
    if (result === 'full' || result === 'off') record('store.' + result, 'store', cmp);
  }

  /**
   * Option « Conserver le journal sur cet appareil » : activée, écrit les lignes de la session ; désactivée, retire
   * le journal de l'appareil (les lignes de la session restent en mémoire). Renvoie false si le stockage manque.
   * Appelle : Journal.save(), Settings.set(), Store.available(), Store.remove()
   * Appelée par : openSettings()
   */
  function setKeep(on) {
    if (on) {
      if (!Store.available() || !Settings.set('errlog', 'on')) return false;
      save();
      return true;
    }
    Settings.set('errlog', 'off');
    Store.remove('log', KEY);
    return true;
  }

  /**
   * Efface le journal en mémoire et sur l'appareil (bouton « Effacer le journal », « Effacer toutes les données »).
   * Appelle : Store.remove()
   * Appelée par : openSettings()
   */
  function clearAll() {
    lines = [];
    Store.remove('log', KEY);
  }

  /**
   * Télécharge le journal en JSON Lines (J3) par le mécanisme d'export existant.
   * Appelle : download(), ErrLog.toJsonl(), I18n.getLang(), t(), toast()
   * Appelée par : Journal.banner(), Journal.view(), openSettings()
   */
  function exportFile() {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
    download(ErrLog.toJsonl(lines, { ver: APP_VERSION, lang: I18n.getLang(), now }), `ganttpro_journal_${day}.jsonl`, 'application/x-ndjson');
    toast(t('log.exported'));
  }

  /**
   * Fenêtre « Journal d'erreurs » : tableau des lignes, de la plus récente à la plus ancienne. Le message affiché est
   * le libellé du code, sans ses paramètres (qui ne sont pas journalisés).
   * Appelle : Dialog.open(), h(), Journal.exportFile(), Journal.ref(), t()
   * Appelée par : openSettings()
   */
  function view() {
    const cols = ['ts', 'lvl', 'act', 'code', 'msg', 'cmp', 'ref', 'at'];
    // Niveau, action, code, composant et origine sont des identifiants techniques en anglais : lus comme tels (RGAA 8.7).
    const TECH = ['lvl', 'act', 'code', 'cmp', 'at'];
    const cell = l => ({ ts: l.ts.replace('T', ' ').slice(0, 19), lvl: l.lvl, act: l.act, code: l.code, msg: t(l.code).replace(/\{\w+\}/g, '…'),
      cmp: l.cmp, ref: ref(l), at: l.at || '—' });
    const body = lines.length
      ? h('div', { class: 'log-scroll', id: 'log-table', tabindex: '0', role: 'region', aria: { labelledby: 'log-caption' } },
        h('table', { class: 'manage' }, h('caption', { class: 'sr-only', id: 'log-caption', text: t('log.caption') }),
          h('thead', {}, h('tr', {}, cols.map(c => h('th', { scope: 'col', text: t('log.c.' + c) })))),
          h('tbody', {}, lines.slice().reverse().map(l => { const c = cell(l); return h('tr', {}, cols.map(k => h('td', { text: c[k], lang: TECH.includes(k) ? 'en' : undefined }))); }))))
      : h('p', { id: 'log-table', text: t('log.empty') });
    return Dialog.open({ title: t('log.title'), size: 'wide', body: [body],
      actions: [{ label: t('log.export'), value: 'export' }, { label: t('dlg.close'), value: 'cancel', focus: true }],
      onAction: v => { if (v === 'export') { exportFile(); return false; } return true; } });
  }

  /**
   * Appelle : aucune
   * Appelée par : openSettings()
   */
  const size = () => lines.length;
  return { init, record, failure, calc, store, setKeep, clearAll, exportFile, view, size, keeping };
})();
