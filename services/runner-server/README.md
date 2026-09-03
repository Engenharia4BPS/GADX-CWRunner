# Runner server

Este diretório será o serviço autoritativo do **modo verificado**.

Ele ainda não é iniciado nesta fase. Quando for implementado, deverá:

- autenticar o operador e abrir sessão WSS;
- gerar cenário e manter tempo oficial;
- enviar estímulos de áudio sem revelar gabaritos em texto;
- validar eventos sequenciados;
- calcular score exclusivamente no servidor;
- persistir auditoria e sinais de integridade.

O serviço não deve ser hospedado como parte do PHP do ranking atual.
