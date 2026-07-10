# DisparaZap — Requirements

## Phase 3: Automação & Fila de Produtos

### PROD — Fila de Produtos

- **PROD-01:** Página `/produtos` lista todos os produtos coletados do usuário com status (pendente/enviado/falha)
- **PROD-02:** Usuário pode filtrar por marketplace (Amazon, ML, Shopee, AliExpress), status e buscar por nome
- **PROD-03:** Cada produto mostra: imagem, nome, preço, desconto %, marketplace badge, status, link de afiliado
- **PROD-04:** Usuário pode enviar um produto individualmente ("Enviar agora") para grupos configurados
- **PROD-05:** Produtos têm status `pending | sent | failed` por disparo, com timestamp de envio
- **PROD-06:** Botão "Limpar enviados" para remover produtos já enviados da fila

### AUTO — Automações

- **AUTO-01:** Página `/automacoes` mostra regras de busca automática e disparo automático por marketplace
- **AUTO-02:** Por marketplace, usuário configura: intervalo de busca (2h/4h/6h/12h/24h), ativo/inativo
- **AUTO-03:** Por marketplace, usuário configura disparo automático: intervalo (5/10/15/20/30 min), janela horária (HH:MM — HH:MM), grupos de destino, ativo/inativo
- **AUTO-04:** Toggle ativo/inativo por regra salvo no banco e respeitado pelos Trigger.dev tasks
- **AUTO-05:** Página mostra stats em tempo real: pendentes, buscados hoje, último disparo por marketplace
- **AUTO-06:** "Como funciona" explicação inline por regra de disparo

### DASH — Dashboard Melhorado

- **DASH-01:** Gráfico de barras "Últimos 7 dias" mostrando disparos por dia
- **DASH-02:** Cards de stats: Produtos por marketplace (com barra de progresso proporcional)
- **DASH-03:** Card "Instância WhatsApp" mostrando status de conexão do canal ativo
- **DASH-04:** Stats gerais: Total produtos, Enviados hoje, Pendentes, Sucesso, Falhas
