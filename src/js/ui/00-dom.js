/* Construction du DOM SANS innerHTML (A03 – injection) : tout texte passe par textContent,
 * tout attribut par setAttribute après contrôle du nom, tout style par le CSSOM.
 * Un texte venant d'un fichier ne peut donc jamais devenir du code (EX-13). */
const $ = id => document.getElementById(id);

const FORBIDDEN_ATTR = /^(on|style$|srcdoc$|formaction$)/i;
const URL_ATTR = /^(href|src|action|xlink:href)$/i;

/**
 * h('button', {class:'x', data:{click:'save'}, aria:{label:'…'}, css:{left:'4px'}, text:'OK'}, enfants…)
 * Les enfants sont des nœuds ou des chaînes (insérées comme texte).
 */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'text') el.textContent = String(v);
    else if (k === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
    else if (k === 'data') for (const [dk, dv] of Object.entries(v)) { if (dv !== undefined && dv !== null) el.dataset[dk] = String(dv); }
    else if (k === 'aria') for (const [ak, av] of Object.entries(v)) { if (av !== undefined && av !== null) el.setAttribute('aria-' + ak, String(av)); }
    else if (k === 'css') for (const [ck, cv] of Object.entries(v)) el.style.setProperty(ck, String(cv));
    else if (k === 'value') el.value = String(v);
    else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'hidden' || k === 'required' || k === 'multiple') el[k] = !!v;
    else {
      if (FORBIDDEN_ATTR.test(k)) throw new Error('attribut interdit : ' + k);
      if (URL_ATTR.test(k) && !/^(#|blob:|data:image\/png)/.test(String(v))) throw new Error('adresse interdite');
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

/** Couleur sûre pour le CSSOM : uniquement #rgb ou #rrggbb (EX-13), sinon la teinte neutre. */
function safeColor(c, fallback = '#8a94a6') { return typeof c === 'string' && Model.COLOR_RE.test(c) ? c : fallback; }

/** Texte lisible (noir ou blanc) sur une couleur de fond (contraste EX-03). */
function inkOn(hex) {
  let c = safeColor(hex).slice(1);
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const lum = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
  return L > 0.179 ? '#000000' : '#ffffff';
}

let liveTimer = 0;
/** Message annoncé aux lecteurs d'écran (EX-02) et affiché brièvement. */
function announce(msg) {
  const live = $('live');
  live.textContent = '';
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { live.textContent = msg; }, 30);
}
