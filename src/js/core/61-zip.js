/* Archives ZIP : écriture sans compression (classeurs Excel) et lecture prudente (EX-27).
 * Lecture : au plus 200 fichiers et 50 Mo décompressés au total, vérifiés sur les tailles déclarées
 * ET sur les octets réellement produits (une archive qui ment sur ses tailles est arrêtée). */
const Zip = (() => {
  const MAX_ENTRIES = 200, MAX_TOTAL = 50 * 1024 * 1024;
  let table = null;
  function crc32(bytes) {
    if (!table) {
      table = new Uint32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
    }
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  const enc = new TextEncoder();

  /** @param {{name:string, data:Uint8Array|string}[]} files */
  function write(files) {
    const parts = [], central = [];
    let offset = 0;
    for (const f of files) {
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const name = enc.encode(f.name);
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
      local.setUint16(10, 0, true); local.setUint16(12, 0x21, true); local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true); local.setUint32(22, data.length, true); local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
    let p = 0;
    for (const b of all) { out.set(b, p); p += b.length; }
    return out;
  }

  async function inflate(bytes, budget) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const reader = stream.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > budget.left) { await reader.cancel(); throw new Error('zip.tooBig'); }
      chunks.push(value);
    }
    budget.left -= total;
    const out = new Uint8Array(total);
    let p = 0;
    for (const c of chunks) { out.set(c, p); p += c.length; }
    return out;
  }

  /** Lit une archive : Map nom → octets. Lève Error('zip…') si elle est refusée. */
  async function read(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('zip');
    const count = dv.getUint16(eocd + 10, true);
    if (count > MAX_ENTRIES) throw new Error('zip.tooMany');
    let p = dv.getUint32(eocd + 16, true);
    const entries = [];
    let declared = 0;
    for (let k = 0; k < count; k++) {
      if (p + 46 > bytes.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error('zip');
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
      declared += usize;
      if (declared > MAX_TOTAL) throw new Error('zip.tooBig');
      entries.push({ name, method, csize, off });
      p += 46 + nlen + xlen + clen;
    }
    const budget = { left: MAX_TOTAL };
    const out = new Map();
    for (const e of entries) {
      if (e.name.endsWith('/')) continue;
      if (dv.getUint32(e.off, true) !== 0x04034b50) throw new Error('zip');
      const start = e.off + 30 + dv.getUint16(e.off + 26, true) + dv.getUint16(e.off + 28, true);
      const raw = bytes.subarray(start, start + e.csize);
      if (e.method === 0) { if (raw.length > budget.left) throw new Error('zip.tooBig'); budget.left -= raw.length; out.set(e.name, raw); }
      else if (e.method === 8) out.set(e.name, await inflate(raw, budget));
      else throw new Error('zip.method');
    }
    return out;
  }

  return { write, read, crc32, MAX_ENTRIES, MAX_TOTAL };
})();
