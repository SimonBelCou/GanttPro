/* Affichage des montants à l'écran (EF-112, EF-125, EF-127, RG-41, RG-43).
 * Un montant est affiché en entier ou en forme compacte selon l'endroit ; le masquage remplace tout montant par
 * « •••• » (nom accessible « montant masqué »), sans toucher aux données ni aux fichiers (RG-41). */
const Money = (() => {
  const DOTS = '••••';
  const symbol = () => (App.project && App.project.currency) || '€';
  const masked = () => !!App.maskAmounts;
  const opts = () => ({ lang: I18n.getLang(), symbol: symbol() });

  /** Texte brut (infobulles, annonces) : « •••• » si masqué. */
  function text(cents, { compact = false } = {}) {
    if (masked()) return DOTS;
    return compact ? Budget.formatCompact(cents, opts()) : Budget.format(cents, opts());
  }
  /** Texte d'une SORTIE (copie, impression) : jamais masqué, le masquage ne concerne que l'écran (RG-41). */
  function plain(cents, { compact = false } = {}) {
    return compact ? Budget.formatCompact(cents, opts()) : Budget.format(cents, opts());
  }
  /** Texte pour un lecteur d'écran : le montant complet, ou « montant masqué ». */
  const spoken = cents => (masked() ? I18n.t('amt.masked') : Budget.format(cents, opts()));

  /**
   * Nœud d'un montant. Masqué : « •••• » visible, « montant masqué » pour les lecteurs d'écran. Compact : le texte
   * abrégé est visible et le lecteur d'écran lit ce texte puis le montant complet entre parenthèses (RG-43).
   */
  function node(cents, { compact = false, cls = '' } = {}) {
    if (masked()) return h('span', { class: ['money', 'masked', cls] }, h('span', { aria: { hidden: 'true' }, text: DOTS }), h('span', { class: 'sr-only', text: I18n.t('amt.masked') }));
    const shown = compact ? Budget.formatCompact(cents, opts()) : Budget.format(cents, opts());
    if (!compact || Math.abs(cents) < 100000000) return h('span', { class: ['money', cls], text: shown });
    return h('span', { class: ['money', 'compact', cls] }, shown, h('span', { class: 'sr-only', text: ` (${Budget.format(cents, opts())})` }));
  }

  return { DOTS, symbol, masked, text, plain, spoken, node };
})();

/** Bouton de la barre du haut ou d'une fenêtre : même réglage. Les fenêtres ouvertes à montants sont redessinées. */
action('toggleMask', (arg, el) => {
  App.maskAmounts = !App.maskAmounts;
  Settings.set('mask', App.maskAmounts ? 'on' : 'off');
  render();
  for (const b of document.querySelectorAll('.dlg-mask')) b.setAttribute('aria-pressed', String(App.maskAmounts));
  if (typeof repaintDashboard === 'function') repaintDashboard();
  if (baselinesWindow.paint) baselinesWindow.paint();
  if (reportWindow.body) paintReport(reportWindow.body);
  announce(t('top.mask') + ' : ' + t(App.maskAmounts ? 'state.on' : 'state.off'));
  const b = el && el.classList && el.classList.contains('dlg-mask') ? el : $('btn-mask'); if (b) b.focus();
});
