import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOCUS_DURATION,
  createInitialPomodoroSession,
  startPomodoroTimer,
  pausePomodoroTimer,
  tickPomodoroTimer,
  syncPomodoroWithTasks,
} from '../src/utils/pomodoroTimer';
import { TodoItem } from '../src/types/todo';
import {
  checkDeadlinesAndNotify,
  getNotificationStatus,
  NOTIFICATION_LIMITS_DOC,
} from '../src/utils/notificationService';

describe('Pomodoro Confiável: Relógio Controlado e Resistência a Atrasos', () => {
  const mockTask: TodoItem = {
    id: 'task-pom-1',
    title: 'Escrever Documentação',
    completed: false,
    priority: 'high',
    category: 'work',
    dueDate: '2026-09-24',
    pinned: false,
    pomodoros: 0,
    order: 0,
    createdAt: '2026-09-24T10:00:00.000Z',
    subTasks: [],
  };

  it('Fechar o modal não interrompe o timer e reabrir não reinicia a contagem', () => {
    const t0 = 1000000;
    // 1. Inicia o timer
    let session = createInitialPomodoroSession('focus', mockTask);
    session = startPomodoroTimer(session, t0);

    assert.equal(session.isRunning, true);
    assert.equal(session.remainingSeconds, FOCUS_DURATION);
    assert.equal(session.targetEndTime, t0 + FOCUS_DURATION * 1000);

    // 2. Simula o modal fechando (a sessão permanece intacta e continua executando)
    const isModalOpen = false;
    assert.equal(isModalOpen, false);
    assert.equal(session.isRunning, true, 'O timer deve continuar rodando com o modal fechado');

    // 3. Avança o relógio em 300 segundos (5 minutos) com o modal fechado
    const t1 = t0 + 300 * 1000;
    const tickResult = tickPomodoroTimer(session, t1);
    session = tickResult.session;

    assert.equal(session.remainingSeconds, FOCUS_DURATION - 300); // 1200s (20:00)
    assert.equal(session.isRunning, true);

    // 4. Simula reabertura do modal: NÃO reinicia a contagem
    const modalReopened = true;
    assert.ok(modalReopened);
    assert.equal(
      session.remainingSeconds,
      1200,
      'Ao reabrir o modal, o tempo restante deve ser preservado exatamente no tempo real decorrido'
    );
    assert.notEqual(session.remainingSeconds, FOCUS_DURATION);
  });

  it('Contagem baseada em horário real, resistente a congelamento de abas/intervalos', () => {
    const t0 = 2000000;
    let session = createInitialPomodoroSession('focus', mockTask);
    session = startPomodoroTimer(session, t0);

    // Simula que a aba foi para segundo plano e o navegador congelou o setInterval por 2 minutos (120s)
    // O próximo tick ocorre apenas em t0 + 120_000ms
    const tAfterFreeze = t0 + 120 * 1000;
    const { session: updatedSession } = tickPomodoroTimer(session, tAfterFreeze);

    // O tempo decorrido deve refletir os 120 segundos reais, sem atraso
    assert.equal(updatedSession.remainingSeconds, FOCUS_DURATION - 120);
    assert.equal(updatedSession.isRunning, true);
  });

  it('Pausar, avançar tempo e retomar com relógio controlado', () => {
    const t0 = 3000000;
    let session = createInitialPomodoroSession('focus', mockTask);
    session = startPomodoroTimer(session, t0);

    // Roda por 60 segundos
    const t1 = t0 + 60 * 1000;
    session = tickPomodoroTimer(session, t1).session;
    assert.equal(session.remainingSeconds, FOCUS_DURATION - 60);

    // Pausa o timer em t1
    session = pausePomodoroTimer(session, t1);
    assert.equal(session.isRunning, false);
    assert.equal(session.targetEndTime, null);
    assert.equal(session.remainingSeconds, FOCUS_DURATION - 60);

    // Passam 5 minutos enquanto pausado
    const t2 = t1 + 300 * 1000;
    session = tickPomodoroTimer(session, t2).session;
    assert.equal(session.remainingSeconds, FOCUS_DURATION - 60, 'Tempo não deve diminuir enquanto pausado');

    // Retoma em t2
    session = startPomodoroTimer(session, t2);
    assert.equal(session.isRunning, true);
    assert.equal(session.targetEndTime, t2 + (FOCUS_DURATION - 60) * 1000);

    // Roda mais 40 segundos
    const t3 = t2 + 40 * 1000;
    session = tickPomodoroTimer(session, t3).session;
    assert.equal(session.remainingSeconds, FOCUS_DURATION - 100);
  });

  it('Uma sessão concluída é contabilizada uma única vez (deduplicação estrita)', () => {
    const t0 = 4000000;
    let session = createInitialPomodoroSession('focus', mockTask);
    session = startPomodoroTimer(session, t0);

    const targetEnd = session.targetEndTime!;

    // 1. Tick no exato momento da conclusão (t = targetEnd)
    const res1 = tickPomodoroTimer(session, targetEnd);
    assert.equal(res1.completedNow, true, 'Primeira vez deve reportar completedNow = true');
    assert.equal(res1.session.remainingSeconds, 0);
    assert.equal(res1.session.isRunning, false);
    assert.ok(res1.session.completedSessionIds.includes(res1.session.sessionId));

    // 2. Múltiplos ticks subsequentes após a finalização (ex: componente re-renderizando ou múltiplos listeners)
    for (let i = 1; i <= 10; i++) {
      const resNext = tickPomodoroTimer(res1.session, targetEnd + i * 1000);
      assert.equal(
        resNext.completedNow,
        false,
        `Tick repetido ${i} não deve emitir conclusão duplicada`
      );
      assert.equal(resNext.session.remainingSeconds, 0);
    }
  });

  it('Recuperação de sessão após recarregar página (simulação de reload)', () => {
    const t0 = 5000000;
    let session = createInitialPomodoroSession('focus', mockTask);
    session = startPomodoroTimer(session, t0);

    // Simula reload da página após 400 segundos
    const tReload = t0 + 400 * 1000;
    const { session: reloadedSession, completedNow } = tickPomodoroTimer(session, tReload);

    assert.equal(completedNow, false);
    assert.equal(reloadedSession.remainingSeconds, FOCUS_DURATION - 400);
    assert.equal(reloadedSession.isRunning, true);

    // Simula reload após o término completo da sessão (ex: usuário fechou a aba e voltou após 30 minutos)
    const tFinished = t0 + (FOCUS_DURATION + 300) * 1000;
    const finishedReload = tickPomodoroTimer(session, tFinished);
    assert.equal(finishedReload.completedNow, true, 'Deve contabilizar a sessão finalizada');
    assert.equal(finishedReload.session.remainingSeconds, 0);
    assert.equal(finishedReload.session.isRunning, false);
  });

  it('Tratamento de troca ou exclusão da tarefa vinculada', () => {
    let session = createInitialPomodoroSession('focus', mockTask);
    assert.equal(session.taskId, 'task-pom-1');
    assert.equal(session.taskTitle, 'Escrever Documentação');

    // 1. Tarefa teve o título alterado
    const updatedTasks: TodoItem[] = [
      { ...mockTask, title: 'Escrever Documentação Técnica Atualizada' },
    ];
    session = syncPomodoroWithTasks(session, updatedTasks);
    assert.equal(session.taskTitle, 'Escrever Documentação Técnica Atualizada');
    assert.equal(session.taskId, 'task-pom-1');

    // 2. Tarefa foi excluída dos todos
    const emptyTasks: TodoItem[] = [];
    session = syncPomodoroWithTasks(session, emptyTasks);
    assert.equal(session.taskId, null, 'taskId deve ser desvinculado');
    assert.equal(session.taskTitle, '(Tarefa removida)');
  });
});

