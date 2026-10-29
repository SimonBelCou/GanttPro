/* Fenêtres de l'application (4.3) : jamais alert/confirm/prompt du navigateur.
 * Élément <dialog> natif ouvert en modal : l'arrière-plan est inerte, Tab reste dans la fenêtre,
 * Échap ferme ; le focus revient ensuite à l'élément qui l'avait ouverte. Chaque fenêtre est
 * annoncée comme un dialogue titré (EX-02). Plusieurs fenêtres peuvent s'empiler. */
const Dialog = (() => {
  let seq = 0;

  /**
   * @param {object} o
   * @param {string} o.title
   * @param {Node[]} o.body
   * @param {{label:string, value:string, kind?:string, focus?:boolean}[]} o.actions
   * @param {(value:string, dlg:HTMLDialogElement) => boolean|void} [o.onAction] renvoyer false garde la fenêtre ouverte
   * @param {string} [o.size] 'wide'
   * @param {boolean} [o.maskTool] ajoute dans l'en-tête le bouton « Masquer les montants » (même réglage que la barre du haut, RG-41)
   * @param {boolean|(() => boolean)} [o.guard] formulaire dont la saisie serait perdue : true = un champ a été modifié ; fonction = état « modifié » calculé par l'appelant. La croix et Échap demandent alors confirmation.
   * @returns {Promise<string>} valeur du bouton choisi, ou 'cancel'
   */
  function open({ title, body = [], actions = [], onAction, size, guard, maskTool }) {
    const opener = document.activeElement;
    const id = 'dlg-' + (++seq);
    return new Promise(resolve => {
      const buttons = actions.map(a => h('button', {
        type: a.value === 'cancel' ? 'button' : 'submit', value: a.value, class: a.kind || '',
        data: { dlg: a.value }, autofocus: a.focus ? true : undefined,
      }, a.label));
      const closeX = h('button', { type: 'button', class: 'dlg-x', aria: { label: I18n.t('dlg.close') }, data: { dlgx: '1' } }, h('span', { aria: { hidden: 'true' }, text: '×' }));
      const form = h('form', { method: 'dialog', novalidate: true },
        h('div', { class: 'dialog-head' }, h('h2', { id: id + '-title', text: title }),
          maskTool ? h('button', { type: 'button', class: 'dlg-mask', data: { click: 'toggleMask' }, aria: { pressed: String(!!App.maskAmounts) }, text: I18n.t('top.mask') }) : null, closeX),
        h('div', { class: 'dialog-body' }, body),
        h('div', { class: 'actions' }, buttons));
      const dlg = h('dialog', { class: ['dialog', size], aria: { labelledby: id + '-title' } }, form);
      let done = false;
      const finish = value => {
        if (done) return;
        done = true;
        if (dlg.open) dlg.close();
        dlg.remove();
        if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
        resolve(value);
      };
      form.addEventListener('submit', ev => {
        ev.preventDefault();
        const value = ev.submitter ? ev.submitter.value : (actions.find(a => a.kind === 'primary') || {}).value;
        if (onAction && onAction(value, dlg) === false) return;
        finish(value);
      });
      for (const b of buttons) if (b.value === 'cancel') b.addEventListener('click', () => finish('cancel'));
      // Fermeture demandée (croix ou Échap) : une fenêtre déclarée `guard` dont la saisie serait perdue demande
      // confirmation ; les fenêtres à effet immédiat ou sans saisie se ferment sans question, et le bouton
      // « Annuler » ferme toujours directement.
      let dirty = false, asking = false;
      form.addEventListener('input', () => { dirty = true; });
      form.addEventListener('change', () => { dirty = true; });
      const requestClose = async () => {
        if (asking || done) return;
        if (guard && (typeof guard === 'function' ? guard() : dirty)) {
          asking = true;
          const discard = await confirm(I18n.t('dlg.discardTitle'), [I18n.t('dlg.discardText')], I18n.t('dlg.discard'), true, I18n.t('dlg.keep'));
          asking = false;
          if (!discard) { if (dlg.isConnected) { const f = dlg.querySelector('input, select, textarea') || closeX; f.focus(); } return; }
        }
        finish('cancel');
      };
      closeX.addEventListener('click', requestClose);
      dlg.addEventListener('cancel', ev => { ev.preventDefault(); requestClose(); });
      document.body.append(dlg);
      dlg.showModal();
      const first = dlg.querySelector('[autofocus]') || dlg.querySelector('input, select, textarea, button:not(.dlg-x)') || closeX;
      if (first) first.focus();
    });
  }

  /** Message simple. */
  function message(title, text) {
    return open({ title, body: [h('p', { text })], actions: [{ label: I18n.t('dlg.ok'), value: 'ok', kind: 'primary', focus: true }] });
  }

  /** Confirmation : « Annuler » est l'action par défaut (4.3). Renvoie true si confirmé. */
  async function confirm(title, lines, confirmLabel, danger = true, cancelLabel) {
    const v = await open({
      title, body: lines.filter(Boolean).map(text => h('p', { text })),
      actions: [{ label: cancelLabel || I18n.t('dlg.cancel'), value: 'cancel', focus: true }, { label: confirmLabel, value: 'ok', kind: danger ? 'danger' : 'primary' }],
    });
    return v === 'ok';
  }

  return { open, message, confirm };
})();
