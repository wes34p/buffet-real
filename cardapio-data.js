/* Cardápio do Buffet Real (fonte única do site e do montador de orçamento).
 *
 * Origem: listas enviadas por Miriam Marinho pelo WhatsApp em 20/10/2026
 * ("comida de buteco", "salgados" e "opções de cardápio").
 * Só a grafia foi padronizada; nenhum prato foi acrescentado.
 *
 * Como editar:
 *  - Para incluir um prato, copie uma linha { nome: "..." } dentro da categoria certa.
 *  - "descricao" é opcional: use só o que a Miriam informar.
 *  - "opcoes" lista variações que o cliente pode marcar (sabores, molhos).
 *  - "grupo" organiza a categoria em blocos (usado em Prato principal).
 *  - "imagem" é opcional: "img/cardapio/nome-do-prato.webp", só com foto real do Buffet Real.
 *  - Não mude o "id" de uma categoria depois de publicada: ele é usado nos links
 *    (ex.: site/#cardapio-salgados) e no QR Code.
 *  - Prato novo entra no FIM da sua categoria (ou do seu grupo, no fim da lista).
 *    Não reordene nem apague pratos do meio: o link de seleção compartilhada
 *    (#selecao=) usa a posição de cada prato.
 */
window.BUFFET_CARDAPIO = [
  {
    id: "petiscos",
    nome: "Petiscos",
    apelido: "Comida de buteco",
    descricao: "Comida de buteco para servir durante a festa.",
    itens: [
      { nome: "Pastel de angu" },
      { nome: "Pastel de feira" },
      { nome: "Batata frita" },
      { nome: "Mandioca frita" },
      { nome: "Linguicinha" },
      { nome: "Torresmo" },
      { nome: "Moela com pão" },
      { nome: "Carne cozida ao molho de cerveja preta", descricao: "Servida com mini pãezinhos." },
      { nome: "Espetinho de frango com bacon" },
      { nome: "Espetinho de lombo com bacon" },
      { nome: "Espetinho de boi" },
      { nome: "Kibe frito" },
      { nome: "Batata calabresa", descricao: "Batata cozida com casca e temperada." },
      { nome: "Frango à passarinho" },
      { nome: "Buraco quente", descricao: "Mini pão com molho de carne moída." },
      { nome: "Filé de tilápia frita", descricao: "Acompanha molho rosé." },
      { nome: "Bolinho de bacalhau" },
      { nome: "Batata rústica", descricao: "Batata com cortes rústicos." },
      { nome: "Linguiça toscana acebolada" },
      { nome: "Pão de queijo com pernil" }
    ]
  },
  {
    id: "salgados",
    nome: "Salgados",
    apelido: "Para servir à vontade",
    descricao: "Salgados fritos e assados, folhados, quiches e espetinhos para receber os convidados.",
    itens: [
      { nome: "Coxinha de frango" },
      { nome: "Dadinho de tapioca" },
      { nome: "Quibe" },
      { nome: "Risole de milho" },
      { nome: "Risole de carne" },
      { nome: "Empada de frango com azeitona" },
      { nome: "Empada de alho-poró" },
      { nome: "Empada de queijo" },
      { nome: "Esfirra de carne e frango" },
      { nome: "Bolinha italiana" },
      { nome: "Bolinha de queijo" },
      { nome: "Pastel de feira", rotuloOpcoes: "Sabores", opcoes: ["Carne", "Queijo", "Frango com catupiry"] },
      { nome: "Pastel de angu" },
      { nome: "Pastel assado de frango com azeitona" },
      { nome: "Croquete de carne" },
      { nome: "Enroladinho de salsicha" },
      { nome: "Bolinho de bacalhau" },
      { nome: "Folhado de bacalhau" },
      { nome: "Folhado de abacaxi" },
      { nome: "Folhado Romeu e Julieta" },
      { nome: "Folhado de ameixa com bacon" },
      { nome: "Quiche de alho-poró" },
      { nome: "Quiche de carne seca" },
      { nome: "Espetinho de frango com bacon" },
      { nome: "Espetinho de boi" },
      { nome: "Espetinho de pernil com bacon" }
    ]
  },
  {
    id: "prato-principal",
    nome: "Prato principal",
    apelido: "A refeição do evento",
    descricao: "Arroz e feijão, carnes, batatas e escondidinhos, massas, pratos e saladas.",
    itens: [
      { grupo: "Arroz e feijão", nome: "Arroz branco" },
      { grupo: "Arroz e feijão", nome: "Arroz à grega" },
      { grupo: "Arroz e feijão", nome: "Arroz temperado" },
      { grupo: "Arroz e feijão", nome: "Feijão rico" },
      { grupo: "Arroz e feijão", nome: "Tutu de feijão" },
      { grupo: "Arroz e feijão", nome: "Feijão tropeiro" },
      { grupo: "Arroz e feijão", nome: "Feijoada" },

      { grupo: "Carnes", nome: "Lagarto recheado ao molho madeira" },
      { grupo: "Carnes", nome: "Pernil fatiado ao molho madeira" },
      { grupo: "Carnes", nome: "Lombo recheado com bacon" },
      { grupo: "Carnes", nome: "Lombo recheado com bacon e fatias de abacaxi" },
      { grupo: "Carnes", nome: "Sobrecoxas assadas" },
      { grupo: "Carnes", nome: "Sobrecoxa empanada frita" },
      { grupo: "Carnes", nome: "Filé mignon ao molho madeira" },
      { grupo: "Carnes", nome: "Lombo assado ao molho" },
      { grupo: "Carnes", nome: "Lagarto assado ao molho" },

      { grupo: "Batatas e escondidinhos", nome: "Batata gratinada", rotuloOpcoes: "Preparo", opcoes: ["Com alho-poró", "Sem alho-poró"] },
      { grupo: "Batatas e escondidinhos", nome: "Purê de batatas" },
      { grupo: "Batatas e escondidinhos", nome: "Escondidinho de batata com carne bolonhesa e queijo" },
      { grupo: "Batatas e escondidinhos", nome: "Escondidinho de mandioca com carne seca" },
      { grupo: "Batatas e escondidinhos", nome: "Escondidinho de frango" },

      { grupo: "Massas", nome: "Macarrão na chapa" },
      {
        grupo: "Massas",
        nome: "Macarrão penne",
        rotuloOpcoes: "Molhos",
        opcoes: [
          "Molho bolonhesa",
          "Molho branco com filé mignon",
          "Molho strogonoff",
          "Molho branco com alho-poró",
          "Molho branco tradicional",
          "Molho 3 queijos",
          "Molho madeira com carne desfiada"
        ]
      },

      { grupo: "Strogonoff e outros pratos", nome: "Umbigo de banana", descricao: "Com carne moída, bacon e calabresa." },
      { grupo: "Strogonoff e outros pratos", nome: "Strogonoff de frango" },
      { grupo: "Strogonoff e outros pratos", nome: "Strogonoff de carne" },
      { grupo: "Strogonoff e outros pratos", nome: "Fricassê de frango" },

      { grupo: "Saladas", nome: "Salpicão" },
      { grupo: "Saladas", nome: "Maionese de legumes" },
      { grupo: "Saladas", nome: "Macarronese", descricao: "Salada de macarrão parafuso." },
      { grupo: "Saladas", nome: "Salada tropical", descricao: "Alface americana, alface roxa, tomate-cereja, manga e abacaxi. Pode acrescentar a fruta de sua preferência." },
      { grupo: "Saladas", nome: "Salada de folhas", descricao: "Alface comum, alface roxa e rúcula." },
      { grupo: "Saladas", nome: "Salada de couve com laranja" },
      { grupo: "Saladas", nome: "Vinagrete" },
      { grupo: "Saladas", nome: "Salada primavera", descricao: "Salada de legumes." }
    ]
  },
  {
    id: "mesa-de-frios",
    nome: "Mesa de frios",
    apelido: "Sob consulta",
    descricao: "As opções da mesa de frios são combinadas com a Miriam.",
    itens: []
  }
];
