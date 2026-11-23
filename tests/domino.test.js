'use strict';

const D = require('../src/domino');

const {
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
} = D;

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

/** '6-3' -> [6, 3] */
const P = (txt) => txt.split('-').map(Number);
/** '6-6 4-6' -> [[6, 6], [4, 6]] */
const PS = (txt) => (txt.trim() === '' ? [] : txt.trim().split(/\s+/).map(P));
const ids = (pedras) => pedras.map(pedraId);

/** Cenário reduzido (mãos e monte definidos em texto) para testar fim de jogo, compra e passe. */
const cenario = (m0, m1, monte = '') => criarJogoComMaos(PS(m0), PS(m1), PS(monte));

/** Executa lances escritos como 'J0 6-6', 'J1 5-6 direita', 'J1 comprar', 'J1 passar'. */
function executar(jogo, lances) {
  lances.forEach((lance) => {
    const [quem, acao, lado] = lance.split(' ');
    const jogador = Number(quem[1]);
    if (acao === 'comprar') comprar(jogo, jogador);
    else if (acao === 'passar') passar(jogo, jogador);
    else jogar(jogo, jogador, P(acao), lado);
  });
  return jogo;
}

// Distribuição fixa usada nos testes (7 pedras para cada jogador; o resto vai para o monte).
const MAO0 = '6-6 4-6 3-5 2-4 1-3 2-2 0-1';
const MAO1 = '5-5 5-6 4-5 3-4 2-3 1-1 0-0';
const usadas = new Set(ids([...PS(MAO0), ...PS(MAO1)]));
const MONTE = criarPedras().filter((p) => !usadas.has(pedraId(p)));
const jogoFixo = () => criarJogoComMaos(PS(MAO0), PS(MAO1), MONTE);

// Abertura da partida fixa: J0 joga 6-6, J1 joga 5-6 na direita, J0 joga 4-6 na esquerda.
const ABERTURA = ['J0 6-6', 'J1 5-6 direita', 'J0 4-6 esquerda'];

