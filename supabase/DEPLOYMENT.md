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
