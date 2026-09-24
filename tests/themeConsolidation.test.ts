import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { 
  THEME_STORAGE_KEY, 
  THEME_INIT_SCRIPT, 
  getSavedTheme, 
  getSystemTheme, 
  getEffectiveTheme, 
  applyTheme, 
  clearExplicitTheme 
} from '../src/utils/theme';

test('Estratégia de Tema Compatível com Tailwind CSS v4', async (t) => {
  const globalsCssPath = path.join(process.cwd(), 'src/app/globals.css');
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');

  await t.test('@custom-variant dark está configurado para permitir controle por classe/seletor', () => {
    assert.ok(
      globalsCss.includes('@custom-variant dark (&:where(.dark, .dark *));'),
      'globals.css deve conter @custom-variant dark para Tailwind v4'
    );
  });

  await t.test('Fonte Geist está vinculada tanto no @theme quanto no body de globals.css', () => {
    assert.ok(
      globalsCss.includes('--font-sans: var(--font-geist-sans)'),
      'Tailwind v4 @theme deve mapear --font-sans para var(--font-geist-sans)'
    );
    assert.ok(
      globalsCss.includes('font-family: var(--font-geist-sans)'),
      'body deve utilizar var(--font-geist-sans) como fonte padrão principal'
    );
  });
});

