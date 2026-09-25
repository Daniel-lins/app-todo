# AppToDo

Organizador de tarefas com lista, Kanban, subtarefas, grupos e Pomodoro. O modo visitante salva no navegador; contas usam Supabase com cache e fila local de alterações.

## Executar

```sh
npm install
npm run dev
```

Configure `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Nunca use uma chave administrativa no cliente.

## Banco de dados

Alterações no código não aplicam migrações ao projeto remoto. Esta versão depende da função `apply_task_changes` e da coluna `pomodoro_session_ids`.

Para um projeto novo, execute os arquivos de `supabase/migrations` em ordem:

1. `20260924170000_initial_schema.sql`: esquema inicial.
2. `20260924180000_group_collaboration_and_rls.sql`: convite, associação do proprietário e publicação Realtime.
3. `20260924200000_add_updated_at_to_tasks.sql`: data de atualização.
4. `20260925010000_secure_atomic_task_changes.sql`: políticas corretivas, gravação atômica e contadores.

Para uma instalação existente com as migrações de 24/09 aplicadas, a migração corretiva de 25/09 é obrigatória. Ela substitui as políticas das cinco tabelas do aplicativo, impede ingresso direto em grupos e preserva a autoria das tarefas. Revise políticas personalizadas antes de aplicá-la. O bootstrap não substitui tabelas existentes; esquemas externos diferentes precisam ser compatibilizados.

No Supabase Auth, inclua nas URLs de redirecionamento `/auth/callback` e `/auth/reset-password` para localhost e para o domínio publicado.

## Persistência e recuperação

- Cada alteração é colocada na fila local antes do envio. A confirmação remove somente a operação enviada, preservando uma edição mais nova.
- Tarefas, subtarefas e exclusões de um lote são gravadas em uma transação. Falhas mantêm a fila para nova tentativa.
- O aplicativo tenta reenviar ao abrir o espaço, retornar à aba, recuperar a conexão ou usar “Tentar sincronizar novamente”. A fila é separada por conta e grupo.
- “Desfazer” restaura a mesma tarefa, incluindo conclusão, subtarefas e histórico de foco.
- A importação cria cópias com novos IDs para não sobrescrever tarefas de outro espaço. Antes de substituir, salva uma cópia local recuperável em **Configurações → Backup e Restauração → Baixar cópia anterior à última importação**.
- Tarefas do visitante são copiadas para a conta pessoal com IDs estáveis durante tentativas de migração. O espaço visitante só é limpo depois da confirmação; a cópia de segurança permanece local.
- O Pomodoro é separado por conta e espaço. A hidratação aguarda as tarefas, e a conclusão usa o identificador da sessão para evitar contagem repetida.
- Os contadores do perfil representam tarefas concluídas e ciclos de foco das tarefas atualmente atribuídas ao autor; são atualizados pelo banco.

Limites: o modo local depende do armazenamento do navegador. Limpar os dados do site apaga cache e alterações ainda não enviadas; exporte um backup antes. Edições simultâneas de uma mesma tarefa usam a última gravação aceita, sem fusão campo a campo. Notificações web dependem de permissão e da execução do navegador. Não existe certificação de conformidade WCAG.

## Verificação

```sh
npm test
npm run lint
npm run build
```

O teste descobre automaticamente todos os arquivos `tests/*.test.ts`. Há testes de domínio, serviços reais de persistência com transporte controlado e migrações executadas em PostgreSQL local via PGlite. Estes últimos verificam RLS, ingresso por convite, autoria, rollback e isolamento entre usuários. Alguns testes antigos verificam estruturas ou modelos simulados; não equivalem a testes do serviço remoto.

A compilação usa fontes do Google e precisa de acesso à rede. A validação local não comprova o estado das políticas, migrações, entrega de e-mail ou Realtime do projeto Supabase publicado. Esses itens precisam de uma verificação no ambiente de destino após a migração.