/** Gerador pseudoaleatório determinístico para as simulações. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 1. Pedras
// ---------------------------------------------------------------------------
describe('Pedras', () => {
  test('o jogo tem 28 pedras diferentes', () => {
    const pedras = criarPedras();
    expect(TOTAL_PEDRAS).toBe(28);
    expect(pedras).toHaveLength(28);
    expect(new Set(ids(pedras)).size).toBe(28);
  });

  test('tem 7 carroças (0-0 a 6-6)', () => {
    const carrocas = criarPedras().filter(([a, b]) => a === b);
    expect(ids(carrocas)).toEqual(['0-0', '1-1', '2-2', '3-3', '4-4', '5-5', '6-6']);
  });

  test('cada número de 0 a 6 aparece 8 vezes e os pontos somam 168', () => {
    const pedras = criarPedras();
    for (let n = 0; n <= 6; n++) {
      const aparicoes = pedras.flat().filter((x) => x === n).length;
      expect(aparicoes).toBe(8);
    }
    expect(somaPedras(pedras)).toBe(168);
  });

  test('pedraId usa sempre a forma menor-maior', () => {
    expect(pedraId([6, 3])).toBe('3-6');
    expect(pedraId([3, 6])).toBe('3-6');
    expect(pedraId([0, 0])).toBe('0-0');
  });

  test('somaPedra e somaPedras somam os pontos', () => {
    expect(somaPedra([6, 6])).toBe(12);
    expect(somaPedra([0, 0])).toBe(0);
    expect(somaPedras(PS('6-6 0-1 2-4'))).toBe(19);
    expect(somaPedras([])).toBe(0);
  });

  test.each([[[0, 0]], [[6, 6]], [[3, 5]], [[6, 0]]])('%j é uma pedra válida', (p) => {
    expect(pedraValida(p)).toBe(true);
  });

  test.each([
    [[7, 0]], [[0, 7]], [[-1, 0]], [[1.5, 2]], [['1', 2]], [[1]], [[1, 2, 3]], [[]], ['1-2'], [null], [undefined],
    [{}], [[NaN, 1]], [[Infinity, 1]],
  ])('%j não é uma pedra válida', (p) => {
    expect(pedraValida(p)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Criação da partida
// ---------------------------------------------------------------------------
describe('Criação da partida (2 jogadores)', () => {
  test('cada jogador recebe 7 pedras e o monte fica com 14', () => {
    const jogo = criarJogo(1);
    expect(PEDRAS_POR_JOGADOR).toBe(7);
    expect(jogo.maos).toHaveLength(2);
    expect(jogo.maos[0]).toHaveLength(7);
    expect(jogo.maos[1]).toHaveLength(7);
    expect(jogo.monte).toHaveLength(14);
  });

  test('as 28 pedras estão distribuídas sem repetição', () => {
    const jogo = criarJogo(7);
    const todas = ids([...jogo.maos[0], ...jogo.maos[1], ...jogo.monte]);
    expect(todas).toHaveLength(28);
    expect(new Set(todas)).toEqual(new Set(ids(criarPedras())));
  });

  test('a partida começa em andamento, com a mesa vazia', () => {
    const jogo = criarJogo(1);
    expect(jogo.status).toBe(STATUS.EM_ANDAMENTO);
    expect(jogo.mesa).toEqual([]);
    expect(jogo.pontas).toEqual({ esquerda: null, direita: null });
    expect(jogo.passesSeguidos).toBe(0);
    expect(jogo.vencedor).toBeNull();
    expect(jogo.motivo).toBeNull();
    expect(jogo.pontos).toBe(0);
    expect(jogo.historico).toEqual([]);
  });

  test('mesma seed gera a mesma distribuição; seeds diferentes variam', () => {
    expect(criarJogo(42)).toEqual(criarJogo(42));
    const conjunto = new Set();
    for (let seed = 1; seed <= 50; seed++) conjunto.add(JSON.stringify(criarJogo(seed).maos));
    expect(conjunto.size).toBeGreaterThan(45);
  });

  test('começa quem tiver a pedra de abertura', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const jogo = criarJogo(seed);
      const dono = jogo.maos.findIndex((m) => ids(m).includes(pedraId(jogo.pedraAbertura)));
      expect(jogo.turno).toBe(dono);
      expect(jogo.jogadorInicial).toBe(dono);
    }
  });

  test('dois jogos criados são independentes', () => {
    const a = criarJogo(1);
    const b = criarJogo(1);
    executar(a, [`J${a.turno} ${pedraId(a.pedraAbertura)}`]);
    expect(b.mesa).toEqual([]);
  });

  test('a distribuição fixa dos testes tem 7 + 7 + 14 pedras', () => {
    const jogo = jogoFixo();
    expect(ids(jogo.maos[0])).toEqual(ids(PS(MAO0)));
    expect(ids(jogo.maos[1])).toEqual(ids(PS(MAO1)));
    expect(jogo.monte).toHaveLength(14);
    expect(jogo.monte[0]).toEqual([0, 2]);
  });

  describe('criarJogoComMaos: validação de parâmetros', () => {
    test.each([
      ['mão do jogador 0 que não é lista', [null, PS('1-2'), []]],
      ['mão do jogador 1 que não é lista', [PS('1-2'), 'abc', []]],
      ['monte que não é lista', [PS('1-2'), PS('3-4'), 'x']],
    ])('rejeita %s', (_n, [a, b, c]) => {
      expect(() => criarJogoComMaos(a, b, c)).toThrow('Mãos e monte devem ser listas');
    });

    test('rejeita jogador sem pedras', () => {
      expect(() => criarJogoComMaos([], PS('1-2'), [])).toThrow('ao menos uma pedra');
      expect(() => criarJogoComMaos(PS('1-2'), [], [])).toThrow('ao menos uma pedra');
    });

    test.each([[[7, 0]], [[-1, 2]], [[1.5, 2]], [[1]], [['a', 'b']]])('rejeita pedra inválida %j', (p) => {
      expect(() => criarJogoComMaos([p], PS('3-4'), [])).toThrow('Pedra inválida');
    });

    test('rejeita pedra repetida na mesma mão', () => {
      expect(() => criarJogoComMaos(PS('1-2 1-2'), PS('3-4'), [])).toThrow('Pedra repetida: 1-2');
    });

    test('rejeita pedra repetida entre as mãos (mesmo invertida)', () => {
      expect(() => criarJogoComMaos(PS('1-2'), PS('2-1'), [])).toThrow('Pedra repetida: 1-2');
    });

    test('rejeita pedra repetida entre a mão e o monte', () => {
      expect(() => criarJogoComMaos(PS('1-2'), PS('3-4'), PS('1-2'))).toThrow('Pedra repetida: 1-2');
    });

    test('guarda as pedras na forma menor-maior', () => {
      const jogo = criarJogoComMaos([[6, 4]], [[3, 1]], [[5, 0]]);
      expect(jogo.maos[0][0]).toEqual([4, 6]);
      expect(jogo.maos[1][0]).toEqual([1, 3]);
      expect(jogo.monte[0]).toEqual([0, 5]);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Pedra de abertura
// ---------------------------------------------------------------------------
describe('Pedra de abertura', () => {
  test('a maior carroça abre a partida', () => {
    expect(pedraId(pedraDeAbertura([PS('6-6 1-2'), PS('5-5 3-4')]))).toBe('6-6');
  });

  test('a carroça 6-6 pode estar na mão de qualquer jogador', () => {
    expect(criarJogoComMaos(PS('5-5 1-2'), PS('6-6 3-4')).turno).toBe(1);
    expect(criarJogoComMaos(PS('6-6 1-2'), PS('5-5 3-4')).turno).toBe(0);
  });

  test('sem 6-6, a maior carroça entre as duas mãos abre', () => {
    const jogo = criarJogoComMaos(PS('3-3 1-2'), PS('2-2 4-5'));
    expect(pedraId(jogo.pedraAbertura)).toBe('3-3');
    expect(jogo.turno).toBe(0);
    const jogo2 = criarJogoComMaos(PS('3-3 1-2'), PS('4-4 4-5'));
    expect(pedraId(jogo2.pedraAbertura)).toBe('4-4');
    expect(jogo2.turno).toBe(1);
  });

  test('uma carroça pequena vale mais que uma pedra comum de soma alta', () => {
    expect(pedraId(pedraDeAbertura([PS('0-0'), PS('5-6')]))).toBe('0-0');
  });

  test('sem carroças, abre a pedra de maior soma', () => {
    const jogo = criarJogoComMaos(PS('4-6 1-2'), PS('5-6 0-3'));
    expect(pedraId(jogo.pedraAbertura)).toBe('5-6');
    expect(jogo.turno).toBe(1);
  });

  test('empate na soma: vence a pedra de maior lado', () => {
    expect(pedraId(pedraDeAbertura([PS('3-6'), PS('4-5')]))).toBe('3-6');
    expect(pedraId(pedraDeAbertura([PS('4-5'), PS('3-6')]))).toBe('3-6');
  });

  test('pedras no monte não participam da escolha', () => {
    const jogo = criarJogoComMaos(PS('3-3 1-2'), PS('2-2 4-5'), PS('6-6 5-5'));
    expect(pedraId(jogo.pedraAbertura)).toBe('3-3');
  });

  test('sem pedras nas mãos não há abertura', () => {
    expect(() => pedraDeAbertura([[], []])).toThrow('Nenhuma pedra nas mãos');
  });
});

// ---------------------------------------------------------------------------
// 4. Primeira jogada
// ---------------------------------------------------------------------------
describe('Primeira jogada', () => {
  test('o dono da pedra de abertura joga e a pedra vai para a mesa', () => {
    const jogo = jogoFixo();
    jogar(jogo, 0, [6, 6]);
    expect(jogo.mesa).toEqual([[6, 6]]);
    expect(jogo.pontas).toEqual({ esquerda: 6, direita: 6 });
    expect(jogo.maos[0]).toHaveLength(6);
    expect(ids(jogo.maos[0])).not.toContain('6-6');
    expect(jogo.turno).toBe(1);
    expect(jogo.status).toBe(STATUS.EM_ANDAMENTO);
  });

  test('o lado é ignorado na primeira jogada', () => {
    ['esquerda', 'direita', undefined, null, 'qualquer'].forEach((lado) => {
      const jogo = jogoFixo();
      expect(() => jogar(jogo, 0, [6, 6], lado)).not.toThrow();
      expect(mesaParaTexto(jogo)).toBe('[6|6]');
    });
  });

  test('abertura com pedra que não é carroça fica na forma menor-maior', () => {
    const jogo = cenario('3-6 1-2', '0-4 1-4');
    jogar(jogo, 0, [6, 3]);
    expect(mesaParaTexto(jogo)).toBe('[3|6]');
    expect(jogo.pontas).toEqual({ esquerda: 3, direita: 6 });
  });

  test('o outro jogador não pode abrir', () => {
    const jogo = jogoFixo();
    expect(() => jogar(jogo, 1, [5, 5])).toThrow('Não é a vez do jogador');
    expect(jogo.mesa).toEqual([]);
  });

  test('a primeira jogada deve ser com a pedra de abertura', () => {
    const jogo = jogoFixo();
    expect(() => jogar(jogo, 0, [2, 2])).toThrow('A primeira jogada deve ser com a pedra 6-6');
    expect(() => jogar(jogo, 0, [4, 6])).toThrow('A primeira jogada deve ser com a pedra 6-6');
    expect(jogo.mesa).toEqual([]);
    expect(jogo.maos[0]).toHaveLength(7);
  });

  test('jogadasValidas na abertura: só o dono da abertura, só a pedra de abertura', () => {
    const jogo = jogoFixo();
    expect(jogadasValidas(jogo, 0)).toEqual([{ pedra: [6, 6], lado: null }]);
    expect(jogadasValidas(jogo, 1)).toEqual([]);
  });

  test('quem abre sempre tem jogada; não pode comprar nem passar', () => {
    const jogo = jogoFixo();
    expect(temJogada(jogo, 0)).toBe(true);
    expect(() => comprar(jogo, 0)).toThrow('Jogador tem jogada disponível');
    expect(() => passar(jogo, 0)).toThrow('Jogador tem jogada disponível');
  });
});

// ---------------------------------------------------------------------------
// 5. Jogadas na mesa
// ---------------------------------------------------------------------------
describe('Jogadas na mesa', () => {
  test('sequência de jogadas encaixa nas duas pontas', () => {
    const jogo = executar(jogoFixo(), ABERTURA);
    expect(mesaParaTexto(jogo)).toBe('[4|6][6|6][6|5]');
    expect(jogo.pontas).toEqual({ esquerda: 4, direita: 5 });
    expect(jogo.maos[0]).toHaveLength(5);
    expect(jogo.maos[1]).toHaveLength(6);
    expect(jogo.monte).toHaveLength(14);
    expect(jogo.turno).toBe(1);
  });

  test('a mesa sempre forma uma corrente (lado direito de uma pedra = lado esquerdo da próxima)', () => {
    const jogo = executar(jogoFixo(), ABERTURA);
    for (let i = 0; i + 1 < jogo.mesa.length; i++) expect(jogo.mesa[i][1]).toBe(jogo.mesa[i + 1][0]);
    expect(jogo.pontas.esquerda).toBe(jogo.mesa[0][0]);
    expect(jogo.pontas.direita).toBe(jogo.mesa[jogo.mesa.length - 1][1]);
  });

  test('a jogada vai para o histórico', () => {
    const jogo = executar(jogoFixo(), ABERTURA);
    expect(jogo.historico).toEqual([
      { tipo: 'jogar', jogador: 0, pedra: '6-6', lado: null },
      { tipo: 'jogar', jogador: 1, pedra: '5-6', lado: 'direita' },
      { tipo: 'jogar', jogador: 0, pedra: '4-6', lado: 'esquerda' },
    ]);
  });

  test('aceita a pedra escrita em qualquer ordem', () => {
    const jogo = executar(jogoFixo(), ['J0 6-6']);
    expect(() => jogar(jogo, 1, [6, 5], LADOS.DIREITA)).not.toThrow();
    expect(mesaParaTexto(jogo)).toBe('[6|6][6|5]');
  });

  test('retorna o próprio jogo', () => {
    const jogo = jogoFixo();
    expect(jogar(jogo, 0, [6, 6])).toBe(jogo);
  });

  test('pedra que serve nas duas pontas pode ser colocada em qualquer uma', () => {
    // Pontas 4|5; o 4-5 encaixa nos dois lados.
    const direita = executar(jogoFixo(), [...ABERTURA, 'J1 4-5 direita']);
    expect(mesaParaTexto(direita)).toBe('[4|6][6|6][6|5][5|4]');
    expect(direita.pontas).toEqual({ esquerda: 4, direita: 4 });

    const esquerda = executar(jogoFixo(), [...ABERTURA, 'J1 4-5 esquerda']);
    expect(mesaParaTexto(esquerda)).toBe('[5|4][4|6][6|6][6|5]');
    expect(esquerda.pontas).toEqual({ esquerda: 5, direita: 5 });
  });

  test('carroça numa ponta mantém o mesmo número na ponta', () => {
    const jogo = cenario('6-6 0-1 3-4', '2-6 2-2 4-5');
    executar(jogo, ['J0 6-6', 'J1 2-6 esquerda']);
    expect(jogo.pontas).toEqual({ esquerda: 2, direita: 6 });
    passar(jogo, 0); // 0-1 e 3-4 não encaixam em 2|6 e o monte está vazio
    jogar(jogo, 1, [2, 2], 'esquerda');
    expect(mesaParaTexto(jogo)).toBe('[2|2][2|6][6|6]');
    expect(jogo.pontas).toEqual({ esquerda: 2, direita: 6 });
  });

  describe('jogadas inválidas', () => {
    test('pedra que não encaixa na ponta', () => {
      const jogo = executar(jogoFixo(), ABERTURA); // pontas 4|5
      expect(() => jogar(jogo, 1, [2, 3], 'esquerda')).toThrow('Pedra não encaixa na ponta');
      expect(() => jogar(jogo, 1, [2, 3], 'direita')).toThrow('Pedra não encaixa na ponta');
      expect(() => jogar(jogo, 1, [3, 4], 'direita')).toThrow('Pedra não encaixa na ponta'); // serve só na esquerda
      expect(() => jogar(jogo, 1, [5, 5], 'esquerda')).toThrow('Pedra não encaixa na ponta'); // serve só na direita
    });

    test.each([undefined, null, 'cima', 'ESQUERDA', '', 0, 'meio'])('lado inválido %p', (lado) => {
      const jogo = executar(jogoFixo(), ABERTURA);
      expect(() => jogar(jogo, 1, [4, 5], lado)).toThrow('Lado inválido');
    });

    test('pedra que está na mão do adversário, no monte ou já jogada', () => {
      const jogo = executar(jogoFixo(), ABERTURA); // vez do J1
      expect(() => jogar(jogo, 1, [3, 5], 'esquerda')).toThrow('Pedra não está na mão do jogador'); // mão do J0
      expect(() => jogar(jogo, 1, [0, 2], 'esquerda')).toThrow('Pedra não está na mão do jogador'); // monte
      expect(() => jogar(jogo, 1, [6, 6], 'esquerda')).toThrow('Pedra não está na mão do jogador'); // já na mesa
    });

    test.each([[[7, 1]], [[1]], [['4', '5']], [null], [undefined], ['4-5'], [[4, 5, 6]]])('pedra com formato inválido %j', (p) => {
      const jogo = executar(jogoFixo(), ABERTURA);
      expect(() => jogar(jogo, 1, p, 'esquerda')).toThrow('Pedra inválida');
    });

    test('jogar fora da vez', () => {
      const jogo = executar(jogoFixo(), ABERTURA); // vez do J1
      expect(() => jogar(jogo, 0, [3, 5], 'direita')).toThrow('Não é a vez do jogador');
    });

    test.each([2, -1, '0', null, undefined, 0.5, NaN])('jogador inválido %p', (j) => {
      const jogo = jogoFixo();
      expect(() => jogar(jogo, j, [6, 6])).toThrow('Jogador inválido');
      expect(() => comprar(jogo, j)).toThrow('Jogador inválido');
      expect(() => passar(jogo, j)).toThrow('Jogador inválido');
    });

    test('jogada inválida não altera o estado do jogo', () => {
      const jogo = executar(jogoFixo(), ABERTURA);
      const antes = JSON.stringify(jogo);
      const tentativas = [
        () => jogar(jogo, 1, [2, 3], 'esquerda'),
        () => jogar(jogo, 1, [4, 5], 'cima'),
        () => jogar(jogo, 1, [0, 2], 'esquerda'),
        () => jogar(jogo, 0, [3, 5], 'direita'),
        () => comprar(jogo, 1),
        () => passar(jogo, 1),
      ];
      tentativas.forEach((t) => expect(t).toThrow());
      expect(JSON.stringify(jogo)).toBe(antes);
    });
  });
});

describe('jogadasValidas', () => {
  test('lista cada pedra com o lado em que encaixa', () => {
    const jogo = executar(jogoFixo(), ABERTURA); // pontas 4|5, vez do J1
    expect(jogadasValidas(jogo, 1)).toEqual([
      { pedra: [5, 5], lado: 'direita' },
      { pedra: [4, 5], lado: 'esquerda' },
      { pedra: [4, 5], lado: 'direita' },
      { pedra: [3, 4], lado: 'esquerda' },
    ]);
  });

  test('pedra que não encaixa em nenhuma ponta não aparece', () => {
    const jogo = executar(jogoFixo(), ABERTURA);
    const pedras = ids(jogadasValidas(jogo, 1).map((j) => j.pedra));
    ['2-3', '1-1', '0-0'].forEach((id) => expect(pedras).not.toContain(id));
  });

  test('toda jogada listada pode ser executada', () => {
    const base = executar(jogoFixo(), ABERTURA);
    jogadasValidas(base, 1).forEach(({ pedra, lado }) => {
      const copia = JSON.parse(JSON.stringify(base));
      expect(() => jogar(copia, 1, pedra, lado)).not.toThrow();
    });
  });

  test('temJogada indica se o jogador pode jogar', () => {
    const jogo = executar(jogoFixo(), ABERTURA);
    expect(temJogada(jogo, 1)).toBe(true);
    const sem = cenario('6-6 0-1', '4-5 1-2');
    jogar(sem, 0, [6, 6]);
    expect(temJogada(sem, 1)).toBe(false);
  });

  test('rejeita jogador inválido', () => {
    expect(() => jogadasValidas(jogoFixo(), 2)).toThrow('Jogador inválido');
  });
});

// ---------------------------------------------------------------------------
// 6. Compra no monte
// ---------------------------------------------------------------------------
describe('comprar', () => {
  const novo = () => executar(cenario('6-6 1-2', '4-5 3-3', '0-0 1-6'), ['J0 6-6']);

  test('sem pedra que encaixe, compra a primeira do monte', () => {
    const jogo = novo();
    const pedra = comprar(jogo, 1);
    expect(pedra).toEqual([0, 0]);
    expect(jogo.maos[1]).toHaveLength(3);
    expect(ids(jogo.maos[1])).toContain('0-0');
    expect(jogo.monte).toHaveLength(1);
  });

  test('depois de comprar o jogador continua na vez', () => {
    const jogo = novo();
    comprar(jogo, 1);
    expect(jogo.turno).toBe(1);
    expect(jogo.status).toBe(STATUS.EM_ANDAMENTO);
  });

  test('compra de novo se a pedra comprada não encaixar, até conseguir jogar', () => {
    const jogo = novo();
    expect(comprar(jogo, 1)).toEqual([0, 0]); // não encaixa em 6|6
    expect(temJogada(jogo, 1)).toBe(false);
    expect(comprar(jogo, 1)).toEqual([1, 6]); // encaixa
    expect(temJogada(jogo, 1)).toBe(true);
    expect(jogo.monte).toHaveLength(0);
  });

  test('depois de conseguir jogar não pode comprar mais', () => {
    const jogo = novo();
    comprar(jogo, 1);
    comprar(jogo, 1);
    expect(() => comprar(jogo, 1)).toThrow('Jogador tem jogada disponível');
  });

  test('a pedra comprada pode ser jogada em seguida', () => {
    const jogo = novo();
    comprar(jogo, 1);
    comprar(jogo, 1);
    jogar(jogo, 1, [1, 6], 'esquerda');
    expect(mesaParaTexto(jogo)).toBe('[1|6][6|6]');
    expect(jogo.pontas).toEqual({ esquerda: 1, direita: 6 });
    expect(jogo.turno).toBe(0);
    // O 1-2 do J0 agora encaixa na ponta esquerda
    expect(jogadasValidas(jogo, 0)).toEqual([{ pedra: [1, 2], lado: 'esquerda' }]);
  });

  test('compras ficam no histórico', () => {
    const jogo = novo();
    comprar(jogo, 1);
    comprar(jogo, 1);
    expect(jogo.historico.slice(1)).toEqual([
      { tipo: 'comprar', jogador: 1, pedra: '0-0' },
      { tipo: 'comprar', jogador: 1, pedra: '1-6' },
    ]);
  });

  test('não compra quando tem pedra que encaixe', () => {
    const jogo = jogoFixo();
    expect(() => comprar(jogo, 0)).toThrow('Jogador tem jogada disponível');
    const meio = executar(jogoFixo(), ABERTURA);
    expect(() => comprar(meio, 1)).toThrow('Jogador tem jogada disponível');
    expect(meio.monte).toHaveLength(14);
  });

  test('não compra fora da vez', () => {
    const jogo = novo(); // vez do J1
    expect(() => comprar(jogo, 0)).toThrow('Não é a vez do jogador');
  });

  test('não compra com o monte vazio', () => {
    const jogo = executar(cenario('6-6 1-2', '4-5 3-3'), ['J0 6-6']);
    expect(() => comprar(jogo, 1)).toThrow('Monte vazio');
  });

  test('o monte nunca recebe pedras de volta', () => {
    const jogo = novo();
    comprar(jogo, 1);
    comprar(jogo, 1);
    jogar(jogo, 1, [1, 6], 'direita');
    expect(jogo.monte).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Passar a vez
// ---------------------------------------------------------------------------
describe('passar', () => {
  test('passa a vez quando não há jogada e o monte está vazio', () => {
    const jogo = executar(cenario('6-6 5-6', '4-5 1-2'), ['J0 6-6']);
    passar(jogo, 1);
    expect(jogo.turno).toBe(0);
    expect(jogo.passesSeguidos).toBe(1);
    expect(jogo.status).toBe(STATUS.EM_ANDAMENTO);
    expect(jogo.historico[1]).toEqual({ tipo: 'passar', jogador: 1 });
  });

  test('não passa quando tem pedra que encaixe', () => {
    const jogo = jogoFixo();
    expect(() => passar(jogo, 0)).toThrow('Jogador tem jogada disponível');
    expect(jogo.passesSeguidos).toBe(0);
  });

  test('não passa enquanto houver pedras no monte', () => {
    const jogo = executar(cenario('6-6 1-2', '4-5 3-3', '0-0'), ['J0 6-6']);
    expect(() => passar(jogo, 1)).toThrow('Ainda há pedras no monte');
    expect(jogo.passesSeguidos).toBe(0);
  });

  test('não passa fora da vez', () => {
    const jogo = executar(cenario('6-6 5-6', '4-5 1-2'), ['J0 6-6']);
    expect(() => passar(jogo, 0)).toThrow('Não é a vez do jogador');
  });

  test('depois de esvaziar o monte comprando, o jogador pode passar', () => {
    const jogo = executar(cenario('6-6 1-2', '4-5 3-3', '0-0 2-3'), ['J0 6-6', 'J1 comprar', 'J1 comprar']);
    expect(jogo.monte).toHaveLength(0);
    passar(jogo, 1);
    expect(jogo.passesSeguidos).toBe(1);
    expect(jogo.turno).toBe(0);
  });

  test('uma jogada zera a contagem de passes seguidos', () => {
    const jogo = cenario('6-6 5-6 1-1', '2-3 0-4');
    executar(jogo, ['J0 6-6', 'J1 passar']);
    expect(jogo.passesSeguidos).toBe(1);
    jogar(jogo, 0, [5, 6], 'esquerda');
    expect(jogo.passesSeguidos).toBe(0);
    passar(jogo, 1); // ainda não fecha o jogo: o contador recomeçou
    expect(jogo.passesSeguidos).toBe(1);
    expect(jogo.status).toBe(STATUS.EM_ANDAMENTO);
  });
});

// ---------------------------------------------------------------------------
// 8. Fim de jogo
// ---------------------------------------------------------------------------
describe('Batida (vence quem ficar sem pedras)', () => {
  const batida = () => executar(cenario('6-6 5-6', '4-5 1-2'), ['J0 6-6', 'J1 passar', 'J0 5-6 esquerda']);

  test('o jogador que joga a última pedra vence', () => {
    const jogo = batida();
    expect(jogo.status).toBe(STATUS.VITORIA);
    expect(jogo.vencedor).toBe(0);
    expect(jogo.motivo).toBe(MOTIVO.BATIDA);
    expect(jogo.maos[0]).toHaveLength(0);
  });

  test('os pontos são a soma da mão do adversário', () => {
    const jogo = batida();
    expect(jogo.pontos).toBe(12); // 4+5 + 1+2
    expect(jogo.pontos).toBe(somaPedras(jogo.maos[1]));
  });

  test('o jogador 1 também pode bater', () => {
    const jogo = cenario('6-6 0-1 2-3', '6-5');
    executar(jogo, ['J0 6-6', 'J1 5-6 direita']);
    expect(jogo.status).toBe(STATUS.VITORIA);
    expect(jogo.vencedor).toBe(1);
    expect(jogo.pontos).toBe(6); // 0-1 (1) + 2-3 (5)
  });

  test('bater com uma carroça como última pedra', () => {
    const jogo = executar(cenario('6-6 3-6 3-3', '0-1 2-4'), [
      'J0 6-6',
      'J1 passar',
      'J0 3-6 esquerda', // pontas 3|6
      'J1 passar',
      'J0 3-3 esquerda',
    ]);
    expect(jogo.status).toBe(STATUS.VITORIA);
    expect(jogo.motivo).toBe(MOTIVO.BATIDA);
    expect(jogo.vencedor).toBe(0);
    expect(jogo.pontos).toBe(7); // 0-1 (1) + 2-4 (6)
    expect(mesaParaTexto(jogo)).toBe('[3|3][3|6][6|6]');
  });

  test('batida com a mão do adversário valendo 0 ponto', () => {
    const jogo = executar(cenario('6-6 0-6', '0-0'), ['J0 6-6', 'J1 passar', 'J0 0-6 esquerda']);
    expect(jogo.status).toBe(STATUS.VITORIA);
    expect(jogo.vencedor).toBe(0);
    expect(jogo.pontos).toBe(0);
  });

  test('não há novas jogadas depois da batida', () => {
    const jogo = batida();
    const antes = JSON.stringify(jogo);
    expect(() => jogar(jogo, 1, [4, 5], 'direita')).toThrow('Jogo encerrado');
    expect(() => comprar(jogo, 1)).toThrow('Jogo encerrado');
    expect(() => passar(jogo, 1)).toThrow('Jogo encerrado');
    expect(() => jogar(jogo, 0, [6, 6])).toThrow('Jogo encerrado');
    expect(JSON.stringify(jogo)).toBe(antes);
  });

  test('o turno não muda depois da batida', () => {
    const jogo = batida();
    expect(jogo.turno).toBe(0);
  });
});

describe('Jogo fechado (os dois passam seguidamente)', () => {
  test('vence quem tiver a menor soma na mão (jogador 0)', () => {
    const jogo = executar(cenario('6-6 0-1', '3-6 2-4'), [
      'J0 6-6',
      'J1 3-6 direita', // pontas 6|3
      'J0 passar', // 0-1 não encaixa
      'J1 passar', // 2-4 não encaixa
    ]);
    expect(jogo.status).toBe(STATUS.VITORIA);
    expect(jogo.motivo).toBe(MOTIVO.FECHADO);
    expect(jogo.vencedor).toBe(0); // 1 ponto contra 6
    expect(jogo.pontos).toBe(6);
  });

  test('vence quem tiver a menor soma na mão (jogador 1)', () => {
    const jogo = executar(cenario('6-6 4-4', '0-6 1-2'), [
      'J0 6-6',
      'J1 0-6 direita', // pontas 6|0
      'J0 passar',
      'J1 passar',
    ]);
    expect(jogo.status).toBe(STATUS.VITORIA);
    expect(jogo.motivo).toBe(MOTIVO.FECHADO);
    expect(jogo.vencedor).toBe(1); // 3 pontos contra 8
    expect(jogo.pontos).toBe(8);
  });

  test('somas iguais resultam em empate', () => {
    const jogo = executar(cenario('6-6 2-3', '5-6 1-4'), [
      'J0 6-6',
      'J1 5-6 direita', // pontas 6|5
      'J0 passar',
      'J1 passar',
    ]);
    expect(jogo.status).toBe(STATUS.EMPATE);
    expect(jogo.motivo).toBe(MOTIVO.FECHADO);
    expect(jogo.vencedor).toBeNull();
    expect(jogo.pontos).toBe(0);
  });

  test('um único passe não fecha o jogo', () => {
    const jogo = executar(cenario('6-6 0-1', '3-6 2-4'), ['J0 6-6', 'J1 3-6 direita', 'J0 passar']);
    expect(jogo.status).toBe(STATUS.EM_ANDAMENTO);
    expect(jogo.turno).toBe(1);
  });

  test('passes não seguidos não fecham o jogo', () => {
    // J1 passa, J0 joga, J1 passa de novo, J0 passa -> só aí são dois passes seguidos
    const jogo = cenario('6-6 5-6 1-1', '2-3 0-4');
    executar(jogo, ['J0 6-6', 'J1 passar', 'J0 5-6 esquerda', 'J1 passar']);
    expect(jogo.status).toBe(STATUS.EM_ANDAMENTO);
    passar(jogo, 0); // 1-1 não encaixa em 5|6
    expect(jogo.status).toBe(STATUS.VITORIA);
    expect(jogo.motivo).toBe(MOTIVO.FECHADO);
    expect(jogo.vencedor).toBe(0); // 2 pontos contra 9
    expect(jogo.pontos).toBe(9);
  });

  test('não há novas ações depois do fechamento', () => {
    const jogo = executar(cenario('6-6 0-1', '3-6 2-4'), ['J0 6-6', 'J1 3-6 direita', 'J0 passar', 'J1 passar']);
    expect(() => passar(jogo, 0)).toThrow('Jogo encerrado');
    expect(() => comprar(jogo, 0)).toThrow('Jogo encerrado');
    expect(() => jogar(jogo, 0, [0, 1], 'esquerda')).toThrow('Jogo encerrado');
  });

  test('o jogo só fecha com o monte vazio', () => {
    const jogo = executar(cenario('6-6 0-1', '3-6 2-4', '0-0'), ['J0 6-6', 'J1 3-6 direita']);
    expect(() => passar(jogo, 0)).toThrow('Ainda há pedras no monte');
    comprar(jogo, 0); // 0-0 não encaixa em 6|3
    passar(jogo, 0);
    passar(jogo, 1);
    expect(jogo.status).toBe(STATUS.VITORIA);
    expect(jogo.vencedor).toBe(0); // 0+1+0 = 1 contra 6
  });
});

// ---------------------------------------------------------------------------
// 9. Simulações
// ---------------------------------------------------------------------------

/** Joga uma partida inteira; `escolher` recebe as jogadas válidas e devolve o índice escolhido. */
function simular(jogo, escolher) {
  const eventos = { jogar: 0, comprar: 0, passar: 0 };
  let violacoes = 0;
  let passos = 0;

  const verificar = (turnoAnterior, tipo) => {
    const todas = [...jogo.maos[0], ...jogo.maos[1], ...jogo.monte, ...jogo.mesa].map(pedraId);
    if (todas.length !== 28 || new Set(todas).size !== 28) violacoes++; // nenhuma pedra some nem se repete
    for (let i = 0; i + 1 < jogo.mesa.length; i++) if (jogo.mesa[i][1] !== jogo.mesa[i + 1][0]) violacoes++;
    if (jogo.mesa.length > 0) {
      if (jogo.pontas.esquerda !== jogo.mesa[0][0]) violacoes++;
      if (jogo.pontas.direita !== jogo.mesa[jogo.mesa.length - 1][1]) violacoes++;
    }
    if (jogo.status === STATUS.EM_ANDAMENTO) {
      const esperado = tipo === 'comprar' ? turnoAnterior : 1 - turnoAnterior;
      if (jogo.turno !== esperado) violacoes++;
    }
  };

  while (jogo.status === STATUS.EM_ANDAMENTO) {
    const j = jogo.turno;
    const validas = jogadasValidas(jogo, j);
    let tipo;
    if (validas.length > 0) {
      const { pedra, lado } = validas[escolher(validas.length)];
      jogar(jogo, j, pedra, lado);
      tipo = 'jogar';
    } else if (jogo.monte.length > 0) {
      comprar(jogo, j);
      tipo = 'comprar';
    } else {
      passar(jogo, j);
      tipo = 'passar';
    }
    eventos[tipo]++;
    verificar(j, tipo);
    if (++passos > 500) throw new Error('Partida não terminou');
  }
  return { eventos, violacoes };
}

