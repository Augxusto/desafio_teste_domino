# desafio_teste_domino

- Nome: Rodrigo Augusto da Silva Virgilino
- RA: 24139528-2

---

## Especificação do Desafio

Este repositório contém os casos de teste em **JavaScript** utilizando **Jest** (abordagem **TDD**) para o desafio de **Dominó**, conforme a disciplina de Teste de Software:

- **Partida:** `2` jogadores com o jogo duplo-seis de `28` pedras (`0-0` até `6-6`).
- **Distribuição:** cada jogador recebe `7` pedras e as `14` restantes formam o `monte`.
- **Regras principais:**
  * Abre a partida quem tiver a maior carroça (pedra dupla). Sem carroças, abre a pedra de maior soma (empate na soma: a de maior lado). A primeira jogada é obrigatoriamente com essa pedra.
  * Cada pedra jogada precisa encaixar (mesmo número) em uma das duas pontas da mesa.
  * Quem não tem pedra que encaixe compra do monte até conseguir jogar. Com o monte vazio, passa a vez.
  * Vence por `batida` quem ficar sem pedras e recebe a soma dos pontos da mão do adversário.
  * Se os dois jogadores passarem seguidamente o jogo está `fechado`: vence quem tiver a menor soma na mão (recebe a soma da mão do adversário). Somas iguais resultam em `empate` (0 ponto).
- **Linguagem e framework de teste:** JavaScript (`CommonJS`) com **Jest**.

---

## Funcionamento dos Casos de Teste

A suíte de testes está em `tests/domino.test.js` e valida `criarPedras`, `criarJogo`, `criarJogoComMaos`, `pedraDeAbertura`, `jogadasValidas`, `jogar`, `comprar`, `passar` e `mesaParaTexto`:

1. **Pedras:** 28 pedras diferentes, 7 carroças, cada número aparecendo 8 vezes, soma total de 168 pontos e validação do formato das pedras.
2. **Criação da partida:** 7 + 7 + 14 pedras, nenhuma repetida, mesa vazia, distribuição determinística por seed e início com quem tem a pedra de abertura.
3. **Pedra de abertura:** Maior carroça, carroça pequena contra pedra comum de soma alta, maior soma sem carroças, desempate pelo maior lado e pedras do monte ignoradas.
4. **Validação de parâmetros:** Rejeita mãos que não são listas, jogador sem pedras, pedras inválidas e pedras repetidas (na mesma mão, entre as mãos ou no monte).
5. **Primeira jogada:** Só o dono da abertura joga, só com a pedra de abertura, e não pode comprar nem passar.
6. **Jogadas na mesa:** Encaixe nas duas pontas, pedra que serve nos dois lados, carroça na ponta, corrente da mesa sempre consistente, histórico e jogadas inválidas (não encaixa, lado inválido, pedra de outro jogador ou do monte, fora da vez, jogador inválido) sem alterar o estado.
7. **Compra no monte:** Compra a primeira pedra do monte, continua na vez, compra de novo se não encaixar, não compra com jogada disponível, fora da vez ou com o monte vazio.
8. **Passar a vez:** Só sem jogada e com o monte vazio; uma jogada zera a contagem de passes seguidos.
9. **Fim de jogo:** Batida (vencedor e pontos), jogo fechado vencido por cada jogador, empate por somas iguais, passes não seguidos que não fecham o jogo e bloqueio de novas ações após o fim.
10. **Simulações:** 500 partidas com jogadas aleatórias e 200 com a estratégia "sempre a primeira jogada", verificando que as 28 pedras nunca somem nem se repetem, que a mesa é uma corrente válida, que os turnos alternam e que o resultado final é coerente (vencedor, pontos e empate).

A distribuição fixa usada nos testes está em `MAO0` e `MAO1` (o resto vai para o `MONTE`), e uma abertura de três jogadas deixa a mesa em um estado fácil de conferir:

```
Jogador 0: 6-6 4-6 3-5 2-4 1-3 2-2 0-1
Jogador 1: 5-5 5-6 4-5 3-4 2-3 1-1 0-0

J0 joga 6-6              mesa: [6|6]
J1 joga 5-6 (direita)    mesa: [6|6][6|5]
J0 joga 4-6 (esquerda)   mesa: [4|6][6|6][6|5]     pontas: 4 e 5
```

Os cenários de fim de jogo usam mãos reduzidas (por exemplo `cenario('6-6 5-6', '4-5 1-2')`) para chegar rápido à batida, ao fechamento e ao empate.

### Como executar os testes

```
npm install
npm test
```
