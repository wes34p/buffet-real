/* Buffet Real: cardápio interativo, "Meu cardápio" e pedido de orçamento pelo WhatsApp.
 * Os pratos vêm do cardapio-data.js (window.BUFFET_CARDAPIO).
 * O formato da mensagem é lido pelo orcamento.html (montador da Miriam):
 * se mudar títulos de bloco aqui, ajuste o leitor de lá também.
 */
(function(){
  'use strict';

  var WHATSAPP = '5531980217336';
  var CHAVE = 'buffetreal:pedido:v1';
  var CARDAPIO = window.BUFFET_CARDAPIO || [];
  var CAMPOS = ['nome','whatsapp','tipo','data','horario','convidados','local','detalhes'];
  var OBRIGATORIOS = ['nome','whatsapp','tipo','data','convidados'];

  var SVG_MAIS = '<svg class="ic-mais" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 3v10M3 8h10"/></svg>';
  var SVG_OK = '<svg class="ic-ok" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';

  /* ==========================================================
     1. Imagens opcionais: sem o arquivo, nada quebra
     ========================================================== */
  function trataFalhaImagem(img){
    var src = img.getAttribute('src') || '';
    if(img.dataset.tentouJpg !== '1' && /\.webp$/i.test(src)){
      img.dataset.tentouJpg = '1';
      img.src = src.replace(/\.webp$/i, '.jpg');
      return;
    }
    var bloco = img.closest('[data-oculta-se-falhar]');
    if(bloco){ bloco.hidden = true; return; }
    var figura = img.closest('.trabalho');
    if(figura){
      var legenda = figura.querySelector('figcaption');
      var rotulo = img.dataset.espera || (legenda ? legenda.textContent : '');
      var moldura = el('div', 'moldura-espera');
      moldura.appendChild(el('span', 'ico', '✦'));
      moldura.appendChild(el('span', '', rotulo));
      figura.replaceChildren(moldura);
      var nota = document.getElementById('nota-fotos');
      if(nota) nota.hidden = false;
      return;
    }
    img.remove();
  }
  document.addEventListener('error', function(e){
    var alvo = e.target;
    if(alvo && alvo.tagName === 'IMG' && alvo.dataset.opcional === '1') trataFalhaImagem(alvo);
  }, true);
  Array.prototype.forEach.call(document.querySelectorAll('img[data-opcional="1"]'), function(img){
    if(img.complete && img.naturalWidth === 0) trataFalhaImagem(img);
  });
  var imgCertificado = document.querySelector('#bloco-certificado img');
  if(imgCertificado){
    var mostraCertificado = function(){ document.getElementById('bloco-certificado').hidden = false; };
    if(imgCertificado.complete && imgCertificado.naturalWidth > 0) mostraCertificado();
    else imgCertificado.addEventListener('load', mostraCertificado);
  }

  /* ==========================================================
     2. Utilidades
     ========================================================== */
  function el(tag, classe, texto){
    var e = document.createElement(tag);
    if(classe) e.className = classe;
    if(texto !== undefined) e.textContent = texto;
    return e;
  }
  function slug(t){
    return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function normaliza(t){ return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function plural(n, um, varios){ return n + ' ' + (n === 1 ? um : varios); }

  var toastTimer;
  function avisa(texto){
    var t = document.getElementById('toast');
    t.textContent = texto;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ t.hidden = true; }, 3200);
  }

  // índice dos pratos: id -> { item, cat }
  var INDICE = {};
  CARDAPIO.forEach(function(cat, ci){
    (cat.itens || []).forEach(function(item, ii){
      item.id = item.id || (cat.id + '--' + slug(item.nome));
      INDICE[item.id] = { item: item, cat: cat, ci: ci, ii: ii };
    });
  });
  // imagens ilustrativas (cardapio-imagens.js, gerado pelo importador)
  var IMAGENS = window.BUFFET_IMAGENS || { capas: {}, itens: {} };
  var temImagens = false;
  CARDAPIO.forEach(function(cat){
    cat.capa = cat.capa || (IMAGENS.capas || {})[cat.id];
    (cat.itens || []).forEach(function(item){
      item.imagem = item.imagem || (IMAGENS.itens || {})[item.id];
      if(item.imagem) temImagens = true;
    });
    if(cat.capa) temImagens = true;
  });

  function categoriaPorId(id){
    for(var i = 0; i < CARDAPIO.length; i++) if(CARDAPIO[i].id === id) return CARDAPIO[i];
    return null;
  }

  /* ==========================================================
     3. Estado (guardado no aparelho do cliente)
     ========================================================== */
  var estado = { itens: {}, interesse: [], equipe: [], vasilhames: false, campos: {} };

  function limpaEstadoInvalido(e){
    var limpo = { itens: {}, interesse: [], equipe: [], vasilhames: !!e.vasilhames, campos: {} };
    Object.keys(e.itens || {}).forEach(function(id){
      if(!INDICE[id]) return;
      var ops = INDICE[id].item.opcoes || [];
      limpo.itens[id] = { opcoes: (e.itens[id].opcoes || []).filter(function(o){ return ops.indexOf(o) > -1; }) };
    });
    limpo.interesse = (e.interesse || []).filter(categoriaPorId);
    limpo.equipe = (e.equipe || []).filter(function(x){ return ['Cozinha','Garçons','Portaria','Limpeza'].indexOf(x) > -1; });
    CAMPOS.forEach(function(c){ if(e.campos && typeof e.campos[c] === 'string') limpo.campos[c] = e.campos[c]; });
    return limpo;
  }
  function carrega(){
    try{
      var bruto = window.localStorage.getItem(CHAVE);
      if(bruto) estado = limpaEstadoInvalido(JSON.parse(bruto));
    }catch(err){ /* sem armazenamento: segue só na memória */ }
  }
  function salva(){
    try{ window.localStorage.setItem(CHAVE, JSON.stringify(estado)); }catch(err){}
  }

  function totalItens(){ return Object.keys(estado.itens).length; }
  function itensDaCategoria(cat){
    return (cat.itens || []).filter(function(item){ return !!estado.itens[item.id]; });
  }
  function temInteresse(catId){ return estado.interesse.indexOf(catId) > -1; }

  // categorias com pratos ou com pedido de sugestão, na ordem do cardápio
  function selecaoAgrupada(){
    var grupos = [];
    CARDAPIO.forEach(function(cat){
      var itens = itensDaCategoria(cat);
      if(itens.length || temInteresse(cat.id)) grupos.push({ cat: cat, itens: itens, sugestao: temInteresse(cat.id) });
    });
    return grupos;
  }

  function alternaItem(id){
    if(estado.itens[id]) delete estado.itens[id];
    else estado.itens[id] = { opcoes: [] };
    atualiza();
  }
  function alternaOpcao(id, opcao, marcado){
    if(!estado.itens[id]) estado.itens[id] = { opcoes: [] };
    var ops = estado.itens[id].opcoes;
    var pos = ops.indexOf(opcao);
    if(marcado && pos < 0) ops.push(opcao);
    if(!marcado && pos > -1) ops.splice(pos, 1);
    atualiza();
  }
  function alternaInteresse(catId, ligar){
    var pos = estado.interesse.indexOf(catId);
    if(ligar === undefined) ligar = pos < 0;
    if(ligar && pos < 0) estado.interesse.push(catId);
    if(!ligar && pos > -1) estado.interesse.splice(pos, 1);
    atualiza();
  }
  function alternaEquipe(nome, ligar){
    var pos = estado.equipe.indexOf(nome);
    if(ligar === undefined) ligar = pos < 0;
    if(ligar && pos < 0) estado.equipe.push(nome);
    if(!ligar && pos > -1) estado.equipe.splice(pos, 1);
    atualiza();
  }
  function textoOpcoes(id){
    var ops = (estado.itens[id] && estado.itens[id].opcoes) || [];
    return ops.join(', ');
  }

  /* ==========================================================
     4. Cardápio: abas, painéis, cards e busca
     ========================================================== */
  var abas = document.getElementById('cardapio-abas');
  var paineis = document.getElementById('cardapio-paineis');
  var painelBusca = document.getElementById('painel-busca');
  var busca = document.getElementById('busca-prato');
  var buscaLimpar = document.getElementById('busca-limpar');
  var abaAtiva = CARDAPIO.length ? CARDAPIO[0].id : '';

  function criaPrato(item, cat, mostrarCategoria){
    var li = el('li', 'prato');
    li.dataset.id = item.id;

    var botao = el('button', 'prato-botao');
    botao.type = 'button';
    botao.setAttribute('aria-pressed', 'false');
    if(item.imagem){
      li.classList.add('prato--foto');
      var moldura = el('span', 'prato-foto');
      var img = el('img');
      img.src = item.imagem;
      img.srcset = item.imagem.replace(/\.webp$/, '-p.webp') + ' 360w, ' + item.imagem + ' 720w';
      img.sizes = '(max-width: 699px) 84px, 300px';
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 720;
      img.height = 540;
      img.addEventListener('error', function(){ moldura.remove(); li.classList.remove('prato--foto'); });
      moldura.appendChild(img);
      botao.appendChild(moldura);
    }
    var texto = el('span', 'prato-texto');
    if(mostrarCategoria) texto.appendChild(el('span', 'prato-cat', cat.nome));
    texto.appendChild(el('span', 'prato-nome', item.nome));
    if(item.descricao) texto.appendChild(el('span', 'prato-desc', item.descricao));
    botao.appendChild(texto);
    var marca = el('span', 'prato-marca');
    marca.innerHTML = SVG_MAIS + SVG_OK;
    botao.appendChild(marca);
    botao.addEventListener('click', function(){ alternaItem(item.id); });
    li.appendChild(botao);

    if(item.opcoes && item.opcoes.length){
      var caixa = el('div', 'prato-opcoes');
      caixa.hidden = true;
      caixa.appendChild(el('p', 'rotulo', (item.rotuloOpcoes || 'Opções') + ' (marque quantos quiser)'));
      var lista = el('div', 'opcoes');
      item.opcoes.forEach(function(op){
        var rotulo = el('label', 'chip chip--mini');
        var caixaMarcar = el('input');
        caixaMarcar.type = 'checkbox';
        caixaMarcar.value = op;
        caixaMarcar.dataset.opcaoDe = item.id;
        caixaMarcar.addEventListener('change', function(){ alternaOpcao(item.id, op, this.checked); });
        rotulo.appendChild(caixaMarcar);
        var m = el('span', 'marca-chip'); m.setAttribute('aria-hidden', 'true');
        rotulo.appendChild(m);
        rotulo.appendChild(document.createTextNode(op));
        lista.appendChild(rotulo);
      });
      caixa.appendChild(lista);
      li.appendChild(caixa);
    }
    return li;
  }

  function criaSugestao(cat, destaque){
    var box = el('div', 'sugestao' + (destaque ? ' sugestao--destaque' : ''));
    var texto = el('div');
    if(destaque){
      texto.appendChild(el('strong', '', 'Mesa de frios'));
      texto.appendChild(el('p', '', 'As opções são combinadas direto com a Miriam. Inclua no pedido e ela apresenta as sugestões.'));
    } else {
      texto.appendChild(el('strong', '', 'Ficou em dúvida?'));
      texto.appendChild(el('p', '', 'Peça para a Miriam sugerir ' + cat.nome.toLowerCase() + ' que combinam com o seu evento.'));
    }
    box.appendChild(texto);
    var botao = el('button', 'btn-categoria btn-alterna');
    botao.type = 'button';
    botao.dataset.interesse = cat.id;
    botao.setAttribute('aria-pressed', 'false');
    botao.addEventListener('click', function(){ alternaInteresse(cat.id); });
    box.appendChild(botao);
    return box;
  }

  function montaPaineis(){
    CARDAPIO.forEach(function(cat, i){
      // aba
      var aba = el('button', 'cardapio-aba');
      aba.type = 'button';
      aba.id = 'aba-' + cat.id;
      aba.setAttribute('role', 'tab');
      aba.setAttribute('aria-controls', 'painel-' + cat.id);
      aba.dataset.cat = cat.id;
      aba.appendChild(el('span', '', cat.nome));
      var cont = el('span', 'aba-contador');
      cont.hidden = true;
      aba.appendChild(cont);
      aba.addEventListener('click', function(){ ativaAba(cat.id, { atualizaEndereco: true }); });
      abas.appendChild(aba);

      // painel
      var painel = el('div', 'cardapio-painel');
      painel.id = 'painel-' + cat.id;
      painel.setAttribute('role', 'tabpanel');
      painel.setAttribute('aria-labelledby', 'aba-' + cat.id);
      painel.tabIndex = -1;

      var cabeca = el('div', 'painel-cabeca');
      cabeca.appendChild(el('h3', '', cat.nome));
      if(cat.apelido) cabeca.appendChild(el('span', 'painel-apelido', cat.apelido));
      if(cat.capa){
        var capa = el('div', 'painel-capa');
        var imgCapa = el('img');
        imgCapa.src = cat.capa;
        imgCapa.srcset = cat.capa.replace(/\.webp$/, '-p.webp') + ' 800w, ' + cat.capa + ' 1600w';
        imgCapa.sizes = '(max-width: 999px) 100vw, 800px';
        imgCapa.alt = '';
        imgCapa.loading = 'lazy';
        imgCapa.decoding = 'async';
        imgCapa.width = 1600;
        imgCapa.height = 686;
        imgCapa.addEventListener('error', function(){ capa.replaceWith(cabeca); });
        capa.appendChild(imgCapa);
        capa.appendChild(cabeca);
        painel.appendChild(capa);
      } else {
        painel.appendChild(cabeca);
      }
      if(cat.descricao) painel.appendChild(el('p', 'painel-desc', cat.descricao));

      var itens = cat.itens || [];
      if(!itens.length){
        painel.appendChild(criaSugestao(cat, true));
      } else {
        var grupos = [];
        itens.forEach(function(item){
          var g = item.grupo || '';
          if(!grupos.length || grupos[grupos.length - 1].nome !== g) grupos.push({ nome: g, itens: [] });
          grupos[grupos.length - 1].itens.push(item);
        });
        if(grupos.length > 1){
          var nav = el('nav', 'grupos-nav');
          nav.setAttribute('aria-label', 'Partes de ' + cat.nome);
          grupos.forEach(function(g){
            var a = el('a', '', g.nome);
            a.href = '#grupo-' + cat.id + '-' + slug(g.nome);
            nav.appendChild(a);
          });
          painel.appendChild(nav);
        }
        grupos.forEach(function(g){
          if(g.nome){
            var titulo = el('h4', 'grupo-titulo', g.nome);
            titulo.id = 'grupo-' + cat.id + '-' + slug(g.nome);
            painel.appendChild(titulo);
          }
          var ul = el('ul', 'pratos');
          g.itens.forEach(function(item){ ul.appendChild(criaPrato(item, cat, false)); });
          painel.appendChild(ul);
        });
        painel.appendChild(criaSugestao(cat, false));
      }
      painel.hidden = i !== 0;
      paineis.appendChild(painel);
    });
  }

  function ativaAba(catId, opcoes){
    opcoes = opcoes || {};
    if(!categoriaPorId(catId)) return;
    abaAtiva = catId;
    if(busca.value){ busca.value = ''; aplicaBusca(); }
    Array.prototype.forEach.call(abas.children, function(aba){
      var ativa = aba.dataset.cat === catId;
      aba.setAttribute('aria-selected', String(ativa));
      aba.tabIndex = ativa ? 0 : -1;
      if(ativa && aba.scrollIntoView && opcoes.centraliza !== false){
        var r = aba.getBoundingClientRect(), pr = abas.getBoundingClientRect();
        if(r.left < pr.left || r.right > pr.right) abas.scrollLeft += r.left - pr.left - 12;
      }
    });
    Array.prototype.forEach.call(paineis.children, function(p){ p.hidden = p.id !== 'painel-' + catId; });
    if(opcoes.foco) document.getElementById('aba-' + catId).focus();
    if(opcoes.atualizaEndereco && window.history && history.replaceState){
      history.replaceState(null, '', '#cardapio-' + catId);
    }
    // ao trocar de aba com a barra fixa no topo, volta para o começo da lista
    var barra = document.querySelector('.cardapio-barra');
    if(opcoes.atualizaEndereco && barra && barra.getBoundingClientRect().top <= 1){
      var alvo = document.querySelector('.cardapio-principal');
      window.scrollTo({ top: alvo.getBoundingClientRect().top + window.pageYOffset - 2, behavior: 'smooth' });
    }
  }

  abas.addEventListener('keydown', function(e){
    var ids = CARDAPIO.map(function(c){ return c.id; });
    var pos = ids.indexOf(abaAtiva);
    var novo = null;
    if(e.key === 'ArrowRight') novo = ids[(pos + 1) % ids.length];
    if(e.key === 'ArrowLeft') novo = ids[(pos - 1 + ids.length) % ids.length];
    if(e.key === 'Home') novo = ids[0];
    if(e.key === 'End') novo = ids[ids.length - 1];
    if(novo){ e.preventDefault(); ativaAba(novo, { foco: true, atualizaEndereco: true }); }
  });

  function aplicaBusca(){
    var q = normaliza(busca.value.trim());
    buscaLimpar.hidden = !busca.value;
    if(q.length < 2){
      painelBusca.hidden = true;
      painelBusca.replaceChildren();
      paineis.hidden = false;
      Array.prototype.forEach.call(abas.children, function(aba){ aba.setAttribute('aria-selected', String(aba.dataset.cat === abaAtiva)); });
      return;
    }
    Array.prototype.forEach.call(abas.children, function(aba){ aba.setAttribute('aria-selected', 'false'); });
    var achados = [];
    CARDAPIO.forEach(function(cat){
      (cat.itens || []).forEach(function(item){
        var alvo = normaliza(item.nome + ' ' + (item.descricao || '') + ' ' + (item.opcoes || []).join(' '));
        if(alvo.indexOf(q) > -1) achados.push({ item: item, cat: cat });
      });
    });
    paineis.hidden = true;
    painelBusca.hidden = false;
    painelBusca.replaceChildren();
    if(!achados.length){
      painelBusca.appendChild(el('p', 'busca-info', 'Nenhum prato encontrado com “' + busca.value.trim() + '”. Tente outra palavra ou escreva o que deseja nas observações do pedido.'));
      return;
    }
    painelBusca.appendChild(el('p', 'busca-info', plural(achados.length, 'prato encontrado', 'pratos encontrados') + ' para “' + busca.value.trim() + '”.'));
    var ul = el('ul', 'pratos');
    achados.forEach(function(a){ ul.appendChild(criaPrato(a.item, a.cat, true)); });
    painelBusca.appendChild(ul);
    atualizaCards();
  }
  busca.addEventListener('input', aplicaBusca);
  buscaLimpar.addEventListener('click', function(){ busca.value = ''; aplicaBusca(); busca.focus(); });

  /* ==========================================================
     5. "Meu cardápio": lateral, gaveta e resumo do formulário
     ========================================================== */
  // depois de remover, o foco vai para o próximo "×" (ou para o fechar da gaveta)
  function devolveFoco(caixa){
    var proximo = caixa.querySelector('.mc-remover');
    if(proximo){ proximo.focus(); return; }
    var dialogo = caixa.closest('dialog');
    if(dialogo) document.getElementById('fecha-gaveta').focus();
  }

  function renderLista(caixa){
    caixa.replaceChildren();
    var grupos = selecaoAgrupada();
    if(!grupos.length){
      var vazio = el('p', 'mc-vazio');
      if(caixa.dataset.vazioForm){
        vazio.textContent = 'Você ainda não escolheu pratos. ';
        var link = el('a', '', 'Abrir o cardápio');
        link.href = '#cardapio';
        vazio.appendChild(link);
        vazio.appendChild(document.createTextNode(' ou marque abaixo as categorias para a Miriam sugerir.'));
      } else {
        vazio.textContent = 'Toque nos pratos do cardápio para montar sua seleção. Ela aparece aqui e segue junto com o pedido.';
      }
      caixa.appendChild(vazio);
      return;
    }
    grupos.forEach(function(g){
      caixa.appendChild(el('p', 'mc-cat', g.cat.nome));
      var ul = el('ul', 'mc-itens');
      g.itens.forEach(function(item){
        var li = el('li', 'mc-item');
        var nome = el('span', '', item.nome);
        var ops = textoOpcoes(item.id);
        if(item.opcoes && item.opcoes.length) nome.appendChild(el('small', '', ops || ((item.rotuloOpcoes || 'Opções') + ' a combinar')));
        li.appendChild(nome);
        var rem = el('button', 'mc-remover', '×');
        rem.type = 'button';
        rem.setAttribute('aria-label', 'Remover ' + item.nome);
        rem.addEventListener('click', function(){ alternaItem(item.id); devolveFoco(caixa); });
        li.appendChild(rem);
        ul.appendChild(li);
      });
      if(g.sugestao){
        var li = el('li', 'mc-item mc-item--sugestao');
        li.appendChild(el('span', '', g.itens.length ? 'Aberto a sugestões da Miriam' : 'Quero sugestões da Miriam'));
        var rem = el('button', 'mc-remover', '×');
        rem.type = 'button';
        rem.setAttribute('aria-label', 'Remover pedido de sugestão de ' + g.cat.nome);
        rem.addEventListener('click', function(){ alternaInteresse(g.cat.id, false); devolveFoco(caixa); });
        li.appendChild(rem);
        ul.appendChild(li);
      }
      caixa.appendChild(ul);
    });
  }

  function atualizaCards(){
    Array.prototype.forEach.call(document.querySelectorAll('.prato'), function(li){
      var id = li.dataset.id;
      var escolhido = !!estado.itens[id];
      li.dataset.escolhido = escolhido ? '1' : '0';
      var botao = li.querySelector('.prato-botao');
      botao.setAttribute('aria-pressed', String(escolhido));
      var caixa = li.querySelector('.prato-opcoes');
      if(caixa){
        caixa.hidden = !escolhido;
        Array.prototype.forEach.call(caixa.querySelectorAll('input'), function(inp){
          inp.checked = escolhido && estado.itens[id].opcoes.indexOf(inp.value) > -1;
        });
      }
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-interesse]'), function(b){
      var ligado = temInteresse(b.dataset.interesse);
      b.setAttribute('aria-pressed', String(ligado));
      var cat = categoriaPorId(b.dataset.interesse);
      b.textContent = ligado ? '✓ Incluído no pedido' : ((cat.itens || []).length ? 'Quero sugestões da Miriam' : 'Incluir no pedido');
    });
  }

  function atualizaContadores(){
    var total = totalItens();
    var texto = total ? plural(total, 'item escolhido', 'itens escolhidos') : 'Nenhum item';
    if(!total && estado.interesse.length) texto = 'Só sugestões';
    Array.prototype.forEach.call(document.querySelectorAll('[data-total-texto]'), function(t){ t.textContent = texto; });
    Array.prototype.forEach.call(abas.children, function(aba){
      var cat = categoriaPorId(aba.dataset.cat);
      var n = itensDaCategoria(cat).length;
      var cont = aba.querySelector('.aba-contador');
      cont.hidden = n === 0;
      cont.textContent = n;
      aba.setAttribute('aria-label', cat.nome + (n ? ', ' + plural(n, 'item escolhido', 'itens escolhidos') : ''));
    });
    var bolha = document.getElementById('bolha-total');
    var abre = document.getElementById('abre-gaveta');
    var marcados = total + (total ? 0 : estado.interesse.length);
    bolha.textContent = total || estado.interesse.length;
    abre.hidden = marcados === 0;
    var cta = document.getElementById('barra-cta');
    cta.textContent = marcados ? 'Pedir orçamento' : 'Montar meu cardápio';
    cta.setAttribute('href', marcados ? '#orcamento' : '#cardapio');
    var barraFixa = document.getElementById('barra-mobile');
    if(window.getComputedStyle(barraFixa).display !== 'none'){
      document.documentElement.style.setProperty('--barra-mobile', barraFixa.offsetHeight + 'px');
    }
  }

  function atualizaFormulario(){
    // categorias: marcadas se têm pratos (travadas) ou pedido de sugestão
    Array.prototype.forEach.call(document.querySelectorAll('#chips-categorias input'), function(inp){
      var cat = categoriaPorId(inp.value);
      var temPratos = itensDaCategoria(cat).length > 0;
      inp.checked = temPratos || temInteresse(cat.id);
      inp.disabled = temPratos;
    });
    Array.prototype.forEach.call(document.querySelectorAll('#chips-equipe input[name="equipe"]'), function(inp){
      inp.checked = estado.equipe.indexOf(inp.value) > -1;
    });
    document.getElementById('vasilhames').checked = estado.vasilhames;
    Array.prototype.forEach.call(document.querySelectorAll('[data-equipe]'), function(b){
      var ligado = estado.equipe.indexOf(b.dataset.equipe) > -1;
      b.setAttribute('aria-pressed', String(ligado));
      b.textContent = ligado ? '✓ Incluído no pedido' : 'Incluir no pedido';
    });
    var bv = document.querySelector('[data-vasilhames]');
    bv.setAttribute('aria-pressed', String(estado.vasilhames));
    bv.textContent = estado.vasilhames ? '✓ Incluído no pedido' : 'Quero consultar';
  }

  function atualiza(){
    atualizaCards();
    Array.prototype.forEach.call(document.querySelectorAll('[data-lista-cardapio]'), renderLista);
    atualizaContadores();
    atualizaFormulario();
    salva();
  }

  // chips de categoria do formulário, gerados do cardápio
  var chipsCategorias = document.getElementById('chips-categorias');
  CARDAPIO.forEach(function(cat){
    var rotulo = el('label', 'chip');
    var inp = el('input');
    inp.type = 'checkbox';
    inp.name = 'categoria';
    inp.value = cat.id;
    inp.addEventListener('change', function(){ alternaInteresse(cat.id, this.checked); });
    rotulo.appendChild(inp);
    var m = el('span', 'marca-chip'); m.setAttribute('aria-hidden', 'true');
    rotulo.appendChild(m);
    rotulo.appendChild(document.createTextNode(cat.nome));
    chipsCategorias.appendChild(rotulo);
  });

  Array.prototype.forEach.call(document.querySelectorAll('#chips-equipe input[name="equipe"]'), function(inp){
    inp.addEventListener('change', function(){ alternaEquipe(inp.value, inp.checked); });
  });
  document.getElementById('vasilhames').addEventListener('change', function(){ estado.vasilhames = this.checked; atualiza(); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-equipe]'), function(b){
    b.addEventListener('click', function(){ alternaEquipe(b.dataset.equipe); });
  });
  document.querySelector('[data-vasilhames]').addEventListener('click', function(){ estado.vasilhames = !estado.vasilhames; atualiza(); });

  Array.prototype.forEach.call(document.querySelectorAll('[data-limpar]'), function(b){
    b.addEventListener('click', function(){
      if(!totalItens() && !estado.interesse.length) return;
      estado.itens = {};
      estado.interesse = [];
      atualiza();
      avisa('Seleção limpa. Pode começar de novo.');
    });
  });

  /* ==========================================================
     6. Gaveta do celular e barra fixa
     ========================================================== */
  var gaveta = document.getElementById('gaveta');
  function abreGaveta(){
    if(gaveta.showModal) gaveta.showModal();
    else document.getElementById('orcamento').scrollIntoView({ behavior: 'smooth' });
  }
  function fechaGaveta(){ if(gaveta.open) gaveta.close(); }
  document.getElementById('abre-gaveta').addEventListener('click', abreGaveta);
  document.getElementById('fecha-gaveta').addEventListener('click', fechaGaveta);
  gaveta.addEventListener('click', function(e){ if(e.target === gaveta) fechaGaveta(); });
  Array.prototype.forEach.call(gaveta.querySelectorAll('[data-fecha-gaveta]'), function(a){
    a.addEventListener('click', fechaGaveta);
  });

  var barra = document.getElementById('barra-mobile');
  function ajustaEspacoRodape(){
    var visivel = window.getComputedStyle(barra).display !== 'none';
    document.documentElement.style.setProperty('--barra-mobile', visivel ? barra.offsetHeight + 'px' : '0px');
  }
  ajustaEspacoRodape();
  window.addEventListener('resize', ajustaEspacoRodape);
  var secaoOrcamento = document.getElementById('orcamento');
  // a barra some enquanto os botões do hero estão na tela e dentro do formulário
  var naTela = { topo: true, orcamento: false };
  if('IntersectionObserver' in window){
    var observa = new IntersectionObserver(function(entradas){
      entradas.forEach(function(en){ naTela[en.target === secaoOrcamento ? 'orcamento' : 'topo'] = en.isIntersecting; });
      barra.dataset.oculta = naTela.topo || naTela.orcamento ? '1' : '0';
    }, { threshold: 0.12 });
    observa.observe(document.querySelector('.hero-ctas'));
    observa.observe(secaoOrcamento);
  }

  /* ==========================================================
     7. Compartilhar: cardápio e seleção montada
     Formato: #selecao=<cat>.<item>[-<opção>...]_...~s<cat>
     (índices do cardapio-data.js; a Miriam também gera esse link no montador)
     ========================================================== */
  function codificaSelecao(){
    var partes = [];
    Object.keys(estado.itens).forEach(function(id){
      var ref = INDICE[id];
      var token = ref.ci + '.' + ref.ii;
      estado.itens[id].opcoes.forEach(function(op){
        var k = (ref.item.opcoes || []).indexOf(op);
        if(k > -1) token += '-' + k;
      });
      partes.push(token);
    });
    estado.interesse.forEach(function(catId){
      for(var i = 0; i < CARDAPIO.length; i++) if(CARDAPIO[i].id === catId) partes.push('s' + i);
    });
    return partes.join('_');
  }
  function decodificaSelecao(codigo){
    var sel = { itens: {}, interesse: [] };
    codigo.split('_').forEach(function(token){
      var mS = /^s(\d+)$/.exec(token);
      if(mS){ var c = CARDAPIO[+mS[1]]; if(c) sel.interesse.push(c.id); return; }
      var m = /^(\d+)\.(\d+)((?:-\d+)*)$/.exec(token);
      if(!m) return;
      var cat = CARDAPIO[+m[1]];
      var item = cat && cat.itens && cat.itens[+m[2]];
      if(!item) return;
      var ops = m[3] ? m[3].slice(1).split('-').map(function(k){ return (item.opcoes || [])[+k]; }).filter(Boolean) : [];
      sel.itens[item.id] = { opcoes: ops };
    });
    return sel;
  }
  // abre em nova aba sem depender do retorno do window.open (que é null com noopener)
  function abreLink(url){
    var a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function enderecoBase(){ return window.location.href.split('#')[0]; }

  function compartilha(url, titulo, texto){
    if(navigator.share){
      navigator.share({ title: titulo, text: texto, url: url }).catch(function(){});
      return;
    }
    var copiar = navigator.clipboard && window.isSecureContext
      ? navigator.clipboard.writeText(url)
      : Promise.reject();
    copiar.then(function(){
      avisa('Link copiado. É só colar no WhatsApp.');
    }).catch(function(){
      abreLink('https://wa.me/?text=' + encodeURIComponent(texto + ' ' + url));
    });
  }

  document.getElementById('btn-compartilhar-cardapio').addEventListener('click', function(){
    compartilha(enderecoBase() + '#cardapio', 'Cardápio do Buffet Real',
      'Veja o cardápio do Buffet Real e monte o seu pedido de orçamento:');
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-compartilhar-selecao]'), function(b){
    b.addEventListener('click', function(){
      if(!totalItens() && !estado.interesse.length){
        avisa('Escolha alguns pratos antes de enviar.');
        return;
      }
      compartilha(enderecoBase() + '#selecao=' + codificaSelecao(), 'Cardápio montado no Buffet Real',
        'Montei este cardápio no Buffet Real. Dá uma olhada:');
    });
  });

  var selecaoRecebida = null;
  function trataSelecaoRecebida(codigo){
    var sel = decodificaSelecao(codigo);
    var n = Object.keys(sel.itens).length;
    if(!n && !sel.interesse.length) return;
    var vazio = !totalItens() && !estado.interesse.length;
    var mesmo = codificaSelecao() === codigo;
    if(vazio || mesmo){
      estado.itens = sel.itens;
      estado.interesse = sel.interesse;
      atualiza();
      avisa('Cardápio carregado: ' + plural(n, 'item', 'itens') + '. Confira e peça o orçamento.');
    } else {
      selecaoRecebida = sel;
      document.getElementById('texto-compartilhado').textContent =
        'Você abriu um cardápio montado com ' + plural(n, 'item', 'itens') + '. Quer usar este no lugar da sua seleção atual?';
      document.getElementById('faixa-compartilhado').hidden = false;
    }
  }
  document.getElementById('usar-compartilhado').addEventListener('click', function(){
    if(selecaoRecebida){
      estado.itens = selecaoRecebida.itens;
      estado.interesse = selecaoRecebida.interesse;
      atualiza();
    }
    document.getElementById('faixa-compartilhado').hidden = true;
  });
  document.getElementById('manter-meu').addEventListener('click', function(){
    document.getElementById('faixa-compartilhado').hidden = true;
  });

  function trataEndereco(){
    var h = window.location.hash || '';
    try{ h = decodeURIComponent(h); }catch(err){ return; }
    if(h.indexOf('#selecao=') === 0){
      trataSelecaoRecebida(h.slice(9));
      if(history.replaceState) history.replaceState(null, '', '#cardapio');
      rolaParaCardapio();
      return;
    }
    var m = /^#cardapio-(.+)$/.exec(h);
    if(m && categoriaPorId(m[1])){
      ativaAba(m[1]);
      rolaParaCardapio();
    }
  }
  function rolaParaCardapio(){
    window.setTimeout(function(){
      document.getElementById('cardapio').scrollIntoView({ block: 'start' });
    }, 60);
  }
  window.addEventListener('hashchange', trataEndereco);

  /* ==========================================================
     8. Formulário: campos guardados, validação e mensagem
     ========================================================== */
  var form = document.getElementById('form-orcamento');
  var aviso = document.getElementById('aviso-form');

  function valor(id){
    var e = document.getElementById(id);
    return e ? e.value.trim() : '';
  }
  function hoje(){
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function dataMinimaISO(){
    var d = hoje();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  document.getElementById('data').setAttribute('min', dataMinimaISO());

  function formataTelefone(v){
    var d = v.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11);
    if(d.length <= 2) return d.length ? '(' + d : '';
    if(d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if(d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }
  var campoZap = document.getElementById('whatsapp');
  campoZap.addEventListener('input', function(){
    var fim = campoZap.selectionStart === campoZap.value.length;
    campoZap.value = formataTelefone(campoZap.value);
    if(fim) campoZap.setSelectionRange(campoZap.value.length, campoZap.value.length);
  });

  CAMPOS.forEach(function(id){
    var e = document.getElementById(id);
    if(estado.campos[id]) e.value = estado.campos[id];
    var guarda = function(){ estado.campos[id] = e.value; salva(); limpaErro(id); };
    e.addEventListener('input', guarda);
    e.addEventListener('change', guarda);
  });

  function mostraErro(id, mensagem){
    var campo = document.getElementById(id);
    var caixa = document.getElementById('erro-' + id);
    if(campo) campo.setAttribute('aria-invalid', 'true');
    if(caixa){ caixa.textContent = mensagem; caixa.hidden = false; }
  }
  function limpaErro(id){
    var campo = document.getElementById(id);
    var caixa = document.getElementById('erro-' + id);
    if(campo) campo.removeAttribute('aria-invalid');
    if(caixa){ caixa.textContent = ''; caixa.hidden = true; }
  }
  function dataEhPassada(iso){
    var p = iso.split('-');
    if(p.length !== 3) return false;
    return new Date(+p[0], +p[1] - 1, +p[2]) < hoje();
  }

  function validar(){
    OBRIGATORIOS.forEach(limpaErro);
    aviso.hidden = true;
    var erros = [];
    if(valor('nome') === ''){ mostraErro('nome', 'Precisamos do seu nome para te atender.'); erros.push('nome'); }
    var digitos = valor('whatsapp').replace(/\D/g, '');
    if(digitos === ''){ mostraErro('whatsapp', 'Informe seu WhatsApp para a Miriam responder.'); erros.push('whatsapp'); }
    else if(digitos.length < 10 || digitos.length > 11){ mostraErro('whatsapp', 'Confira o número com DDD, ex.: (31) 98888-7777.'); erros.push('whatsapp'); }
    if(valor('tipo') === ''){ mostraErro('tipo', 'Escolha o tipo de evento.'); erros.push('tipo'); }
    var data = valor('data');
    if(data === ''){ mostraErro('data', 'Informe a data do evento.'); erros.push('data'); }
    else if(dataEhPassada(data)){ mostraErro('data', 'A data do evento não pode ser anterior a hoje.'); erros.push('data'); }
    var conv = valor('convidados');
    if(conv === ''){ mostraErro('convidados', 'Informe quantas pessoas você espera.'); erros.push('convidados'); }
    else if(!/^\d+$/.test(conv) || +conv < 1){ mostraErro('convidados', 'O número de convidados precisa ser 1 ou mais.'); erros.push('convidados'); }

    if(erros.length){
      aviso.textContent = erros.length === 1
        ? 'Falta preencher 1 campo abaixo. Seu cardápio e seus dados foram mantidos.'
        : 'Faltam preencher ' + erros.length + ' campos abaixo. Seu cardápio e seus dados foram mantidos.';
      aviso.hidden = false;
      document.getElementById(erros[0]).focus();
    }
    return erros.length === 0;
  }

  function dataBR(iso){ var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function codigoPedido(){
    var d = new Date();
    var letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var sufixo = '';
    for(var i = 0; i < 3; i++) sufixo += letras[Math.floor(Math.random() * letras.length)];
    return 'BR-' + String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0') + '-' + sufixo;
  }

  function montarMensagem(){
    var L = [];
    L.push('*PEDIDO DE ORÇAMENTO · BUFFET REAL*');
    L.push('Código: ' + codigoPedido());
    L.push('');
    L.push('*EVENTO*');
    L.push('Nome: ' + valor('nome'));
    L.push('WhatsApp: ' + formataTelefone(valor('whatsapp')));
    L.push('Tipo: ' + valor('tipo'));
    L.push('Data: ' + dataBR(valor('data')));
    if(valor('horario')) L.push('Horário: ' + valor('horario'));
    L.push('Convidados: ' + valor('convidados'));
    if(valor('local')) L.push('Local: ' + valor('local'));

    var grupos = selecaoAgrupada();
    L.push('');
    var total = totalItens();
    L.push('*CARDÁPIO ESCOLHIDO*' + (total ? ' (' + plural(total, 'item', 'itens') + ')' : ''));
    if(!grupos.length){
      L.push('Ainda não escolhi. Quero sugestões da Miriam.');
    } else {
      var n = 0;
      grupos.forEach(function(g){
        L.push('');
        L.push('_' + g.cat.nome + '_');
        g.itens.forEach(function(item){
          n++;
          var linha = n + '. ' + item.nome;
          if(item.opcoes && item.opcoes.length){
            linha += ' (' + (textoOpcoes(item.id) || (item.rotuloOpcoes || 'opções').toLowerCase() + ' a combinar') + ')';
          }
          L.push(linha);
        });
        if(g.sugestao) L.push(g.itens.length ? '+ Aberto a sugestões da Miriam' : '+ Quero sugestões da Miriam');
      });
    }

    if(estado.equipe.length){
      L.push('');
      L.push('*EQUIPE*');
      L.push(estado.equipe.join(', '));
    }
    if(estado.vasilhames){
      L.push('');
      L.push('*VASILHAMES*');
      L.push('Quero consultar');
    }
    if(valor('detalhes')){
      L.push('');
      L.push('*OBSERVAÇÕES*');
      L.push(valor('detalhes'));
    }
    L.push('');
    L.push('Pedido enviado pelo cardápio digital do Buffet Real.');
    return L.join('\n');
  }

  var ultimaMensagem = '';
  document.getElementById('btn-copiar-pedido').addEventListener('click', function(){
    var texto = ultimaMensagem || montarMensagem();
    var copiar = navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(texto) : Promise.reject();
    copiar.then(function(){ avisa('Pedido copiado. Cole na conversa com a Miriam.'); })
      .catch(function(){ avisa('Não consegui copiar. Toque em enviar de novo.'); });
  });

  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(!validar()) return;
    ultimaMensagem = montarMensagem();
    abreLink('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(ultimaMensagem));
    document.getElementById('pedido-copiar').hidden = false;
    avisa('Pedido aberto no WhatsApp. Confira e toque em enviar.');
  });

  // atalhos do site que levam ao orçamento fecham a gaveta e rolam suave
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href="#orcamento"]');
    if(!a) return;
    e.preventDefault();
    fechaGaveta();
    secaoOrcamento.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ==========================================================
     9. Dados estruturados do cardápio (schema.org Menu)
     ========================================================== */
  try{
    var ld = document.getElementById('ld-negocio');
    var negocio = JSON.parse(ld.textContent);
    negocio.hasMenu = {
      '@type': 'Menu',
      name: 'Cardápio do Buffet Real',
      hasMenuSection: CARDAPIO.filter(function(c){ return (c.itens || []).length; }).map(function(c){
        return {
          '@type': 'MenuSection',
          name: c.nome,
          hasMenuItem: c.itens.map(function(i){
            var m = { '@type': 'MenuItem', name: i.nome };
            if(i.descricao) m.description = i.descricao;
            return m;
          })
        };
      })
    };
    ld.textContent = JSON.stringify(negocio);
  }catch(err){}

  /* ==========================================================
     Início
     ========================================================== */
  document.getElementById('nota-ilustrativa').hidden = !temImagens;
  carrega();
  CAMPOS.forEach(function(id){ if(estado.campos[id]) document.getElementById(id).value = estado.campos[id]; });
  montaPaineis();
  ativaAba(abaAtiva, { centraliza: false });
  atualiza();
  trataEndereco();
})();