function conferirFim(jogo) {
  let violacoes = 0;
  if (jogo.motivo === MOTIVO.BATIDA) {
    if (jogo.status !== STATUS.VITORIA) violacoes++;
    if (jogo.maos[jogo.vencedor].length !== 0) violacoes++;
    if (jogo.pontos !== somaPedras(jogo.maos[1 - jogo.vencedor])) violacoes++;
  } else if (jogo.motivo === MOTIVO.FECHADO) {
    const s = [somaPedras(jogo.maos[0]), somaPedras(jogo.maos[1])];
    if (jogo.monte.length !== 0) violacoes++;
    if (jogo.passesSeguidos !== 2) violacoes++;
    if (temJogada(jogo, 0) || temJogada(jogo, 1)) violacoes++;
    if (s[0] === s[1]) {
      if (jogo.status !== STATUS.EMPATE || jogo.vencedor !== null || jogo.pontos !== 0) violacoes++;
    } else {
      const venc = s[0] < s[1] ? 0 : 1;
      if (jogo.vencedor !== venc || jogo.pontos !== s[1 - venc]) violacoes++;
    }
  } else {
    violacoes++;
  }
  return violacoes;
}

describe('Simulações', () => {
  test('500 partidas com jogadas aleatórias mantêm os invariantes e sempre terminam', () => {
    let violacoes = 0;
    const total = { jogar: 0, comprar: 0, passar: 0 };
    const finais = { batida: 0, fechado: 0 };

    for (let seed = 1; seed <= 500; seed++) {
      const rnd = lcg(seed);
      const jogo = criarJogo(seed);
      const r = simular(jogo, (n) => Math.floor(rnd() * n));
      violacoes += r.violacoes + conferirFim(jogo);
      Object.keys(total).forEach((k) => {
        total[k] += r.eventos[k];
      });
      finais[jogo.motivo]++;
      if (jogo.status === STATUS.EM_ANDAMENTO) violacoes++;
    }

    expect(violacoes).toBe(0);
    expect(total.jogar).toBeGreaterThan(0);
    expect(total.comprar).toBeGreaterThan(0); // as compras do monte foram exercitadas
    expect(total.passar).toBeGreaterThan(0); // os passes também
    expect(finais.batida).toBeGreaterThan(0);
    expect(finais.fechado).toBeGreaterThan(0); // e os jogos fechados
    expect(finais.batida + finais.fechado).toBe(500);
  });

  test('200 partidas com a estratégia "sempre a primeira jogada" terminam corretamente', () => {
    let violacoes = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const jogo = criarJogo(seed * 7);
      const r = simular(jogo, () => 0);
      violacoes += r.violacoes + conferirFim(jogo);
    }
    expect(violacoes).toBe(0);
  });

  test('a primeira jogada de toda partida é a pedra de abertura, feita por quem a tem', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const jogo = criarJogo(seed);
      const dono = jogo.turno;
      simular(jogo, () => 0);
      expect(jogo.historico[0]).toEqual({
        tipo: 'jogar',
        jogador: dono,
        pedra: pedraId(jogo.pedraAbertura),
        lado: null,
      });
    }
  });

  test('o vencedor da batida nunca é quem ainda tem pedras', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const jogo = criarJogo(seed);
      simular(jogo, () => 0);
      if (jogo.motivo === MOTIVO.BATIDA) {
        expect(jogo.maos[jogo.vencedor]).toHaveLength(0);
        expect(jogo.maos[1 - jogo.vencedor].length).toBeGreaterThan(0);
      }
    }
  });
});
