# Deploy Automático — Dispara-Zap

Você já preencheu o `CONFIG.md` com seus dados e está no Claude com o MCP do Supabase ativo.

Agora copie o prompt abaixo e envie para o Claude junto com os arquivos:
- `CONFIG.md`
- `disparazap_structure.sql`
- `disparazap_cron.sql`
- `DEPLOY_FUNCTIONS.md` (este arquivo)

---

## Prompt Mágico (copie e envie)

> Você tem acesso ao MCP do Supabase. Acabei de anexar 4 arquivos: `CONFIG.md`, `disparazap_structure.sql`, `disparazap_cron.sql` e `DEPLOY_FUNCTIONS.md`.
>
> **Leia o `CONFIG.md` primeiro** e extraia todos os valores do dicionário de substituição. Use esses valores para substituir os placeholders `{{...}}` em todos os arquivos SQL antes de executar.
>
> Execute na seguinte ordem, **sem pular etapas**:
>
> **1. Banco de dados (disparazap_structure.sql)**
> Substitua todos os placeholders pelos valores do CONFIG.md e execute o SQL completo no projeto Supabase usando o MCP (`execute_sql`). O arquivo usa `IF NOT EXISTS` e `ON CONFLICT DO NOTHING`, então é seguro executar mesmo que algumas tabelas já existam.
>
> **2. Cron jobs (disparazap_cron.sql)**
> Substitua `{{SUPABASE_PROJECT_ID}}` e `{{CRON_SECRET_KEY}}` pelos valores do CONFIG.md e execute no mesmo projeto.
>
> **3. Edge Functions**
> Leia todos os arquivos da pasta `supabase/functions/` do projeto (incluindo toda a subpasta `_shared/` e seus subdiretórios). Faça o deploy de duas funções usando o MCP (`deploy_edge_function`):
> - Função `automation`: entrypoint `supabase/functions/automation/index.ts`, inclua como dependências todos os arquivos `_shared/` que ela importa. **`verify_jwt: false`** (obrigatório).
> - Função `worker`: entrypoint `supabase/functions/worker/index.ts`, inclua como dependências **todos** os arquivos de `supabase/functions/_shared/` incluindo a subpasta `connectors/`. **`verify_jwt: false`** (obrigatório).
>
> **4. Secret da Edge Function**
> Configure o secret `CRON_SECRET` nas Edge Functions do projeto com o valor de `{{CRON_SECRET_KEY}}` do CONFIG.md.
>
> Confirme cada etapa antes de passar para a próxima. Se alguma etapa falhar, informe o erro antes de continuar.
