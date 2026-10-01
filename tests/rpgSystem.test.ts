import test from 'node:test';
import assert from 'node:assert/strict';
import { TodoItem } from '../src/types/todo';
import {
  calculateTaskXp,
  calculateLevelFromXp,
  calculateAttributeLevel,
  getTitleForLevel,
  getTaskCompletionReward,
  calculateRpgStats,
} from '../src/utils/rpgService';

test('Sistema RPG: Cálculo de XP por Tarefa e Bônus', async (t) => {
  await t.test('Tarefas sem subtarefas concedem o mesmo XP base sem incentivar urgência artificial', () => {
    const lowTask: TodoItem = {
      id: '1',
      title: 'Tarefa Baixa',
      completed: true,
      priority: 'low',
      category: 'work',
      pinned: false,
      subTasks: [],
      createdAt: '2026-10-01',
    };
    const medTask: TodoItem = { ...lowTask, priority: 'medium' };
    const highTask: TodoItem = { ...lowTask, priority: 'high' };
    const urgentTask: TodoItem = { ...lowTask, priority: 'urgent' };

    assert.equal(calculateTaskXp(lowTask).total, 30);
    assert.equal(calculateTaskXp(medTask).total, 30);
    assert.equal(calculateTaskXp(highTask).total, 30);
    assert.equal(calculateTaskXp(urgentTask).total, 30);
  });

  await t.test('Subtarefas concluídas e ciclos Pomodoro acrescentam bônus de XP', () => {
    const richTask: TodoItem = {
      id: '2',
      title: 'Tarefa Completa',
      completed: true,
      priority: 'high', // 30 XP
      category: 'study',
      pinned: false,
      subTasks: [
        { id: 's1', title: 'Sub 1', completed: true },  // +10
        { id: 's2', title: 'Sub 2', completed: true },  // +10
        { id: 's3', title: 'Sub 3', completed: false }, // 0
      ],
      pomodoros: 2, // 2 * 20 = +40
      createdAt: '2026-10-01',
    };

    const xp = calculateTaskXp(richTask);
    assert.equal(xp.base, 30);
    assert.equal(xp.subtasks, 20);
    assert.equal(xp.pomodoros, 40);
    assert.equal(xp.total, 90);
  });
});

test('Sistema RPG: Curva de Progressão e Níveis Gerais', async (t) => {
  await t.test('Nível 1 requer 100 XP para alcançar o Nível 2', () => {
    const p0 = calculateLevelFromXp(0);
    assert.equal(p0.level, 1);
    assert.equal(p0.currentLevelXp, 0);
    assert.equal(p0.nextLevelXp, 100);
    assert.equal(p0.progressPercent, 0);

    const p50 = calculateLevelFromXp(50);
    assert.equal(p50.level, 1);
    assert.equal(p50.currentLevelXp, 50);
    assert.equal(p50.progressPercent, 50);

    const p99 = calculateLevelFromXp(99);
    assert.equal(p99.level, 1);
    assert.equal(p99.currentLevelXp, 99);
    assert.equal(p99.progressPercent, 99);
  });

  await t.test('Nível 2 começa com 100 XP e requer 200 XP para o Nível 3 (total 300 XP)', () => {
    const p100 = calculateLevelFromXp(100);
    assert.equal(p100.level, 2);
    assert.equal(p100.currentLevelXp, 0);
    assert.equal(p100.nextLevelXp, 200);
    assert.equal(p100.progressPercent, 0);

    const p200 = calculateLevelFromXp(200);
    assert.equal(p200.level, 2);
    assert.equal(p200.currentLevelXp, 100);
    assert.equal(p200.progressPercent, 50);

    const p300 = calculateLevelFromXp(300);
    assert.equal(p300.level, 3);
    assert.equal(p300.currentLevelXp, 0);
    assert.equal(p300.nextLevelXp, 300);
  });

  await t.test('Níveis superiores e valores extremos não geram NaN nem travam', () => {
    const high = calculateLevelFromXp(10000);
    assert.ok(high.level > 10);
    assert.ok(high.progressPercent >= 0 && high.progressPercent <= 100);

    const negative = calculateLevelFromXp(-50);
    assert.equal(negative.level, 1);
    assert.equal(negative.progressPercent, 0);
  });
});

