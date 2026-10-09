/* Protection par mot de passe (EF-102, section 8.5) avec l'API Web Crypto du navigateur, sans
 * bibliothèque : clé dérivée par PBKDF2-SHA256 (600 000 itérations, sel aléatoire de 16 octets),
 * chiffrement authentifié AES-256-GCM (vecteur de 12 octets). Le mot de passe n'est jamais
 * enregistré ; un mot de passe faux et un fichier altéré donnent le même message.
 * Choix (CLAUDE.md, A02) : bcrypt/argon2 servent à STOCKER des mots de passe ; ici on dérive une
 * clé de chiffrement, rôle pour lequel PBKDF2 est natif et recommandé à ce nombre d'itérations. */
const Secure = (() => {
  const ITER = 600000, MAX_ITER = 5000000, MIN_PASSWORD = 12;
  const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = str => { const s = atob(str); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };

  async function key(password, salt, iterations, usage) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, [usage]);
  }

  /** Mot de passe acceptable : 12 caractères au moins (ou une phrase), recommandation ANSSI. */
  const passwordOk = p => typeof p === 'string' && [...p].length >= MIN_PASSWORD;

  /** Texte → enveloppe 8.5. */
  async function encrypt(text, password, iterations = ITER) {
    if (!passwordOk(password)) throw new Model.Invalid('pwd.short', { min: MIN_PASSWORD });
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const k = await key(password, salt, iterations, 'encrypt');
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(text)));
    return { format: Model.FORMAT, encrypted: true, kdf: { name: 'PBKDF2-SHA256', iterations, salt: b64(salt) }, cipher: { name: 'AES-256-GCM', iv: b64(iv) }, data: b64(data) };
  }

  /** Enveloppe → texte ; Model.Invalid('pwd.bad') si mot de passe faux ou fichier altéré. */
  async function decrypt(env, password) {
    const ok = env && env.encrypted === true && env.kdf && env.kdf.name === 'PBKDF2-SHA256' && env.cipher && env.cipher.name === 'AES-256-GCM'
      && Number.isInteger(env.kdf.iterations) && env.kdf.iterations >= ITER && env.kdf.iterations <= MAX_ITER
      && typeof env.kdf.salt === 'string' && typeof env.cipher.iv === 'string' && typeof env.data === 'string';
    if (!ok) throw new Model.Invalid('imp.unreadable');
    let salt, iv, data;
    try { salt = unb64(env.kdf.salt); iv = unb64(env.cipher.iv); data = unb64(env.data); } catch { throw new Model.Invalid('imp.unreadable'); }
    if (salt.length < 16 || iv.length !== 12) throw new Model.Invalid('imp.unreadable');
    try {
      const k = await key(password, salt, env.kdf.iterations, 'decrypt');
      return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, data));
    } catch { throw new Model.Invalid('pwd.bad'); }
  }

  return { encrypt, decrypt, passwordOk, MIN_PASSWORD, ITER };
})();