test('Preferência Explícita Persistente vs Preferência do Sistema', async (t) => {
  // Simula ambiente de window / localStorage
  const mockStorage: Record<string, string> = {};
  let mockSystemDark = false;

  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalLocalStorage = globalThis.localStorage;

  interface MockRoot {
    classList: {
      add: (c: string) => void;
      remove: (c: string) => void;
      toggle: (c: string, force?: boolean) => void;
      has: (c: string) => boolean;
    };
    setAttribute: (k: string, v: string) => void;
    style: Record<string, string>;
  }

  interface TestGlobal {
    window?: {
      matchMedia: (query: string) => {
        matches: boolean;
        addEventListener: () => void;
        removeEventListener: () => void;
      };
    };
    localStorage?: {
      getItem: (key: string) => string | null;
      setItem: (key: string, val: string) => void;
      removeItem: (key: string) => void;
    };
    document?: {
      documentElement: MockRoot;
    };
  }

  const testGlobal = globalThis as unknown as TestGlobal;

  // Setup mock
  testGlobal.window = {
    matchMedia: (query: string) => ({
      matches: query.includes('prefers-color-scheme: dark') ? mockSystemDark : false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  };

  testGlobal.localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = val;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
  };

  const classListSet = new Set<string>();
  const attributes: Record<string, string> = {};
  const mockRoot: MockRoot = {
    classList: {
      add: (c: string) => { classListSet.add(c); },
      remove: (c: string) => { classListSet.delete(c); },
      toggle: (c: string, force?: boolean) => {
        if (force === undefined) {
          if (classListSet.has(c)) classListSet.delete(c);
          else classListSet.add(c);
        } else if (force) {
          classListSet.add(c);
        } else {
          classListSet.delete(c);
        }
      },
      has: (c: string) => classListSet.has(c),
    },
    setAttribute: (k: string, v: string) => {
      attributes[k] = v;
    },
    style: {},
  };

  testGlobal.document = {
    documentElement: mockRoot,
  };

  await t.test('Sem escolha explícita, recorre à preferência do sistema (light)', () => {
    delete mockStorage[THEME_STORAGE_KEY];
    mockSystemDark = false;
    assert.equal(getSavedTheme(), null);
    assert.equal(getSystemTheme(), 'light');
    assert.equal(getEffectiveTheme(), 'light');
  });

  await t.test('Sem escolha explícita, recorre à preferência do sistema (dark)', () => {
    delete mockStorage[THEME_STORAGE_KEY];
    mockSystemDark = true;
    assert.equal(getSavedTheme(), null);
    assert.equal(getSystemTheme(), 'dark');
    assert.equal(getEffectiveTheme(), 'dark');
  });

  await t.test('Escolha explícita do usuário sobrepõe a preferência do sistema', () => {
    mockSystemDark = true; // Sistema está em dark
    applyTheme('light', true); // Usuário força light
    assert.equal(mockStorage[THEME_STORAGE_KEY], 'light');
    assert.equal(getEffectiveTheme(), 'light', 'Deve respeitar o light explícito mesmo com sistema dark');
    assert.equal(classListSet.has('dark'), false);
    assert.equal(attributes['data-theme'], 'light');

    mockSystemDark = false; // Sistema está em light
    applyTheme('dark', true); // Usuário força dark
    assert.equal(mockStorage[THEME_STORAGE_KEY], 'dark');
    assert.equal(getEffectiveTheme(), 'dark', 'Deve respeitar o dark explícito mesmo com sistema light');
    assert.equal(classListSet.has('dark'), true);
    assert.equal(attributes['data-theme'], 'dark');
  });

  await t.test('Limpar preferência explícita restaura acompanhamento do sistema', () => {
    mockSystemDark = false;
    clearExplicitTheme();
    assert.equal(mockStorage[THEME_STORAGE_KEY], undefined);
    assert.equal(getEffectiveTheme(), 'light');
    assert.equal(classListSet.has('dark'), false);
  });

  // Cleanup
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
  globalThis.localStorage = originalLocalStorage;
});

test('Prevenção de FOUC e Injeção do Script Inicial no Layout', async (t) => {
  const layoutPath = path.join(process.cwd(), 'src/app/layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');

  await t.test('Script THEME_INIT_SCRIPT é injetado no <head> do layout', () => {
    assert.ok(layoutContent.includes('THEME_INIT_SCRIPT'), 'layout.tsx deve incluir THEME_INIT_SCRIPT');
    assert.ok(layoutContent.includes('dangerouslySetInnerHTML'), 'Deve executar de forma inline para evitar flash');
  });

  await t.test('Elemento html contém suppressHydrationWarning', () => {
    assert.ok(layoutContent.includes('suppressHydrationWarning'), 'html deve conter suppressHydrationWarning');
  });

  await t.test('THEME_INIT_SCRIPT trata erros de acesso a localStorage silenciosamente', () => {
    assert.ok(THEME_INIT_SCRIPT.includes('try {'));
    assert.ok(THEME_INIT_SCRIPT.includes('catch(e)'));
  });
});

test('Tokens de Superfície, Bordas, Texto e Foco nos Dois Temas', async (t) => {
  const globalsCss = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');

  await t.test('Tokens de design estão presentes para :root e .dark', () => {
    const requiredTokens = [
      '--surface-page',
      '--surface-card',
      '--surface-subtle',
      '--text-primary',
      '--text-secondary',
      '--border-subtle',
      '--focus-ring',
    ];

    for (const token of requiredTokens) {
      assert.ok(globalsCss.includes(token), `globals.css deve definir ${token}`);
    }
  });

  await t.test('Foco acessível possui contorno de 2px com offset configurado', () => {
    assert.ok(globalsCss.includes(':focus-visible'));
    assert.ok(globalsCss.includes('outline: 2px solid'));
    assert.ok(globalsCss.includes('outline-offset: 2px'));
  });
});

test('Consistência de Datas e Rótulos entre Lista (TaskCard) e Kanban (KanbanBoard)', async (t) => {
  const taskCardPath = path.join(process.cwd(), 'src/components/TaskCard.tsx');
  const kanbanPath = path.join(process.cwd(), 'src/components/KanbanBoard.tsx');

  const taskCardContent = fs.readFileSync(taskCardPath, 'utf8');
  const kanbanContent = fs.readFileSync(kanbanPath, 'utf8');

  await t.test('Ambos utilizam as mesmas mensagens de sincronização', () => {
    const syncLabels = ['Não sincronizado', 'Salvo localmente', 'Sincronizando'];
    for (const label of syncLabels) {
      assert.ok(taskCardContent.includes(label), `TaskCard deve conter "${label}"`);
      assert.ok(kanbanContent.includes(label), `KanbanBoard deve conter "${label}"`);
    }
  });

  await t.test('Ambos tratam e formatam datas com fuso local (isOverdueLocal e isTodayLocal)', () => {
    assert.ok(taskCardContent.includes('isOverdueLocal'));
    assert.ok(taskCardContent.includes('isTodayLocal'));
    assert.ok(kanbanContent.includes('isOverdueLocal'));
    assert.ok(kanbanContent.includes('isTodayLocal'));
  });

  await t.test('Ambos formatam "Atrasada: " e "Hoje" de forma idêntica', () => {
    assert.ok(taskCardContent.includes("isOverdue ? 'Atrasada: ' : isToday ? 'Hoje' : ''"));
    assert.ok(kanbanContent.includes("isOverdue ? 'Atrasada: ' : isToday ? 'Hoje' : ''"));
  });
});

test('Textos Voltados ao Usuário sem Supabase/PostgreSQL Desnecessários', async (t) => {
  const profileModalContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/ProfileModal.tsx'),
    'utf8'
  );
  const authModalContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/AuthModal.tsx'),
    'utf8'
  );
  const pageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/page.tsx'),
    'utf8'
  );

  await t.test('ProfileModal não exibe "Supabase" no rótulo da conta', () => {
    assert.ok(!profileModalContent.includes('Conta sincronizada no Supabase'));
    assert.ok(profileModalContent.includes('Conta sincronizada na nuvem'));
  });

  await t.test('AuthModal não menciona "Supabase PostgreSQL" para o usuário', () => {
    assert.ok(!authModalContent.includes('Supabase PostgreSQL'));
    assert.ok(authModalContent.includes('sincronizados com a sua conta na nuvem'));
  });

  await t.test('page.tsx usa títulos amigáveis e não expõe Supabase em mensagens de falha', () => {
    assert.ok(!pageContent.includes('Conectar à Nuvem Supabase'));
    assert.ok(pageContent.includes('Conectar à sua conta na nuvem'));
    assert.ok(!pageContent.includes('Não foi possível salvar alterações no Supabase.'));
    assert.ok(pageContent.includes('Não foi possível salvar alterações na nuvem.'));
  });
});
