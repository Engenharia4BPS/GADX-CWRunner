# Araucaria CW Runner — instruções para agentes

## Objetivo

Aplicação web de treinamento CW para Araucária DX. A interface deve ser eficiente e familiar a operadores de contest, inspirada no fluxo da Entry Window do N1MM, sem copiar nome, ativos visuais ou aparência proprietária.

## Arquitetura

- `apps/web`: interface, entrada de teclado e reprodução de áudio no navegador.
- `packages/runner-core`: regras de contest e modelos determinísticos, sem DOM, relógio real, Web Audio ou rede.
- `packages/protocol`: eventos e schemas compartilhados entre web e servidor.
- `services/runner-server`: autoridade do modo verificado; é o único lugar que calcula score e resolve chamadas/exchanges.

## Regras inegociáveis

1. Nunca confiar no browser para score, tempo, chamadas sorteadas ou validação em sessões verificadas.
2. Não enviar ao browser, em modo verificado, texto/JSON que revele callsigns, exchanges, sementes ou gabaritos antes de serem audivelmente necessários.
3. Manter o motor de regras puro e testável. Preferir funções determinísticas que recebam estado + evento e retornem novo estado.
4. Usar TypeScript strict; evitar `any`.
5. Web Audio deve ser iniciado somente após gesto explícito do usuário.
6. Tratar `visibilitychange` e perda de foco como sinais de integridade, nunca como prova conclusiva de fraude.
7. Não introduzir framework ou dependência sem necessidade demonstrável.

## Fluxo de trabalho

- Faça alterações pequenas, coesas e verificáveis.
- Antes de mudar um contrato em `packages/protocol`, ajuste consumidores e documentação.
- Rode `pnpm check` e `pnpm build` quando os scripts existirem.
- Documente decisões estruturais em `docs/`.
