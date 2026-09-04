# Arquitetura

## Separação de responsabilidades

| Camada | Responsabilidade | Não pode fazer |
| --- | --- | --- |
| `apps/web` | interface, teclado, áudio CW, preferências locais | decidir score verificado ou a resposta de um QSO |
| `runner-core` | regras puras de contest e estados de sessão | acessar DOM, relógio, rede ou Web Audio |
| `protocol` | contratos de mensagens e versão de protocolo | conter segredo de cenário |
| `runner-server` | cenário, relógio oficial, validação, score e ranking | confiar em score/timestamp fornecido pelo cliente |

## Dois modos

### Treino

A sessão roda totalmente no navegador. É rápida, funciona com conexão instável e salva resultados locais. Não entra em ranking público.

### Desafio verificado

O servidor é autoritativo. Ele cria os cenários, mantém o relógio e calcula o resultado. A conexão é persistente e autenticada; as ações do operador são numeradas e auditáveis.

O cliente recebe áudio a reproduzir, controles visuais e estado mínimo de apresentação. Não recebe o texto dos callsigns/exchanges nem uma semente que permita antecipá-los.

## Fluxo de uma sessão verificada

1. O usuário inicia com um gesto explícito; o navegador habilita o áudio.
2. O servidor cria a sessão e registra configuração e versão do protocolo.
3. O servidor agenda os estímulos e entrega pequenos blocos de áudio por canal seguro em tempo real.
4. O navegador envia ações: caracteres digitados, troca RUN/S&P, macros e log.
5. O servidor valida sequência, tempo e conteúdo, atualiza score e devolve apenas o estado necessário para a tela.
6. O servidor grava o histórico para auditoria e detecção de anomalias.

Atrasar intencionalmente a conexão não para o relógio do servidor: isso só reduz a chance de concluir a sessão ou a torna inválida.

## Limite de integridade

Não existe garantia absoluta contra alguém que ouve o áudio e usa um decodificador externo. A meta é impedir fraude trivial no DevTools e produzir evidência suficiente para que o ranking seja recreativo e confiável. Para competição de alto impacto, seria necessária supervisão humana.

## Hospedagem

A interface gerada pelo Vite é estática e pode viver em `araucariadx.com/cw/`. O modo verificado requer um serviço separado com WebSocket seguro (ou WebRTC em etapa posterior), banco de dados e observabilidade; não deve depender do PHP do ranking existente.

## Search & Pounce local

A primeira etapa do modo S&P mantém a separação existente:

- `BandmapEngine` gera e mantém spots determinísticos sem DOM, rede ou relógio real;
- `VirtualVfo` limita e atualiza a frequência sintonizada;
- `SandPSessionController` coordena seleção, repetição e agendamento por portas injetadas;
- `BandmapView`, em `apps/web`, renderiza a escala e os indicativos HTML;
- o controlador web reutiliza o mesmo `AudioContext`, `CwAudioEngine`, ambiente RX e carregador de indicativos do modo RUN.

O Bandmap local pode revelar os indicativos porque pertence exclusivamente ao treino não verificado. Essa representação não deve ser reutilizada no futuro modo verificado.

### QSO S&P interativo

`sp-qso.ts` é um reducer puro: recebe cenário e eventos de operador/estação, devolvendo novo estado e efeitos declarativos. Ele não acessa relógio, áudio, DOM, armazenamento, rede ou aleatoriedade direta. Cada cenário limita os incidentes a dois e usa uma fonte aleatória injetada, para que uma futura sessão verificada possa reproduzir exatamente o mesmo contato.

`SpQsoController`, no cliente, executa os efeitos através do motor CW e mantém um contador de geração para invalidar timers pendentes ao trocar de spot, limpar o QSO, sair do S&P ou encerrar a sessão. O QSO local só é contabilizado após o `TU` da estação; então o spot é marcado como trabalhado.

O motor separa o estado lógico do contato (o que falta receber) do estado físico (escutando, copiando, preparando ou transmitindo). A conferência do CALL/RST/número acontece somente após o `TU`: a estação reage apenas às mensagens transmitidas pelo operador, enquanto o log local recebe `OK`, `CALL`, `RST`, `NR`, `NIL` ou `DUP`.
