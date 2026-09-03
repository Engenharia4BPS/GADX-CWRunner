# Araucaria CW Runner

Treinador de CW para a comunidade Araucária DX, inspirado na experiência do Morse Runner e com uma interface familiar a operadores de contest que usam N1MM.

> Projeto independente do `/ranking`, `/bandwatch` e `/dxhunter`. A aplicação web será publicada em `araucariadx.com/cw/`.

## O que estamos construindo

- **Treino**: simulação local no navegador, áudio CW via Web Audio API e funcionamento progressivo/offline.
- **Desafio verificado**: sessão em tempo real em que o servidor decide cenário, tempo, validações e pontuação; o navegador só reproduz áudio e envia ações.
- **Interface**: inspiração funcional na *Entry Window* do N1MM, sem copiar sua identidade visual.

## Estrutura

```text
apps/web/                 interface web estática (Vite + TypeScript)
packages/runner-core/     regras determinísticas do simulador
packages/protocol/        contratos de eventos cliente ↔ servidor
services/runner-server/   futuro serviço em tempo real do modo verificado
docs/                     produto, arquitetura e roteiro
```

## Começar no VS Code

Pré-requisitos: Node.js 22 LTS e pnpm 9.

```bash
git clone https://github.com/Engenharia4BPS/GADX-CWRunner.git
cd GADX-CWRunner
corepack enable
pnpm install
pnpm dev
```

Abra `http://localhost:5173`. Para orientar o Codex no VS Code, mantenha o arquivo `AGENTS.md` na raiz aberto ou referenciado na conversa.

## Princípios técnicos

1. Motor de contest sem DOM, Web Audio ou rede: ele deve rodar tanto no navegador quanto no servidor.
2. O navegador nunca calcula nem confirma pontuação do modo verificado.
3. No modo verificado, informações que revelem a resposta não são entregues em texto ao cliente.
4. A experiência de treino deve continuar leve e acessível mesmo sem ranking.

Veja [a arquitetura](docs/architecture.md) e o [roteiro](docs/roadmap.md).

## Origem e licença

O estudo de referência é [VE3NEA/MorseRunner](https://github.com/VE3NEA/MorseRunner), escrito em Delphi/Object Pascal e distribuído sob MPL-2.0. Nenhum código dele foi copiado nesta inicialização. Antes de portar código ou dados derivados, preservaremos os avisos e obrigações da MPL-2.0.

## Status

Base do projeto criada. O próximo marco é implementar o gerador de CW e uma primeira sessão local de treino.
