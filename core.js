var DMS = (function () {
  // Colunas do Resumo de Produção: nome do cabeçalho + posição padrão (A=0)
  var COLS = {
    cultivar: ['Cultivar', 0], lote: ['Lote', 1], arm: ['Armazem', 2], emb: ['MB/LA', 3],
    pn: ['PN.', 4], classe: ['Classe', 6], kgsc: ['Kg/Sc', 7], prod: ['Prod.', 8],
    bra: ['Brancas', 9], trat: ['Tratadas', 11], ind: ['IND', 20], rp: ['RP', 22],
    cond: ['CONDENADO', 26], embk: ['Indiceemb', 36]
  };
  var FIELDS = ['lote', 'cultivar', 'classe', 'pn', 'emb', 'arm', 'kgsc', 'prod', 'ind', 'embk', 'bra', 'trat', 'rp', 'cond'];
  var NUMS = { kgsc: 1, prod: 1, ind: 1, embk: 1, bra: 1, trat: 1, rp: 1 };

  function norm(s) { return String(s == null ? '' : s).replace(/ /g, ' ').trim().toUpperCase(); }
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).trim();
    if (!s) return 0;
    if (/,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    var n = Number(s);
    return isFinite(n) ? n : 0;
  }
  function txt(v) {
    if (v == null) return '';
    if (typeof v === 'number') return String(v);
    return String(v).replace(/ /g, ' ').trim();
  }
  function serialToISO(v) {
    var d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  function findDate(header) {
    for (var i = 0; i < header.length; i++) {
      var v = header[i];
      if (typeof v === 'number' && v > 40000 && v < 70000) return serialToISO(v);
      if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    }
    return null;
  }
  function mapCols(header) {
    var map = {}, avisos = [];
    Object.keys(COLS).forEach(function (k) {
      var name = norm(COLS[k][0]), idx = -1;
      for (var i = 0; i < header.length; i++) { if (norm(header[i]) === name) { idx = i; break; } }
      if (idx < 0) { idx = COLS[k][1]; avisos.push('Coluna "' + COLS[k][0] + '" não encontrada pelo nome; usei a posição padrão.'); }
      map[k] = idx;
    });
    return { map: map, avisos: avisos };
  }
  // Origem pela nomenclatura do lote: NNDM… = Dois Marcos, UWML… = BASF, demais = terceiros
  function origem(lote) {
    var l = String(lote || '').toUpperCase();
    if (/^\d{2}DM/.test(l)) return 'DM';
    if (/^UWML/.test(l)) return 'BASF';
    return 'TERC';
  }
  // Tecnologia pela nomenclatura da cultivar
  function tecnologia(c) {
    var u = String(c || '').toUpperCase();
    if (/I2X/.test(u)) return 'I2X';
    if (/IPRO/.test(u)) return 'IPRO';
    if (/(^|[^A-Z])CE([^A-Z]|$)/.test(u)) return 'CE';
    return 'Outras';
  }
  var ORIGENS = { DM: 'Dois Marcos', BASF: 'BASF', TERC: 'Terceiros' };
  function r2(n) { return Math.round(n * 100) / 100; }

  // aoa = linhas da planilha (array de arrays), primeira linha = cabeçalho
  function parseAoA(aoa, arquivo) {
    if (!aoa || !aoa.length) throw new Error('A planilha está vazia.');
    var header = aoa[0];
    var mc = mapCols(header), map = mc.map;
    var hasLote = header.some(function (h) { return norm(h) === 'LOTE'; });
    var hasProd = header.some(function (h) { return norm(h) === 'PROD.'; });
    if (!hasLote || !hasProd) throw new Error('Não reconheci o Resumo de Produção: faltam as colunas "Lote" e "Prod." no cabeçalho.');
    var rows = [], vistos = {}, dup = 0;
    for (var r = 1; r < aoa.length; r++) {
      var line = aoa[r] || [];
      var lote = txt(line[map.lote]);
      if (!lote) continue;
      if (vistos[lote]) { dup++; continue; }
      vistos[lote] = 1;
      rows.push(FIELDS.map(function (f) {
        var v = line[map[f]];
        if (f === 'lote') return lote;
        if (f === 'cond') return norm(v) === 'S' ? 1 : 0;
        if (NUMS[f]) return r2(num(v));
        return txt(v);
      }));
    }
    if (dup) mc.avisos.push(dup + ' linha(s) com lote repetido foram ignoradas.');
    return { v: 1, arquivo: arquivo || '', dataExtracao: findDate(header), fields: FIELDS.slice(), rows: rows, avisos: mc.avisos };
  }

  // Converte linha compacta em objeto com os saldos calculados
  function lote(row) {
    var o = {};
    for (var i = 0; i < FIELDS.length; i++) o[FIELDS[i]] = row[i];
    o.origem = origem(o.lote);
    o.tec = tecnologia(o.cultivar);
    o.fin = Number(o.rp) > 0.5 ? 'MULT' : 'COM';   // lote com reserva de plantio = multiplicação
    o.saldoBruto = o.prod - o.ind - o.embk;           // I − U − AK
    o.saldo = Math.max(0, o.saldoBruto);
    o.rpB = Math.min(Math.max(0, o.rp), o.saldo);       // reserva de plantio limitada ao saldo
    o.disp = o.saldo - o.rpB;                            // saldo comercial disponível
    o.tratB = Math.min(Math.max(0, o.trat), o.saldo);   // parte tratada (TSI) do saldo
    o.bags = o.kgsc > 0 ? o.saldo / o.kgsc : 0;
    o.dispBags = o.kgsc > 0 ? o.disp / o.kgsc : 0;
    o.rpBags = o.kgsc > 0 ? o.rpB / o.kgsc : 0;
    o.tratBags = o.kgsc > 0 ? o.tratB / o.kgsc : 0;
    o.prodBags = o.kgsc > 0 ? o.prod / o.kgsc : 0;
    o.embkBags = o.kgsc > 0 ? o.embk / o.kgsc : 0;
    o.indBags = o.kgsc > 0 ? o.ind / o.kgsc : 0;
    return o;
  }
  function resumo(lotes) {
    var t = { nLotes: lotes.length, lotesSaldo: 0, prod: 0, ind: 0, embk: 0, prodBags: 0, indBags: 0, embkBags: 0, saldo: 0, disp: 0, rp: 0, trat: 0, bags: 0, dispBags: 0, rpBags: 0, tratBags: 0 };
    var por = {}, porO = {}, porG = {}, porC = {};
    function acc(map, key, o) {
      var e = map[key] || (map[key] = { lotes: 0, nLotes: 0, saldo: 0, bags: 0, disp: 0, dispBags: 0, rp: 0, rpBags: 0, prod: 0, prodBags: 0, embk: 0, embkBags: 0, ind: 0, indBags: 0 });
      if (o.saldo > 0.5) e.lotes++;
      e.nLotes++;
      e.saldo += o.saldo; e.bags += o.bags; e.disp += o.disp; e.dispBags += o.dispBags; e.rp += o.rpB; e.rpBags += o.rpBags;
      e.prod += o.prod; e.prodBags += o.prodBags; e.embk += o.embk; e.embkBags += o.embkBags; e.ind += o.ind; e.indBags += o.indBags;
    }
    lotes.forEach(function (o) {
      t.prod += o.prod; t.ind += o.ind; t.embk += o.embk; t.prodBags += o.prodBags; t.indBags += o.indBags; t.embkBags += o.embkBags;
      t.saldo += o.saldo; t.disp += o.disp; t.rp += o.rpB; t.trat += o.tratB;
      t.bags += o.bags; t.dispBags += o.dispBags; t.rpBags += o.rpBags; t.tratBags += o.tratBags;
      if (o.saldo > 0.5) t.lotesSaldo++;
      acc(por, o.emb || '—', o); acc(porO, o.origem, o); acc(porG, o.origem + '|' + (o.emb || '—'), o); acc(porC, o.origem + '|' + (o.emb || '—') + '|' + o.fin, o);
    });
    Object.keys(t).forEach(function (k) { t[k] = r2(t[k]); });
    [por, porO, porG, porC].forEach(function (m) { Object.keys(m).forEach(function (k) { Object.keys(m[k]).forEach(function (f) { m[k][f] = r2(m[k][f]); }); }); });
    t.porEmb = por; t.porOrigem = porO; t.porGrupo = porG; t.porCombo = porC;
    return t;
  }
  return { origem: origem, tecnologia: tecnologia, ORIGENS: ORIGENS, parseAoA: parseAoA, lote: lote, resumo: resumo, FIELDS: FIELDS };
})();
if (typeof module !== 'undefined') module.exports = DMS;
