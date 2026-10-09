/* Lecteur XML minimal, sans DOM, pour les classeurs Excel et les fichiers MS Project (EX-27).
 * Sûreté : toute déclaration DOCTYPE ou ENTITY est refusée (pas d'entité externe, pas d'expansion
 * exponentielle) ; seules les cinq entités prédéfinies et les références numériques sont décodées ;
 * profondeur et nombre de nœuds bornés. */
const Xml = (() => {
  const MAX_NODES = 2e6, MAX_DEPTH = 64;
  const ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

  function decode(s) {
    return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (m, e) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
      }
      return ENT[e] !== undefined ? ENT[e] : m;
    });
  }

  /** Échappe un texte pour le XML et retire les caractères interdits par XML 1.0. */
  function escape(s) {
    return String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** Arbre {name (sans préfixe), attrs, children, text}. Lève Error('xml') si le texte est refusé. */
  function parse(text) {
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('xml.doctype');
    const root = { name: '#root', attrs: {}, children: [], text: '' };
    const stack = [root];
    let i = 0, nodes = 0;
    const local = n => n.slice(n.indexOf(':') + 1);
    while (i < text.length) {
      const lt = text.indexOf('<', i);
      const top = stack[stack.length - 1];
      if (lt < 0) { top.text += decode(text.slice(i)); break; }
      if (lt > i) top.text += decode(text.slice(i, lt));
      if (text.startsWith('<!--', lt)) { const e = text.indexOf('-->', lt); if (e < 0) throw new Error('xml'); i = e + 3; continue; }
      if (text.startsWith('<![CDATA[', lt)) { const e = text.indexOf(']]>', lt); if (e < 0) throw new Error('xml'); top.text += text.slice(lt + 9, e); i = e + 3; continue; }
      if (text.startsWith('<?', lt)) { const e = text.indexOf('?>', lt); if (e < 0) throw new Error('xml'); i = e + 2; continue; }
      if (text.startsWith('<!', lt)) throw new Error('xml');
      const gt = text.indexOf('>', lt);
      if (gt < 0) throw new Error('xml');
      let tag = text.slice(lt + 1, gt);
      if (tag[0] === '/') {
        const name = local(tag.slice(1).trim());
        if (stack.length < 2 || stack[stack.length - 1].name !== name) throw new Error('xml');
        stack.pop();
        i = gt + 1;
        continue;
      }
      const selfClose = tag.endsWith('/');
      if (selfClose) tag = tag.slice(0, -1);
      const m = /^([^\s]+)/.exec(tag);
      if (!m) throw new Error('xml');
      const node = { name: local(m[1]), attrs: {}, children: [], text: '' };
      const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let a;
      while ((a = re.exec(tag.slice(m[1].length)))) node.attrs[local(a[1])] = decode(a[3] !== undefined ? a[3] : a[4]);
      if (++nodes > MAX_NODES) throw new Error('xml.size');
      top.children.push(node);
      if (!selfClose) { stack.push(node); if (stack.length > MAX_DEPTH) throw new Error('xml.depth'); }
      i = gt + 1;
    }
    if (stack.length !== 1) throw new Error('xml');
    return root;
  }

  const child = (n, name) => (n && n.children.find(c => c.name === name)) || null;
  const children = (n, name) => (n ? n.children.filter(c => c.name === name) : []);
  const textOf = (n, name) => { const c = child(n, name); return c ? c.text.trim() : ''; };
  /** Texte de tout le sous-arbre (pour les chaînes riches d'Excel). */
  const deepText = n => n.text + n.children.map(deepText).join('');

  return { parse, escape, child, children, textOf, deepText };
})();
