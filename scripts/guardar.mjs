// Guarda en data/ el archivo cifrado que envía Power Automate y regenera data/index.json.
// Rechaza cualquier contenido que no tenga exactamente la forma cifrada esperada,
// para que nunca se publique información en claro por error.
import fs from 'fs';
import path from 'path';

const DIR = 'data';
const raw = process.env.PAYLOAD || '';
if (!raw || raw === 'null') { console.log('Sin payload (ejecución manual): solo se regenera el índice.'); }
else {
  const p = JSON.parse(raw);
  const d = typeof p.datos === 'string' ? JSON.parse(p.datos) : p.datos;
  const okStr = (s, re) => typeof s === 'string' && re.test(s);
  const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
  if (!d || d.v !== 1) throw new Error('Formato desconocido');
  if (!okStr(d.grupo, /^[\p{L}\p{N} _.-]{1,60}$/u)) throw new Error('Grupo inválido');
  if (!okStr(d.periodo, /^\d{4}-\d{2}$/)) throw new Error('Periodo inválido');
  if (!Array.isArray(d.r)) throw new Error('Sin registros');
  for (const r of d.r) {
    const keys = Object.keys(r).sort().join(',');
    if (keys !== 'ct,id,iv,m,s') throw new Error('Registro con campos inesperados');
    if (!okStr(r.id, /^[0-9a-f]{32}$/) || !okStr(r.s, B64) || !okStr(r.iv, B64) || !okStr(r.ct, B64) || !okStr(r.m, B64)) throw new Error('Registro inválido');
  }
  const turnos = {};
  for (const [k, t] of Object.entries(d.turnos || {})) {
    if (!/^[A-Za-z0-9]{1,6}$/.test(k)) continue;
    turnos[k] = { n: String(t.n || k).slice(0, 40), i: String(t.i || '').slice(0, 5), f: String(t.f || '').slice(0, 5), c: String(t.c || '').slice(0, 30), d: !!t.d };
  }
  const limpio = { v: 1, grupo: d.grupo, periodo: d.periodo, version: Number(d.version) || 0, generado: String(d.generado || new Date().toISOString()).slice(0, 30), iter: Number(d.iter) || 60000, turnos, r: d.r };
  fs.mkdirSync(DIR, { recursive: true });
  const slug = d.grupo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'grupo';
  fs.writeFileSync(path.join(DIR, `${d.periodo}_${slug}.json`), JSON.stringify(limpio));
  console.log(`Guardado ${d.periodo}_${slug}.json con ${d.r.length} registros`);
}
const archivos = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => /^\d{4}-\d{2}_[A-Za-z0-9_-]+\.json$/.test(f)) : [];
const indice = archivos.map(f => {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  return { archivo: f, grupo: j.grupo, periodo: j.periodo, version: j.version, generado: j.generado };
}).sort((a, b) => (a.periodo + a.grupo).localeCompare(b.periodo + b.grupo));
fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify({ actualizado: new Date().toISOString(), archivos: indice }));
console.log(`Índice con ${indice.length} archivos`);
