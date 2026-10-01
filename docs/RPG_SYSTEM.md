# Evolução e gamificação

A evolução é separada por espaço. No espaço pessoal, representa suas tarefas; em um grupo, representa o progresso coletivo desse grupo. XP, foco, áreas e conquistas sempre usam o mesmo escopo. A ficha mostra explicitamente esse escopo.

## Recompensas

- Toda tarefa concluída vale 30 XP, independentemente da prioridade. Prioridade organiza a agenda e não mede esforço.
- Cada subtarefa concluída acrescenta 10 XP e cada ciclo Pomodoro acrescenta 20 XP à recompensa da tarefa.
- O XP desses bônus entra quando a tarefa é concluída. Minutos de foco contam também em tarefas pendentes; ciclos de foco não criam conquistas genéricas.
- Cada ciclo completo representa 25 minutos de foco.
- Cada nível geral L requer 100 × L XP adicionais; os atributos de cada área requerem 50 × L XP adicionais.
- Categorias alimentam Trabalho, Estudo, Saúde, Finanças, Pessoal e Outros. Os títulos de nível permanecem; conquistas vêm exclusivamente de missões grandes criadas pelo usuário.

## Histórico e sincronização

O histórico é deduplicado por tarefa e espaço. Excluir ou limpar tarefas preserva sua evidência de recompensa e foco, sem guardar títulos ou descrições de tarefas comuns. Para missões, preserva o nome do objetivo e a data de conclusão para identificar a conquista; descrições e títulos das etapas não são arquivados. Restaurar a mesma tarefa não duplica XP; reabrir uma tarefa retira seu XP de conclusão e mantém os ciclos de foco.

No visitante, as evidências ficam em armazenamento local. Na conta, `rpg_task_history` mantém o histórico no Supabase: apenas gatilhos privados podem escrevê-lo. RLS permite ler somente o espaço pessoal do usuário ou grupos dos quais é membro. Excluir a conta ou grupo elimina o respectivo histórico.

Tarefas concluídas e removidas offline transportam a última evidência na fila de exclusão; a API materializa e remove o snapshot na mesma transação. Tentativas repetidas não duplicam recompensas. Ao entrar na conta, o visitante migra também evidências de tarefas removidas, com IDs estáveis durante novas tentativas.

O cache é separado por conta/grupo. A nuvem é a fonte oficial; somente alterações locais pendentes podem sobrepor o histórico remoto. A ficha apresenta uma mensagem se não puder atualizar o histórico e mantém os dados locais disponíveis. Uma atualização periódica consulta o histórico de contas a cada 30 segundos.

## Interface

Um acesso principal por dispositivo: Evolução na sidebar do computador e na navegação inferior do celular. A ficha usa abas Áreas/Conquistas, barras com porcentagens reais, valores legíveis e explicação de XP sob demanda.

As recompensas aparecem em uma notificação breve e dispensável, depois de uma conclusão salva. Carregar tarefas, trocar de conta ou grupo não dispara comemoração. A subida de nível não abre um modal nem interrompe a próxima tarefa. Atalhos do fundo são bloqueados em qualquer diálogo.

Configurações → Gamificação oculta XP, acessos e notificações. O histórico continua sendo preservado. A preferência vale para este navegador.

## Validação e limites

Testes de cálculo, histórico local, visitante → conta, isolamento e PostgreSQL real cobrem exclusão/restauração, reversão, foco em tarefas pendentes, repetição offline, RLS e limpeza de grupos. A migração `durable_rpg_history` inicializa o histórico usando as tarefas ainda existentes. Não é possível recuperar recompensas de tarefas apagadas antes desta atualização.

O backup JSON atual exporta tarefas ativas e seus bônus, sem o histórico de tarefas já removidas. Contas preservam esse histórico na nuvem; no visitante, limpar os dados do navegador também remove o histórico local.

## Missões concretas

`kind: task` é a opção padrão, inclusive para registros anteriores. `kind: mission` exige ao menos uma etapa; apenas missões concluídas com todas as etapas feitas aparecem como conquistas realizadas. Objetivos ativos mostram progresso por etapas. Adicionar uma etapa pendente ou reabrir uma etapa retira a conquista e reabre a missão. Nenhuma missão de exemplo é criada automaticamente. Exportação/importação preserva o tipo, e a migração de visitante para conta preserva nomes e datas de conquistas arquivadas.
