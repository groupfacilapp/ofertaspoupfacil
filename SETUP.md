# SETUP AUTOMATIZADO — Dispara-Zap 🚀

Bem-vindo! Para colocar o Dispara-Zap completo no ar em poucos minutos, basta você alterar os valores abaixo para os da sua conta e enviar este arquivo para a Inteligência Artificial (Claude).

---

## Passo 1: Preencha seus Dados

Abaixo, troque **somente o que está do lado direito do sinal de igual `=`**. 
Não apague as aspas!

```env
# 1. SUPABASE
# Acesse supabase.com/dashboard, abra seu projeto e copie o final da URL.
# Exemplo: se a URL for .../project/yuypedritsizhuegslej, o ID é yuypedritsizhuegslej
SUPABASE_PROJECT_ID="udlmqdwtisolgutzdylw"

# Crie uma senha segura (pode ser qualquer texto difícil) para proteger os jobs.
# Ela deve ser A MESMA que você vai colocar no seu arquivo .env.local depois.
CRON_SECRET_KEY="38cf3a475fdae9b063487d494d88aa6f"

# 2. EVOLUTION API (WhatsApp)
EVOLUTION_API_URL="https://sua-evolution.com"
EVOLUTION_API_KEY="SUA_MASTER_API_KEY_AQUI"
EVOLUTION_WEBHOOK_SECRET="MudeIssoSeQuiserOuDeixeAssim"

# 3. IDENTIFICAÇÃO DE INSTÂNCIAS (Opcional - pode deixar 'dz' ou colocar seu nome)
INSTANCE_PREFIX="rg"
```

---

## Passo 2: O Comando Mágico 🪄

Com os dados acima preenchidos, **copie este arquivo inteiro (SETUP.md)** ou arraste ele para o Claude (certifique-se de que o MCP do Supabase está ativado no Claude) e envie exatamente a mensagem abaixo:

> "Leia este arquivo SETUP.md. Os valores reais que eu preenchi estão no bloco de código da Etapa 1.
> 
> Você tem acesso ao MCP do Supabase e aos arquivos deste projeto. Execute as quatro etapas abaixo na ordem, confirmando cada uma antes de continuar:
> 
> **Etapa 1 — Banco de Dados**
> Verifique o arquivo `disparazap_structure.sql` e extraia a estrutura. Substitua todos os placeholders do arquivo SQL (ex: `{{SUPABASE_PROJECT_ID}}`) pelos valores que eu preenchi no bloco de código acima. Execute a query inteira usando a ferramenta do MCP (`execute_sql`) no meu projeto. É seguro pois o SQL usa `IF NOT EXISTS`.
> 
> **Etapa 2 — Cron Jobs**
> Faça o mesmo com o arquivo `disparazap_cron.sql`. Substitua os placeholders usando os meus valores do bloco de código acima e rode no meu banco de dados usando o MCP.
> 
> **Etapa 3 — Edge Functions (Sem JWT)**
> Leia todos os arquivos de `supabase/functions/` (incluindo `_shared/` e dependências). 
> Quero que você faça o deploy de duas Edge Functions via MCP (`deploy_edge_function`):
> 1. `automation` (entrypoint: `supabase/functions/automation/index.ts`). **MUITO IMPORTANTE: A propriedade `verify_jwt` TEM que ser `false`.** (Isto é obrigatório para o Cron funcionar).
> 2. `worker` (entrypoint: `supabase/functions/worker/index.ts`). **`verify_jwt: false`**. Adicione as pastas compartilhadas de connectors no deploy dessa função.
> 
> **Etapa 4 — Proteger Edge Functions (Secret)**
> As Edge Functions estão com JWT desativado, elas confiam num header CRON_SECRET. Para isso dar certo, preciso que você configure o secret `CRON_SECRET` no painel de Edge Functions do Supabase (para o meu projeto) com o exato valor de `CRON_SECRET_KEY` que está no código acima.
>
> Aguardo a execução passo a passo!"
