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

  /** Cellule « Budget / Réel » de la liste : budget puis coût réel, en forme compacte (EF-115). */
  function pair(amounts) {
    const wrap = h('span', { class: 'money-pair' });
    wrap.append(node(amounts.budget, { compact: true }), h('span', { class: 'sr-only', text: ` ${I18n.t('f.actual')} : ` }), h('span', { 'aria-hidden': 'true', text: ' / ' }), node(amounts.actual, { compact: true }));
    return wrap;
  }

  return { DOTS, symbol, masked, text, spoken, node, pair };
})();

action('toggleMask', () => {
  App.maskAmounts = !App.maskAmounts;
  Settings.set('mask', App.maskAmounts ? 'on' : 'off');
  render();
  announce(t('top.mask') + ' : ' + t(App.maskAmounts ? 'state.on' : 'state.off'));
  const b = $('btn-mask'); if (b) b.focus();
});