test('Sistema RPG: Títulos Honoríficos do Personagem', async (t) => {
  await t.test('Distribuição de títulos por faixa de nível', () => {
    assert.equal(getTitleForLevel(1), 'Aprendiz da Produtividade');
    assert.equal(getTitleForLevel(4), 'Aprendiz da Produtividade');
    assert.equal(getTitleForLevel(5), 'Aventureiro Focado');
    assert.equal(getTitleForLevel(10), 'Guardião da Rotina');
    assert.equal(getTitleForLevel(15), 'Estrategista Ágil');
    assert.equal(getTitleForLevel(20), 'Mestre da Execução');
    assert.equal(getTitleForLevel(30), 'Comandante de Alta Performance');
    assert.equal(getTitleForLevel(40), 'Lorde da Disciplina');
    assert.equal(getTitleForLevel(50), 'Arquimago da Vida');
    assert.equal(getTitleForLevel(100), 'Arquimago da Vida');
  });
});

test('Sistema RPG: Mapeamento de Áreas da Vida e Atributos', async (t) => {
  await t.test('Recompensas de conclusão mapeiam a área da vida correta', () => {
    const taskWork: TodoItem = {
      id: 'w1',
      title: 'Entregar relatório',
      completed: true,
      priority: 'high',
      category: 'work',
      pinned: false,
      subTasks: [],
      createdAt: '2026-10-01',
    };
    const taskHealth: TodoItem = { ...taskWork, category: 'health', priority: 'medium' };

    const rWork = getTaskCompletionReward(taskWork);
    assert.equal(rWork.areaName, 'Trabalho');
    assert.equal(rWork.attributeName, 'Execução & Foco');
    assert.equal(rWork.xp, 30);

    const rHealth = getTaskCompletionReward(taskHealth);
    assert.equal(rHealth.areaName, 'Saúde');
    assert.equal(rHealth.attributeName, 'Vitalidade & Energia');
    assert.equal(rHealth.xp, 30);
  });

  await t.test('Curva de nível de atributo progride em passos de 50 * L', () => {
    const a0 = calculateAttributeLevel(0);
    assert.equal(a0.level, 1);
    assert.equal(a0.currentLevelXp, 0);
    assert.equal(a0.nextLevelXp, 50);

    const a50 = calculateAttributeLevel(50);
    assert.equal(a50.level, 2);
    assert.equal(a50.currentLevelXp, 0);
    assert.equal(a50.nextLevelXp, 100);
  });
});

test('Sistema RPG: Consolidação Global e Avaliação de Conquistas (calculateRpgStats)', async (t) => {
  await t.test('Apenas tarefas concluídas concedem XP', () => {
    const tasks: TodoItem[] = [
      {
        id: 't1',
        title: 'Feita',
        completed: true,
        priority: 'high', // 30 XP
        category: 'work',
        pinned: false,
        subTasks: [],
        createdAt: '2026-10-01',
      },
      {
        id: 't2',
        title: 'Pendente',
        completed: false,
        priority: 'urgent', // 30 XP (não deve pontuar)
        category: 'work',
        pinned: false,
        subTasks: [],
        createdAt: '2026-10-01',
      },
    ];

    const stats = calculateRpgStats(tasks, 0);
    assert.equal(stats.tasksCompletedCount, 1);
    assert.equal(stats.totalXp, 30);
    assert.equal(stats.level, 1);
    assert.equal(stats.attributes.work.xp, 30);
    assert.equal(stats.attributes.study.xp, 0);
  });

  await t.test('Tarefas comuns distribuem XP sem produzir conquistas genéricas', () => {
    const tasks: TodoItem[] = [
      { id: '1', title: 'T1', completed: true, priority: 'medium', category: 'work', pinned: false, subTasks: [], createdAt: '' },
      { id: '2', title: 'T2', completed: true, priority: 'medium', category: 'study', pinned: false, subTasks: [], createdAt: '' },
      { id: '3', title: 'T3', completed: true, priority: 'medium', category: 'health', pinned: false, subTasks: [], createdAt: '' },
      { id: '4', title: 'T4', completed: true, priority: 'urgent', category: 'finance', pinned: false, subTasks: [
        { id: 's1', title: '1', completed: true },
        { id: 's2', title: '2', completed: true },
        { id: 's3', title: '3', completed: true },
      ], createdAt: '' },
    ];

    const stats = calculateRpgStats(tasks, 150);

    assert.equal(stats.badges.length, 0);
    assert.equal(stats.attributes.work.xp, 30);
    assert.equal(stats.attributes.study.xp, 30);
    assert.equal(stats.attributes.health.xp, 30);
    assert.equal(stats.attributes.finance.xp, 60);
  });
});
