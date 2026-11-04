/*
 * Listes dépliantes des barres (EF-152) : « Fichier ▾ » et « Colonnes ▾ ». Motif « disclosure » (bouton à
 * aria-expanded qui montre ou cache le panneau placé juste après lui), sans role="menu" : le panneau contient des
 * boutons et une liste de choix ordinaires, parcourus par Tab. Échap ou un clic au-dehors ferme le panneau ; le
 * choix d'un bouton du panneau le ferme aussi et place le focus sur le bouton dépliant, pour que la fenêtre ouverte
 * par ce choix rende ensuite le focus à un élément visible. Un seul panneau ouvert à la fois. Rien n'est enregistré.
 */

/**
 * Ferme le panneau ouvert, s'il y en a un, et rend le focus à son bouton si demandé.
 * Entrée : focusButton, vrai pour rendre le focus au bouton dépliant.
 * Appelle : $()
 * Appelée par : action « toggleDisclosure », initDisclosures()
 */
function closeDisclosures(focusButton) {
  for (const btn of document.querySelectorAll('.disc-btn[aria-expanded="true"]')) {
    btn.setAttribute('aria-expanded', 'false');
    $(btn.getAttribute('aria-controls')).hidden = true;
    if (focusButton) btn.focus();
  }
}

/**
 * Déplie ou replie le panneau dont l'identifiant est donné par data-arg ; ferme les autres.
 * Appelle : $(), closeDisclosures()
 * Appelée par : l'événement « toggleDisclosure » (table ACTIONS)
 */
action('toggleDisclosure', (panelId, btn) => {
  const open = btn.getAttribute('aria-expanded') !== 'true';
  closeDisclosures(false);
  if (!open) return;
  btn.setAttribute('aria-expanded', 'true');
  $(panelId).hidden = false;
});

/**
 * Écouteurs : Échap, clic au-dehors, focus qui quitte la liste, choix d'un bouton du panneau. Les écouteurs du
 * clic et du clavier sont posés sur chaque liste, donc appelés avant l'écouteur général des actions (document).
 * Appelle : closeDisclosures()
 * Appelée par : init()
 */
function initDisclosures() {
  for (const box of document.querySelectorAll('.disclosure')) {
    box.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape' || !box.querySelector('.disc-btn[aria-expanded="true"]')) return;
      ev.preventDefault(); ev.stopPropagation();
      closeDisclosures(true);
    });
    box.addEventListener('click', ev => {
      const item = ev.target.closest('.disc-panel button');
      if (item && box.contains(item)) closeDisclosures(true);
    });
    box.addEventListener('focusout', ev => {
      if (ev.relatedTarget && !box.contains(ev.relatedTarget)) closeDisclosures(false);
    });
  }
  document.addEventListener('pointerdown', ev => {
    if (!ev.target.closest('.disclosure')) closeDisclosures(false);
  });
}
