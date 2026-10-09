/* Aucune action n'est attachée par un attribut onclick= (interdit, et bloqué par la CSP).
 * Les éléments portent data-click / data-change / data-input / data-submit (+ data-arg) ;
 * un seul écouteur par type d'événement les relie à la table ACTIONS ci-dessous.
 * data-arg est toujours passé comme chaîne brute (les identifiants de tâche sont des chaînes). */
const ACTIONS = Object.create(null);

function action(name, fn) { ACTIONS[name] = fn; }

function dispatch(kind, ev) {
  const el = ev.target.closest(`[data-${kind}]`);
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  const fn = ACTIONS[el.dataset[kind]];
  if (!fn) return;
  if (kind === 'submit') ev.preventDefault();
  fn(el.dataset.arg, el, ev);
}

function initActions() {
  document.addEventListener('click', ev => dispatch('click', ev));
  document.addEventListener('change', ev => dispatch('change', ev));
  document.addEventListener('input', ev => dispatch('input', ev));
  document.addEventListener('submit', ev => dispatch('submit', ev));
  // Élément non natif marqué role="button" : Entrée et Espace l'activent (EX-01).
  document.addEventListener('keydown', ev => {
    const el = ev.target;
    if ((ev.key === 'Enter' || ev.key === ' ') && el.getAttribute && el.getAttribute('role') === 'button' && el.dataset.click) {
      ev.preventDefault();
      dispatch('click', ev);
    }
  });
}
