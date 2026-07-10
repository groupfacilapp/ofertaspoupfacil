# Configuração Inicial — Dispara-Zap

Preencha **apenas este arquivo** com os seus dados reais. A IA vai ler este arquivo e configurar tudo automaticamente.

---

## Seus Dados (Altere aqui)

| Placeholder                    | O que é                                                                                   | Seu Valor Real (Altere Aqui)              |
|--------------------------------|-------------------------------------------------------------------------------------------|-------------------------------------------|
| `{{SUPABASE_PROJECT_ID}}`      | ID do projeto Supabase (parte final da URL do dashboard)                                  | `cole-seu-project-id-aqui`                |
| `{{CRON_SECRET_KEY}}`          | Chave secreta para os cron jobs — mesma que está no `.env.local` como `CRON_SECRET`      | `COLE_O_MESMO_VALOR_DO_ARQUIVO_ENV`       |
| `{{EVOLUTION_API_URL}}`        | URL base da sua Evolution API (ex: `https://evolution.seudominio.com`)                   | `https://SUA_URL_EVOLUTION_API.com`       |
| `{{EVOLUTION_API_KEY}}`        | API Key global da Evolution API                                                           | `SUA_EVOLUTION_API_KEY`                   |
| `{{EVOLUTION_WEBHOOK_SECRET}}` | Secret token para validar webhooks da Evolution API                                       | `SEU_WEBHOOK_SECRET`                      |
| `{{INSTANCE_PREFIX}}`          | Prefixo para nomes de instâncias WhatsApp (ex: `dz`, `meubot`)                           | `seu_prefixo`                             |

> **Onde acho o SUPABASE_PROJECT_ID?**
> Acesse [supabase.com/dashboard](https://supabase.com/dashboard) → clique no projeto → veja a URL: `https://supabase.com/dashboard/project/yuypedritsizhuegslej`. O ID é a parte final.

---

## Próximo Passo

Com este arquivo preenchido, abra o Claude (com MCP do Supabase configurado) e siga as instruções do arquivo `DEPLOY_FUNCTIONS.md`.
