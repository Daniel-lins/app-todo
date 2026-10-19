# Central interna de notificações

O sino está no cabeçalho de desktop e celular e mostra quantos avisos ainda não foram lidos. Os avisos podem ser marcados individualmente ou em conjunto; abrir uma tarefa pelo aviso também marca a leitura. Abrir o painel sozinho não altera a leitura.

Os avisos incluem início planejado, prazo para hoje sem horário, prazo nos próximos quinze minutos, prazo vencido (até trinta dias atrás) e encerramento de Pomodoro ou sessão curta. Não dependem de permissão do sistema operacional. Não concluem tarefas nem geram XP.

Histórico e leitura ficam neste navegador, separados por conta e espaço, com até duzentos avisos visíveis e trinta e um dias de retenção. Uma lista de identificadores impede que avisos recentes voltem como não lidos quando saem do limite visível. A central não sincroniza entre dispositivos nem entra no backup de tarefas.

A central verifica horários ao carregar o espaço, voltar ao app e a cada trinta segundos enquanto estiver aberto. Ao retornar pode mostrar avisos de início que passaram no mesmo dia. Não executa com o app fechado nem substitui os lembretes Web Push já existentes. O encerramento de foco aparece quando o cronômetro for reconciliado pelo app. Nenhuma permissão ou preferência de notificações externas é alterada automaticamente.

Validação: seis testes novos cobrem geração independente da permissão, leitura durável, deduplicação, isolamento entre espaços, início já executado, datas futuras, retenção e recuperação de dados locais inválidos.
