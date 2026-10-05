# Verificação do banco remoto — 25/09/2026

Projeto: `vgopcoyrbbekeyytzhec`, confirmado pela URL configurada no aplicativo.

Aplicadas pelo plugin Supabase:

- `secure_atomic_task_changes` (versão remota `20260925161024`).
- `restrict_trigger_function_execution`.

Verificações executadas no banco remoto dentro de transações revertidas:

- Criação de grupo com exatamente um proprietário e resposta correta do convite.
- Gravação de tarefa e subtarefa.
- Rollback integral quando a subtarefa é inválida.
- Bloqueio de leitura por usuário externo e de ingresso direto por UUID.
- Exclusão e restauração da mesma tarefa.
- Funcionamento dos gatilhos após revogar execução direta de funções internas.

Nenhum dado temporário dos testes permaneceu no banco. Os oito testes locais da suíte de integração PostgreSQL também passaram após a última migração.

Alertas restantes da checagem de segurança:

- As três funções autenticadas de colaboração usam privilégios elevados intencionalmente e limitam os resultados pelo usuário e pelo grupo. [Explicação do verificador](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- A proteção contra senhas vazadas continua desativada na configuração do Supabase Auth. Não foi alterada nesta implantação. [Configuração e disponibilidade](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Esta verificação cobre o banco. Não representa publicação do frontend nem teste de entrega de e-mails de recuperação.
## Atualização de evolução — 01/10/2026

Migração `durable_rpg_history` aplicada ao mesmo projeto remoto. Histórico inicializado das tarefas existentes; gatilhos privados preservam somente evidências de recompensa. Títulos e descrições de tarefas removidas não são arquivados.

Testes locais com PostgreSQL cobrem exclusão, desfazer, reabertura, ciclos de foco, repetição offline, leitura de membros e remoção de grupos. Verificação remota em transação revertida confirmou isolamento de terceiros. Os avisos de segurança anteriores permaneceram: RPCs autenticadas de grupos, intencionais, e proteção contra senhas vazadas desativada. Nenhum novo aviso de segurança foi introduzido.

## Missões pessoais — 01/10/2026

Migração `personal_mission_achievements` aplicada ao projeto remoto. Tarefas existentes mantêm o tipo normal; missões são uma escolha explícita. O histórico preserva nome do objetivo, data e contagem de etapas. Teste autenticado em transação revertida confirmou a conquista após excluir a missão. A suíte PostgreSQL também verifica etapas pendentes, repetição, restauração e isolamento de terceiros. Nenhum novo aviso de segurança foi introduzido.

## Planejamento, colaboração e lembretes — 05/10/2026

Aplicadas `planning_and_collaboration`, `background_reminders` e `reminder_scheduler`. A função `send-reminders` está ativa e recebe chamadas autenticadas pelo segredo privado do cron `apptodo-deadline-reminders`, a cada minuto. Chaves foram provisionadas após autorização explícita do usuário e não estão no repositório.

A implementação aceita as colunas de prazo legadas em texto do projeto remoto e as colunas tipadas do bootstrap local. Verificação remota em transação revertida confirmou notas/ordem das etapas e bloqueio de conclusão antecipada. As chamadas do cron retornaram HTTP 200; a entrega ao dispositivo exige consentimento e inscrição de Web Push.

O novo RPC autenticado `get_push_public_key` retorna somente a chave pública; `get_push_config` e `claim_push_reminders` são exclusivos do servidor. Os avisos de RLS sem política em configuração privada e entregas são intencionais: clientes não recebem acesso a essas tabelas. A proteção contra senhas vazadas continua pendente nas configurações de Auth.

Detalhes e limites: [registro dos ajustes](../docs/ajustes-2026-10-05.md).
