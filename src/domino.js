'use strict';

/**
 * Dominó (duplo-seis) para 2 jogadores.
 *
 * Regras:
 *  1. O jogo tem 28 pedras (0-0 até 6-6). Cada jogador recebe 7 e as 14 restantes formam o monte.
 *  2. Abre a partida o jogador que tiver a maior carroça (pedra dupla). Sem carroças, abre quem tiver
 *     a pedra de maior soma (empate na soma: a de maior lado). A primeira jogada é obrigatoriamente
 *     com essa pedra.
 *  3. Cada pedra jogada precisa encaixar (mesmo número) em uma das duas pontas da mesa.
 *  4. Quem não tem pedra que encaixe compra do monte até conseguir jogar. Com o monte vazio, passa a vez.
 *  5. Vence por batida quem ficar sem pedras; recebe a soma dos pontos da mão do adversário.
 *  6. Se os dois passarem seguidamente o jogo está fechado: vence quem tiver a menor soma de pontos
 *     na mão (recebe a soma da mão do adversário). Somas iguais resultam em empate (0 ponto).
 *
 * Pedras são arrays [a, b] guardados na forma canônica [menor, maior].
 */

const MAIOR_NUMERO = 6;
const PEDRAS_POR_JOGADOR = 7;
const TOTAL_PEDRAS = 28;
const LADOS = Object.freeze({ ESQUERDA: 'esquerda', DIREITA: 'direita' });
const STATUS = Object.freeze({ EM_ANDAMENTO: 'em_andamento', VITORIA: 'vitoria', EMPATE: 'empate' });
const MOTIVO = Object.freeze({ BATIDA: 'batida', FECHADO: 'fechado' });

// ---------- Pedras ----------

const numeroValido = (n) => Number.isInteger(n) && n >= 0 && n <= MAIOR_NUMERO;

function pedraValida(p) {
  return Array.isArray(p) && p.length === 2 && numeroValido(p[0]) && numeroValido(p[1]);
}

function normalizar(p) {
  if (!pedraValida(p)) throw new Error('Pedra inválida');
  return [Math.min(p[0], p[1]), Math.max(p[0], p[1])];
}

/** [6, 3] -> '3-6' */
function pedraId(p) {
  const [a, b] = normalizar(p);
  return `${a}-${b}`;
}

const ehCarroca = (p) => p[0] === p[1];
const somaPedra = (p) => p[0] + p[1];
const somaPedras = (pedras) => pedras.reduce((s, p) => s + somaPedra(p), 0);

function criarPedras() {
  const pedras = [];
  for (let a = 0; a <= MAIOR_NUMERO; a++) {
    for (let b = a; b <= MAIOR_NUMERO; b++) pedras.push([a, b]);
  }
  return pedras;
}