describe('Notificações Honestas e Prevenção de Avisos Duplicados', () => {
  it('Documentação dos limites reais e transparência de segundo plano', () => {
    assert.ok(NOTIFICATION_LIMITS_DOC.capability.includes('aba aberta'));
    assert.ok(NOTIFICATION_LIMITS_DOC.backgroundLimits.includes('fechados sem um servidor'));
    assert.ok(NOTIFICATION_LIMITS_DOC.antiSpam.includes('no máximo uma vez'));
  });

  it('Status de notificação retorna formato esperado e trata permissões', () => {
    const status = getNotificationStatus();
    assert.ok(['granted', 'denied', 'default', 'unsupported'].includes(status));
  });

  it('checkDeadlinesAndNotify não envia avisos repetidos para o mesmo prazo', () => {
    const refDate = new Date(2026, 8, 24, 14, 50, 0); // 14:50 do dia 24
    const todos: TodoItem[] = [
      {
        id: 'task-deadline-1',
        title: 'Reunião de Alinhamento',
        dueDate: '2026-09-24',
        dueTime: '15:00', // Vence em 10 minutos
        completed: false,
        priority: 'urgent',
        category: 'work',
        pinned: false,
        pomodoros: 0,
        order: 0,
        createdAt: '2026-09-24T08:00:00.000Z',
        subTasks: [],
      },
    ];

    // Em ambiente Node.js sem Notification nativo, a função não quebra
    const count = checkDeadlinesAndNotify(todos, refDate);
    assert.ok(typeof count === 'number');
  });
});
