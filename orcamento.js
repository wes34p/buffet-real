/* Montador de orçamento da Miriam (orcamento.html).
 * Lê a mensagem gerada pelo site (app.js > montarMensagem) e monta a resposta.
 * Nenhum valor sai deste aparelho: rascunho e tabela de preços ficam no localStorage.
 */
(function(){
  'use strict';

  var CARDAPIO = window.BUFFET_CARDAPIO || [];
  var CHAVE_RASCUNHO = 'buffetreal:montador:rascunho:v1';
  var CHAVE_TABELA = 'buffetreal:montador:tabela:v1';
  var CAMPOS = ['nome','whatsapp','tipo','data','convidados','local','codigo','obsCliente'];
  var EQUIPE = ['Cozinha','Garçons','Portaria','Limpeza'];

  function el(tag, classe, texto){
    var e = document.createElement(tag);
    if(classe) e.className = classe;
    if(texto !== undefined) e.textContent = texto;
    return e;
  }
  function normaliza(t){ return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function guarda(chave, valor){ try{ localStorage.setItem(chave, JSON.stringify(valor)); }catch(e){} }
  function le(chave){ try{ var v = localStorage.getItem(chave); return v ? JSON.parse(v) : null; }catch(e){ return null; } }
  function apaga(chave){ try{ localStorage.removeItem(chave); }catch(e){} }

  var toastTimer;
  function avisa(texto){
    var t = document.getElementById('toast');
    t.textContent = texto;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ t.hidden = true; }, 3000);
  }

  function paraNumero(s){
    s = String(s || '').replace(/[^\d,.-]/g, '');
    if(s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  var moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function real(n){ return moeda.format(n); }

  // índice do cardápio por nome normalizado
  var POR_NOME = {};
  CARDAPIO.forEach(function(cat, ci){
    (cat.itens || []).forEach(function(item, ii){
      POR_NOME[normaliza(cat.id + '|' + item.nome)] = { cat: cat, item: item, ci: ci, ii: ii };
      if(!POR_NOME[normaliza(item.nome)]) POR_NOME[normaliza(item.nome)] = { cat: cat, item: item, ci: ci, ii: ii };
    });
  });
  function categoriaPorNome(nome){
    var n = normaliza(nome);
    for(var i = 0; i < CARDAPIO.length; i++) if(normaliza(CARDAPIO[i].nome) === n) return CARDAPIO[i];
    return null;
  }

  /* ---------- estado ---------- */
  var novoEstado = function(){
    return { campos: {}, linhas: [], extras: [], fecho: { validade: '', pagamento: '', obs: '' }, mostrarValores: true };
  };
  var estado = novoEstado();
  var tabela = le(CHAVE_TABELA) || {};
  var seq = 0;
  function novaLinha(dados){
    seq++;
    return {
      id: 'l' + Date.now().toString(36) + seq,
      nome: dados.nome || '',
      detalhe: dados.detalhe || '',
      valor: dados.valor || '',
      cat: dados.cat || '',
      ref: dados.ref || '',
      opcoes: dados.opcoes || []
    };
  }
  function chaveTabela(l){ return normaliza(l.nome + (l.opcoes.length ? ' ' + l.opcoes.join(' ') : '')); }
  function preencheDaTabela(l){
    var t = tabela[chaveTabela(l)];
    if(t){
      if(!l.detalhe) l.detalhe = t.detalhe || '';
      if(!l.valor) l.valor = t.valor || '';
    }
    return l;
  }
  function lembra(l){
    if(!document.getElementById('lembrar').checked || !l.nome) return;
    tabela[chaveTabela(l)] = { detalhe: l.detalhe, valor: l.valor };
    guarda(CHAVE_TABELA, tabela);
  }

  /* ---------- leitura do pedido ---------- */
  function lerPedido(texto){
    var est = novoEstado();
    var secao = '';
    var cat = null;
    texto.replace(/\r/g, '').split('\n').forEach(function(bruta){
      var linha = bruta.trim();
      if(!linha) return;
      var limpa = linha.replace(/^[*_]+|[*_]+$/g, '').trim();
      var chave = normaliza(limpa);

      var mCod = /^c[oó]digo:\s*(.+)$/i.exec(limpa);
      if(mCod){ est.campos.codigo = mCod[1].trim(); return; }

      if(/^evento$/.test(chave)){ secao = 'evento'; return; }
      if(/^cardapio escolhido/.test(chave)){ secao = 'cardapio'; return; }
      if(/^equipe$/.test(chave)){ secao = 'equipe'; return; }
      if(/^vasilhames$/.test(chave)){ secao = 'vasilhames'; return; }
      if(/^observacoes$/.test(chave)){ secao = 'obs'; return; }
      if(/^pedido de orcamento/.test(chave) || /^pedido enviado pelo cardapio/.test(chave)) return;

      if(secao === 'evento'){
        var m = /^([^:]+):\s*(.*)$/.exec(limpa);
        if(!m) return;
        var k = normaliza(m[1]);
        var mapa = { 'nome': 'nome', 'whatsapp': 'whatsapp', 'tipo': 'tipo', 'data': 'data', 'convidados': 'convidados', 'local': 'local' };
        if(mapa[k]) est.campos[mapa[k]] = m[2].trim();
        return;
      }
      if(secao === 'cardapio'){
        var c = categoriaPorNome(limpa);
        if(c){ cat = c; return; }
        var mi = /^\d+\.\s+(.+)$/.exec(linha);
        if(mi){
          var nome = mi[1].trim();
          var opcoes = [];
          var mo = /^(.*)\s+\(([^()]*)\)$/.exec(nome);
          if(mo){
            nome = mo[1].trim();
            if(!/a combinar$/i.test(mo[2])) opcoes = mo[2].split(',').map(function(s){ return s.trim(); }).filter(Boolean);
          }
          var ref = POR_NOME[normaliza((cat ? cat.id : '') + '|' + nome)] || POR_NOME[normaliza(nome)];
          var catNome = cat ? cat.nome : (ref ? ref.cat.nome : 'Outros');
          est.linhas.push(preencheDaTabela(novaLinha({
            nome: nome, opcoes: opcoes, cat: catNome,
            ref: ref ? ref.ci + '.' + ref.ii : ''
          })));
          return;
        }
        if(!cat && /quero sugest/.test(chave)){
          est.linhas.push(novaLinha({ nome: 'Sugestão da Miriam: cardápio completo', cat: 'Outros' }));
          return;
        }
        if(/^\+/.test(linha) && cat){
          est.linhas.push(novaLinha({ nome: 'Sugestão da Miriam: ' + cat.nome.toLowerCase(), cat: cat.nome }));
          return;
        }
        return;
      }
      if(secao === 'equipe'){
        limpa.split(',').forEach(function(f){
          f = f.trim();
          if(f) est.extras.push(preencheDaTabela(novaLinha({ nome: f })));
        });
        return;
      }
      if(secao === 'vasilhames'){
        if(!est.extras.some(function(x){ return x.nome === 'Vasilhames'; })) est.extras.push(preencheDaTabela(novaLinha({ nome: 'Vasilhames' })));
        return;
      }
      if(secao === 'obs'){
        est.campos.obsCliente = (est.campos.obsCliente ? est.campos.obsCliente + '\n' : '') + linha;
      }
    });
    return est;
  }

  /* ---------- tela ---------- */
  function criaLinha(l, lista){
    var row = el('div', 'linha');
    var nome = el('input', 'nome');
    nome.type = 'text';
    nome.value = l.nome + (l.opcoes.length ? ' (' + l.opcoes.join(', ') + ')' : '');
    nome.setAttribute('aria-label', 'Item');
    nome.addEventListener('input', function(){
      var m = /^(.*)\s+\(([^()]*)\)$/.exec(nome.value);
      if(m && l.opcoes.length){ l.nome = m[1].trim(); l.opcoes = m[2].split(',').map(function(s){ return s.trim(); }).filter(Boolean); }
      else { l.nome = nome.value; l.opcoes = []; }
      mudou();
    });
    var det = el('input', 'detalhe');
    det.type = 'text';
    det.placeholder = 'Quantidade ou detalhe';
    det.value = l.detalhe;
    det.setAttribute('aria-label', 'Quantidade ou detalhe de ' + l.nome);
    det.addEventListener('input', function(){ l.detalhe = det.value; mudou(); });
    det.addEventListener('change', function(){ lembra(l); });
    var val = el('input', 'valor');
    val.type = 'text';
    val.inputMode = 'decimal';
    val.placeholder = '0,00';
    val.value = l.valor;
    val.setAttribute('aria-label', 'Valor de ' + l.nome);
    val.addEventListener('input', function(){ l.valor = val.value; mudou(); });
    val.addEventListener('change', function(){
      if(l.valor !== '') { val.value = l.valor = paraNumero(l.valor).toFixed(2).replace('.', ','); }
      lembra(l); mudou();
    });
    var rem = el('button', 'remover', '×');
    rem.type = 'button';
    rem.setAttribute('aria-label', 'Remover ' + (l.nome || 'item'));
    rem.addEventListener('click', function(){
      lista.splice(lista.indexOf(l), 1);
      desenha();
    });
    row.appendChild(nome); row.appendChild(det); row.appendChild(val); row.appendChild(rem);
    return row;
  }

  function desenha(){
    var caixa = document.getElementById('linhas-cardapio');
    caixa.replaceChildren();
    if(!estado.linhas.length) caixa.appendChild(el('p', 'vazio', 'Nenhum prato ainda. Adicione abaixo.'));
    var ordem = CARDAPIO.map(function(c){ return c.nome; }).concat(['Outros']);
    ordem.forEach(function(catNome){
      var doGrupo = estado.linhas.filter(function(l){ return (l.cat || 'Outros') === catNome; });
      if(!doGrupo.length) return;
      caixa.appendChild(el('p', 'cat-titulo', catNome));
      doGrupo.forEach(function(l){ caixa.appendChild(criaLinha(l, estado.linhas)); });
    });

    var extras = document.getElementById('linhas-extras');
    extras.replaceChildren();
    if(!estado.extras.length) extras.appendChild(el('p', 'vazio', 'Nada por aqui. Use os botões abaixo para incluir equipe ou outros valores.'));
    estado.extras.forEach(function(l){ extras.appendChild(criaLinha(l, estado.extras)); });

    CAMPOS.forEach(function(c){
      var e = document.querySelector('[data-campo="' + c + '"]');
      if(e && document.activeElement !== e) e.value = estado.campos[c] || '';
    });
    ['validade','pagamento','obs'].forEach(function(c){
      var e = document.querySelector('[data-fecho="' + c + '"]');
      if(e && document.activeElement !== e) e.value = estado.fecho[c] || '';
    });
    document.getElementById('mostrar-valores').checked = estado.mostrarValores;
    document.getElementById('area-orcamento').hidden = false;
    mudou();
  }

  function total(){
    return estado.linhas.concat(estado.extras).reduce(function(s, l){ return s + paraNumero(l.valor); }, 0);
  }
  function primeiroNome(n){ return String(n || '').trim().split(/\s+/)[0] || ''; }

  function linhaTexto(l){
    var t = '• ' + l.nome + (l.opcoes.length ? ' (' + l.opcoes.join(', ') + ')' : '');
    if(l.detalhe) t += ' · ' + l.detalhe;
    if(estado.mostrarValores && l.valor !== '') t += ' · ' + real(paraNumero(l.valor));
    return t;
  }

  function resposta(){
    var c = estado.campos;
    var L = ['*ORÇAMENTO · BUFFET REAL*'];
    if(c.codigo) L.push('Pedido ' + c.codigo);
    L.push('');
    L.push('Olá' + (c.nome ? ', ' + primeiroNome(c.nome) : '') + '! Segue o orçamento do seu evento.');
    var ev = [c.tipo, c.data, c.convidados ? c.convidados + ' convidados' : ''].filter(Boolean).join(' · ');
    if(ev || c.local){
      L.push('');
      L.push('*Evento*');
      if(ev) L.push(ev);
      if(c.local) L.push('Local: ' + c.local);
    }
    if(estado.linhas.length){
      L.push('');
      L.push('*Cardápio*');
      var ordem = CARDAPIO.map(function(x){ return x.nome; }).concat(['Outros']);
      ordem.forEach(function(catNome){
        var doGrupo = estado.linhas.filter(function(l){ return (l.cat || 'Outros') === catNome && l.nome; });
        if(!doGrupo.length) return;
        L.push('_' + catNome + '_');
        doGrupo.forEach(function(l){ L.push(linhaTexto(l)); });
      });
    }
    var extras = estado.extras.filter(function(l){ return l.nome; });
    if(extras.length){
      L.push('');
      L.push('*Equipe e serviços*');
      extras.forEach(function(l){ L.push(linhaTexto(l)); });
    }
    L.push('');
    L.push('*Total: ' + real(total()) + '*');
    var f = estado.fecho;
    if(f.validade || f.pagamento || f.obs) L.push('');
    if(f.validade) L.push('Validade: ' + f.validade);
    if(f.pagamento) L.push('Pagamento: ' + f.pagamento);
    if(f.obs) L.push('Observações: ' + f.obs);
    L.push('');
    L.push('Qualquer ajuste no cardápio, é só me chamar por aqui.');
    L.push('Miriam Marinho · Buffet Real');
    return L.join('\n');
  }

  function desenhaDocumento(){
    var d = document.getElementById('documento');
    d.replaceChildren();
    var c = estado.campos;
    var topo = el('div', 'doc-topo');
    topo.appendChild(el('div', 'doc-marca', 'Buffet Real'));
    topo.appendChild(el('div', 'doc-sub', 'Miriam Marinho · Itabirito-MG · (31) 98021-7336'));
    d.appendChild(topo);
    d.appendChild(el('h1', 'doc-titulo', 'Orçamento' + (c.codigo ? ' · ' + c.codigo : '')));
    var meta = el('div', 'doc-meta');
    [['Cliente', c.nome], ['WhatsApp', c.whatsapp], ['Evento', c.tipo], ['Data', c.data], ['Convidados', c.convidados], ['Local', c.local]].forEach(function(p){
      if(p[1]) meta.appendChild(el('div', '', p[0] + ': ' + p[1]));
    });
    d.appendChild(meta);
    function tabelaDe(titulo, linhas){
      if(!linhas.length) return;
      d.appendChild(el('div', 'doc-cat', titulo));
      var t = el('table', 'doc-tabela');
      linhas.forEach(function(l){
        var tr = el('tr');
        var td = el('td');
        td.appendChild(document.createTextNode(l.nome + (l.opcoes.length ? ' (' + l.opcoes.join(', ') + ')' : '')));
        if(l.detalhe){ td.appendChild(el('br')); td.appendChild(el('small', '', l.detalhe)); }
        tr.appendChild(td);
        tr.appendChild(el('td', 'v', estado.mostrarValores && l.valor !== '' ? real(paraNumero(l.valor)) : ''));
        t.appendChild(tr);
      });
      d.appendChild(t);
    }
    CARDAPIO.map(function(x){ return x.nome; }).concat(['Outros']).forEach(function(catNome){
      tabelaDe(catNome, estado.linhas.filter(function(l){ return (l.cat || 'Outros') === catNome && l.nome; }));
    });
    tabelaDe('Equipe e serviços', estado.extras.filter(function(l){ return l.nome; }));
    var tot = el('div', 'doc-total');
    tot.appendChild(el('span', '', 'Total'));
    tot.appendChild(el('span', '', real(total())));
    d.appendChild(tot);
    var f = estado.fecho;
    var notas = el('div', 'doc-notas');
    if(f.validade) notas.appendChild(el('p', '', 'Validade: ' + f.validade));
    if(f.pagamento) notas.appendChild(el('p', '', 'Pagamento: ' + f.pagamento));
    if(f.obs) notas.appendChild(el('p', '', 'Observações: ' + f.obs));
    d.appendChild(notas);
    d.appendChild(el('div', 'doc-rodape', 'Buffet Real · @buffetreal_miriammarinho · Itabirito-MG e região'));
  }

  function mudou(){
    document.getElementById('total').textContent = real(total());
    document.getElementById('previa').textContent = resposta();
    guarda(CHAVE_RASCUNHO, estado);
  }

  /* ---------- link do cardápio com os pratos marcados ---------- */
  function linkCardapio(){
    var partes = [];
    estado.linhas.forEach(function(l){
      if(!l.ref) return;
      var p = l.ref.split('.');
      var item = CARDAPIO[+p[0]] && CARDAPIO[+p[0]].itens[+p[1]];
      if(!item) return;
      var tok = l.ref;
      l.opcoes.forEach(function(op){
        var k = (item.opcoes || []).indexOf(op);
        if(k > -1) tok += '-' + k;
      });
      if(partes.indexOf(tok) < 0) partes.push(tok);
    });
    return new URL('./', window.location.href).href + '#selecao=' + partes.join('_');
  }

  function copia(texto, msg){
    var p = navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(texto) : Promise.reject();
    p.then(function(){ avisa(msg); }).catch(function(){
      var t = el('textarea'); t.value = texto; document.body.appendChild(t); t.select();
      try{ document.execCommand('copy'); avisa(msg); }catch(e){ avisa('Não consegui copiar. Selecione o texto e copie.'); }
      t.remove();
    });
  }

  /* ---------- eventos ---------- */
  var selectAdd = document.getElementById('add-prato');
  CARDAPIO.forEach(function(cat, ci){
    if(!(cat.itens || []).length) return;
    var g = el('optgroup');
    g.label = cat.nome;
    cat.itens.forEach(function(item, ii){
      var o = el('option', '', item.nome);
      o.value = ci + '.' + ii;
      g.appendChild(o);
    });
    selectAdd.appendChild(g);
  });
  selectAdd.addEventListener('change', function(){
    if(!selectAdd.value) return;
    var p = selectAdd.value.split('.');
    var cat = CARDAPIO[+p[0]], item = cat.itens[+p[1]];
    estado.linhas.push(preencheDaTabela(novaLinha({ nome: item.nome, cat: cat.nome, ref: selectAdd.value })));
    selectAdd.value = '';
    desenha();
  });
  document.getElementById('add-livre').addEventListener('click', function(){
    estado.linhas.push(novaLinha({ nome: '', cat: 'Outros' }));
    desenha();
    var nomes = document.querySelectorAll('#linhas-cardapio .nome');
    if(nomes.length) nomes[nomes.length - 1].focus();
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-add-extra]'), function(b){
    b.addEventListener('click', function(){
      estado.extras.push(preencheDaTabela(novaLinha({ nome: b.dataset.addExtra })));
      desenha();
      if(!b.dataset.addExtra){
        var nomes = document.querySelectorAll('#linhas-extras .nome');
        nomes[nomes.length - 1].focus();
      }
    });
  });

  CAMPOS.forEach(function(c){
    var e = document.querySelector('[data-campo="' + c + '"]');
    e.addEventListener('input', function(){ estado.campos[c] = e.value; mudou(); });
  });
  ['validade','pagamento','obs'].forEach(function(c){
    var e = document.querySelector('[data-fecho="' + c + '"]');
    e.addEventListener('input', function(){ estado.fecho[c] = e.value; mudou(); });
  });
  document.getElementById('mostrar-valores').addEventListener('change', function(){ estado.mostrarValores = this.checked; mudou(); });

  document.getElementById('ler-pedido').addEventListener('click', function(){
    var txt = document.getElementById('pedido-colado').value;
    if(!txt.trim()){ avisa('Cole a mensagem do pedido primeiro.'); return; }
    var lido = lerPedido(txt);
    if(!lido.linhas.length && !lido.campos.nome){
      avisa('Não reconheci um pedido do site. Confira se colou a mensagem inteira.');
      return;
    }
    lido.fecho = estado.fecho.validade || estado.fecho.pagamento ? { validade: estado.fecho.validade, pagamento: estado.fecho.pagamento, obs: '' } : lido.fecho;
    estado = lido;
    desenha();
    avisa('Pedido lido: ' + estado.linhas.length + ' itens. Agora é só colocar os valores.');
    document.getElementById('t2').scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('em-branco').addEventListener('click', function(){
    estado = novoEstado();
    desenha();
    document.getElementById('c-nome').focus();
  });
  document.getElementById('novo').addEventListener('click', function(){
    estado = novoEstado();
    apaga(CHAVE_RASCUNHO);
    document.getElementById('pedido-colado').value = '';
    document.getElementById('area-orcamento').hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('enviar').addEventListener('click', function(){
    var dig = String(estado.campos.whatsapp || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
    var destino = dig.length === 10 || dig.length === 11 ? '55' + dig : '';
    var url = 'https://wa.me/' + destino + '?text=' + encodeURIComponent(resposta());
    var j = window.open(url, '_blank', 'noopener');
    if(!j) window.location.href = url;
    if(!destino) avisa('Sem WhatsApp do cliente: escolha o contato no WhatsApp.');
  });
  document.getElementById('copiar').addEventListener('click', function(){ copia(resposta(), 'Orçamento copiado.'); });
  document.getElementById('imprimir').addEventListener('click', function(){ desenhaDocumento(); window.print(); });
  window.addEventListener('beforeprint', desenhaDocumento);
  document.getElementById('link-cardapio').addEventListener('click', function(){
    if(!estado.linhas.some(function(l){ return l.ref; })){ avisa('Adicione pratos do cardápio para gerar o link.'); return; }
    copia(linkCardapio(), 'Link do cardápio copiado. Cole na conversa com o cliente.');
  });

  /* ---------- início: retoma o rascunho ---------- */
  var rascunho = le(CHAVE_RASCUNHO);
  if(rascunho && (rascunho.linhas || []).length + (rascunho.extras || []).length > 0){
    estado = Object.assign(novoEstado(), rascunho);
    desenha();
    avisa('Orçamento anterior retomado. Use “Novo orçamento” para começar outro.');
  }

  // para testes automatizados
  window.__montador = { lerPedido: lerPedido, resposta: resposta, estado: function(){ return estado; } };
})();
