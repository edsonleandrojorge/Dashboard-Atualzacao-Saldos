// Lê as planilhas novas da pasta "planilhas/" e atualiza data/index.json e data/cargas/.
// Roda automaticamente no GitHub Actions a cada upload. Uso manual: node scripts/processar.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const XLSX = require('xlsx');
const DMS = require('../core.js');

const ROOT = path.join(__dirname, '..');
const PASTA = path.join(ROOT, 'planilhas');
const IDX = path.join(ROOT, 'data', 'index.json');
const DIR_CARGAS = path.join(ROOT, 'data', 'cargas');

const idx = fs.existsSync(IDX) ? JSON.parse(fs.readFileSync(IDX, 'utf8')) : { cargas: [] };
const hashes = new Set(idx.cargas.map(c => c.hash).filter(Boolean));
fs.mkdirSync(DIR_CARGAS, { recursive: true });

const arquivos = fs.existsSync(PASTA) ? fs.readdirSync(PASTA).filter(f => /\.(xls|xlsx|xlsm|csv)$/i.test(f)).sort() : [];
let novas = 0;
for (const nome of arquivos) {
  const buf = fs.readFileSync(path.join(PASTA, nome));
  const hash = crypto.createHash('sha1').update(buf).digest('hex');
  if (hashes.has(hash)) continue;
  try {
    const wb = XLSX.read(buf, { type: 'buffer' });
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
    const p = DMS.parseAoA(aoa, nome);
    if (!p.rows.length) throw new Error('nenhum lote encontrado');
    let data = p.dataExtracao;
    if (!data) { // tenta "dd-mm" ou "dd_mm" no nome do arquivo; senão, hoje
      const m = nome.match(/(\d{1,2})[-_.](\d{1,2})/); const hoje = new Date();
      data = m ? `${hoje.getFullYear()}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : hoje.toISOString().slice(0, 10);
    }
    const agora = new Date().toISOString();
    const id = 'c' + data.replace(/-/g, '') + '-' + hash.slice(0, 8);
    const arq = `data/cargas/${id}.json`;
    fs.writeFileSync(path.join(ROOT, arq), JSON.stringify({ v: 1, arquivo: nome, dataExtracao: data, fields: p.fields, rows: p.rows }));
    idx.cargas.push({ id, dataExtracao: data, ordem: data + '|' + agora, arquivo: nome, enviadoEm: agora, file: arq, hash,
      totais: DMS.resumo(p.rows.map(DMS.lote)) });
    hashes.add(hash); novas++;
    console.log(`OK  ${nome}: extração ${data}, ${p.rows.length} lotes` + (p.avisos.length ? ` | avisos: ${p.avisos.join(' ')}` : ''));
  } catch (e) {
    console.error(`ERRO ${nome}: ${e.message}`);
    process.exitCode = 1;
  }
}
idx.cargas.sort((a, b) => (a.ordem < b.ordem ? -1 : 1));
idx.atualizadoEm = new Date().toISOString();
fs.writeFileSync(IDX, JSON.stringify(idx));
console.log(novas ? `${novas} carga(s) nova(s). Total no histórico: ${idx.cargas.length}.` : 'Nenhuma planilha nova.');
