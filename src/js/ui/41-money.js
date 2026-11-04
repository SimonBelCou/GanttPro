/*
 * Affichage des montants à l'écran (EF-112, EF-125, EF-127, RG-41, RG-43).
 * Un montant est affiché en entier ou en forme compacte selon l'endroit ; le masquage remplace tout montant par
 * « •••• » (nom accessible « montant masqué »), sans toucher aux données ni aux fichiers (RG-41).
 *
 * Appelle : App, Budget, I18n
 * Appelée par : 50-render.js, 64-bulk.js, 70-windows.js, 71-rates.js, 71-resource-sheet.js, 72-baselines.js,
 *   76-budget.js, 77-report.js, 78-print.js, 80-files.js, Editor, Tooltip
 */
const Money = (() => {
  const DOTS = '••••';
  /**
   * Appelle : aucune
   * Appelée par : action « rlField », bulkWindow(), Editor.budgetEditor(), Editor.validate(), Money.opts(),
   *   rateLinesEditor(), sheetWizard()
   */
  const symbol = () => (App.project && App.project.currency) || '€';
  /**
   * Appelle : aucune
   * Appelée par : action « rlAdd », action « rlField », action « rlRemove », action « rsOwnClear », bulkWindow(),
   *   Editor.budgetEditor(), Editor.validate(), editProjectWindow(), Money.node(), Money.text(), rateLinesEditor(),
   *   resourceCostSection()
   */
  const masked = () => !!App.maskAmounts;
  /**
   * Appelle : I18n.getLang(), Money.symbol()
   * Appelée par : Money.node(), Money.plain(), Money.text()
   */
  const opts = () => ({ lang: I18n.getLang(), symbol: symbol() });

  /**
   * Texte brut (infobulles, annonces) : « •••• » si masqué.
   * Appelle : Budget.format(), Budget.formatCompact(), Money.masked(), Money.opts()
   * Appelée par : Editor.summaryText(), moneyAxis(), paintBudget(), paintEvmCurves()
   */
  function text(cents, { compact = false } = {}) {
    if (masked()) return DOTS;
    return compact ? Budget.formatCompact(cents, opts()) : Budget.format(cents, opts());
  }
  /**
   * Texte d'une SORTIE (copie, impression) : jamais masqué, le masquage ne concerne que l'écran (RG-41).
   * Appelle : Budget.format(), Budget.formatCompact(), Money.opts()
   * Appelée par : buildPrintGantt(), lineText()
   */
  function plain(cents, { compact = false } = {}) {
    return compact ? Budget.formatCompact(cents, opts()) : Budget.format(cents, opts());
  }

  /**
   * Nœud d'un montant. Masqué : « •••• » visible, « montant masqué » pour les lecteurs d'écran. Compact : le texte
   * abrégé est visible et le lecteur d'écran lit ce texte puis le montant complet entre parenthèses (RG-43).
   * Appelle : Budget.format(), Budget.formatCompact(), h(), I18n.t(), Money.masked(), Money.opts()
   * Appelée par : amountCell(), amountSentence(), baselinesWindow(), lineNode(), moneyCell(), paintBudget(),
   *   paintEvm(), paintRatesCost(), paintResourceSheet(), rateTodayNode(), resourceCostSection(), Tooltip.show()
   */
  function node(cents, { compact = false, cls = '' } = {}) {
    if (masked()) return h('span', { class: ['money', 'masked', cls] }, h('span', { aria: { hidden: 'true' }, text: DOTS }), h('span', { class: 'sr-only', text: I18n.t('amt.masked') }));
    const shown = compact ? Budget.formatCompact(cents, opts()) : Budget.format(cents, opts());
    if (!compact || Math.abs(cents) < 100000000) return h('span', { class: ['money', cls], text: shown });
    return h('span', { class: ['money', 'compact', cls] }, shown, h('span', { class: 'sr-only', text: ` (${Budget.format(cents, opts())})` }));
  }

  return { DOTS, symbol, masked, text, plain, node };
})();

/**
 * Bouton de la barre du haut ou d'une fenêtre : même réglage. Les fenêtres ouvertes à montants sont redessinées.
 * Appelle : $(), announce(), baselinesWindow(), paintReport(), render(), repaintDashboard(), reportWindow(),
 *   Settings.set(), t()
 * Appelée par : l'événement « toggleMask » (table ACTIONS)
 */
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