/** Maior pedra para abrir: carroça > soma > maior lado. */
function comparar(p, q) {
  const chave = (x) => [ehCarroca(x) ? 1 : 0, somaPedra(x), Math.max(x[0], x[1])];
  const a = chave(p);
  const b = chave(q);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function pedraDeAbertura(maos) {
  const todas = maos.flat().map(normalizar);
  if (todas.length === 0) throw new Error('Nenhuma pedra nas mãos');
  return todas.reduce((melhor, p) => (comparar(p, melhor) > 0 ? p : melhor));
}

// ---------- Criação ----------

function criarRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function embaralhar(lista, rng) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Cria um jogo a partir de mãos e monte definidos (úteis para cenários fixos). */
function criarJogoComMaos(mao0, mao1, monte = []) {
  if (![mao0, mao1, monte].every(Array.isArray)) throw new Error('Mãos e monte devem ser listas');
  if (mao0.length === 0 || mao1.length === 0) throw new Error('Cada jogador precisa ter ao menos uma pedra');
  const vistas = new Set();
  const limpar = (lista) =>
    lista.map((p) => {
      const n = normalizar(p);
      const id = pedraId(n);
      if (vistas.has(id)) throw new Error(`Pedra repetida: ${id}`);
      vistas.add(id);
      return n;
    });
  const maos = [limpar(mao0), limpar(mao1)];
  const m = limpar(monte);

  const abertura = pedraDeAbertura(maos);
  const jogadorInicial = maos[0].some((p) => pedraId(p) === pedraId(abertura)) ? 0 : 1;
  return {
    maos,
    monte: m,
    mesa: [],
    pontas: { esquerda: null, direita: null },
    turno: jogadorInicial,
    jogadorInicial,
    pedraAbertura: abertura,
    passesSeguidos: 0,
    status: STATUS.EM_ANDAMENTO,
    vencedor: null,
    motivo: null,
    pontos: 0,
    historico: [],
  };
}

/** Partida padrão: 28 pedras embaralhadas por seed, 7 para cada jogador e 14 no monte. */
function criarJogo(seed = 1) {
  const pedras = embaralhar(criarPedras(), criarRng(seed));
  return criarJogoComMaos(
    pedras.slice(0, PEDRAS_POR_JOGADOR),
    pedras.slice(PEDRAS_POR_JOGADOR, PEDRAS_POR_JOGADOR * 2),
    pedras.slice(PEDRAS_POR_JOGADOR * 2)
  );
}

// ---------- Jogadas possíveis ----------

const jogadorValido = (j) => j === 0 || j === 1;

function jogadasValidas(jogo, jogador) {
  if (!jogadorValido(jogador)) throw new Error('Jogador inválido');
  const mao = jogo.maos[jogador];
  if (jogo.mesa.length === 0) {
    const id = pedraId(jogo.pedraAbertura);
    return mao.filter((p) => pedraId(p) === id).map((p) => ({ pedra: p, lado: null }));
  }
  const jogadas = [];
  for (const p of mao) {
    if (p.includes(jogo.pontas.esquerda)) jogadas.push({ pedra: p, lado: LADOS.ESQUERDA });
    if (p.includes(jogo.pontas.direita)) jogadas.push({ pedra: p, lado: LADOS.DIREITA });
  }
  return jogadas;
}

const temJogada = (jogo, jogador) => jogadasValidas(jogo, jogador).length > 0;

// ---------- Ações ----------

function validarVez(jogo, jogador) {
  if (jogo.status !== STATUS.EM_ANDAMENTO) throw new Error('Jogo encerrado');
  if (!jogadorValido(jogador)) throw new Error('Jogador inválido');
  if (jogador !== jogo.turno) throw new Error('Não é a vez do jogador');
}

function encerrar(jogo, vencedor, motivo) {
  jogo.motivo = motivo;
  jogo.vencedor = vencedor;
  jogo.status = vencedor === null ? STATUS.EMPATE : STATUS.VITORIA;
  jogo.pontos = vencedor === null ? 0 : somaPedras(jogo.maos[1 - vencedor]);
}

function jogar(jogo, jogador, pedra, lado) {
  validarVez(jogo, jogador);
  const p = normalizar(pedra);
  const id = pedraId(p);
  const indice = jogo.maos[jogador].findIndex((x) => pedraId(x) === id);
  if (indice === -1) throw new Error('Pedra não está na mão do jogador');

  if (jogo.mesa.length === 0) {
    if (id !== pedraId(jogo.pedraAbertura)) {
      throw new Error(`A primeira jogada deve ser com a pedra ${pedraId(jogo.pedraAbertura)}`);
    }
    jogo.mesa.push([p[0], p[1]]);
    jogo.pontas = { esquerda: p[0], direita: p[1] };
  } else {
    if (lado !== LADOS.ESQUERDA && lado !== LADOS.DIREITA) throw new Error('Lado inválido');
    const ponta = jogo.pontas[lado];
    if (!p.includes(ponta)) throw new Error('Pedra não encaixa na ponta');
    const outro = p[0] === ponta ? p[1] : p[0];
    if (lado === LADOS.ESQUERDA) {
      jogo.mesa.unshift([outro, ponta]);
      jogo.pontas.esquerda = outro;
    } else {
      jogo.mesa.push([ponta, outro]);
      jogo.pontas.direita = outro;
    }
  }

  jogo.maos[jogador].splice(indice, 1);
  jogo.passesSeguidos = 0;
  jogo.historico.push({ tipo: 'jogar', jogador, pedra: id, lado: jogo.mesa.length === 1 ? null : lado });

  if (jogo.maos[jogador].length === 0) encerrar(jogo, jogador, MOTIVO.BATIDA);
  else jogo.turno = 1 - jogador;
  return jogo;
}

/** Compra a próxima pedra do monte; só quando não há pedra que encaixe. */
function comprar(jogo, jogador) {
  validarVez(jogo, jogador);
  if (temJogada(jogo, jogador)) throw new Error('Jogador tem jogada disponível');
  if (jogo.monte.length === 0) throw new Error('Monte vazio');
  const pedra = jogo.monte.shift();
  jogo.maos[jogador].push(pedra);
  jogo.historico.push({ tipo: 'comprar', jogador, pedra: pedraId(pedra) });
  return pedra;
}

/** Passa a vez; só sem pedra que encaixe e com o monte vazio. Dois passes seguidos fecham o jogo. */
function passar(jogo, jogador) {
  validarVez(jogo, jogador);
  if (temJogada(jogo, jogador)) throw new Error('Jogador tem jogada disponível');
  if (jogo.monte.length > 0) throw new Error('Ainda há pedras no monte');
  jogo.passesSeguidos++;
  jogo.historico.push({ tipo: 'passar', jogador });
  if (jogo.passesSeguidos >= 2) {
    const s0 = somaPedras(jogo.maos[0]);
    const s1 = somaPedras(jogo.maos[1]);
    encerrar(jogo, s0 === s1 ? null : s0 < s1 ? 0 : 1, MOTIVO.FECHADO);
  } else {
    jogo.turno = 1 - jogador;
  }
  return jogo;
}

// ---------- Texto ----------

/** '[4|6][6|6][6|5]' */
function mesaParaTexto(jogo) {
  return jogo.mesa.map(([a, b]) => `[${a}|${b}]`).join('');
}

module.exports = {
  MAIOR_NUMERO,
  PEDRAS_POR_JOGADOR,
  TOTAL_PEDRAS,
  LADOS,
  STATUS,
  MOTIVO,
  criarPedras,
  pedraId,
  pedraValida,
  somaPedra,
  somaPedras,
  pedraDeAbertura,
  criarJogo,
  criarJogoComMaos,
  jogadasValidas,
  temJogada,
  jogar,
  comprar,
  passar,
  mesaParaTexto,
};
