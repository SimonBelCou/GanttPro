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
   * @returns {Promise<string>} valeur du bouton choisi, ou 'cancel'
   */
  function open({ title, body = [], actions = [], onAction, size }) {
    const opener = document.activeElement;
    const id = 'dlg-' + (++seq);
    return new Promise(resolve => {
      const buttons = actions.map(a => h('button', {
        type: a.value === 'cancel' ? 'button' : 'submit', value: a.value, class: a.kind || '',
        data: { dlg: a.value }, autofocus: a.focus ? true : undefined,
      }, a.label));
      const form = h('form', { method: 'dialog', novalidate: true },
        h('h2', { id: id + '-title', text: title }),
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
      dlg.addEventListener('cancel', ev => { ev.preventDefault(); finish('cancel'); });
      document.body.append(dlg);
      dlg.showModal();
      const first = dlg.querySelector('[autofocus]') || dlg.querySelector('input, select, textarea, button');
      if (first) first.focus();
    });
  }

  /** Message simple. */
  function message(title, text) {
    return open({ title, body: [h('p', { text })], actions: [{ label: I18n.t('dlg.ok'), value: 'ok', kind: 'primary', focus: true }] });
  }

  /** Confirmation : « Annuler » est l'action par défaut (4.3). Renvoie true si confirmé. */
  async function confirm(title, lines, confirmLabel, danger = true) {
    const v = await open({
      title, body: lines.filter(Boolean).map(text => h('p', { text })),
      actions: [{ label: I18n.t('dlg.cancel'), value: 'cancel', focus: true }, { label: confirmLabel, value: 'ok', kind: danger ? 'danger' : 'primary' }],
    });
    return v === 'ok';
  }

  return { open, message, confirm };
})();
