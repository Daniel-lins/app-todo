# 🚀 AppToDo - Gestor de Produtividade & Tarefas

Aplicação web moderna para organização de tarefas diárias com visualizações em **Lista** e **Quadro Kanban**, **Timer Pomodoro** desacoplado, colaboração em **Grupos Compartilhados**, **Sincronização em Nuvem via Supabase** com tolerância offline e **Acessibilidade WCAG**.

---

## 📋 Recursos Implementados e Realidade do Produto

O **AppToDo** foi consolidado com foco em consistência, regras estritas de domínio e transparência técnica sobre as capacidades reais da aplicação.

### 1. Gestão de Tarefas (Lista & Kanban)
- **Modos de Exibição**: Alternância instantânea entre Lista e Kanban (atalho `K`).
- **Kanban Funcional**: Colunas *A Fazer*, *Em Andamento* e *Concluídas*, com suporte a arrastar e soltar (drag & drop) e botões rápidos de avanço/recuo acessíveis por teclado ou telas sensíveis ao toque.
- **Subtarefas com Regras de Domínio**:
  - Concluir todas as subtarefas transiciona automaticamente a tarefa mãe para concluída.
  - Reabrir uma subtarefa em uma tarefa concluída reabre a mãe para *Em Andamento*.
  - Limpeza e remoção segura de subtarefas persistidas no banco e no armazenamento local.
- **Captura Rápida & Modal Detalhado**:
  - Campo de captura rápida no topo para inclusão imediata apenas com o título.
  - Modal expansível com detalhes opcionais (descrição, prioridade, categoria, data e horário limite, fixação no topo e subtarefas) e rodapé fixo (*sticky*) para salvar sem rolagem excessiva.
- **Datas com Fuso Local**: Cálculos de "Hoje" e "Atrasada" baseados no fuso horário do dispositivo do usuário (sem distorções causadas por conversões em UTC).
- **Ordenação**: Classificação em memória por Prioridade, Data de Vencimento, Ordem Alfabética ou Criação Recente.
  - *Limitação*: A reordenação manual por arrastar dentro da mesma coluna é uma ação visual em memória e não é persistida como ordem customizada no banco de dados.

### 2. Timer Pomodoro Desacoplado
- **Durações Fixas do Método Oficial**: 25 minutos de Foco e 5 minutos de Pausa Curta.
  - *Transparência e Limitações*: O timer não possui pausas longas de 15 minutos, configurações personalizadas de tempo nem sons ambientes integrados.
- **Contagem por Horário Absoluto**: O temporizador calcula o tempo restante a partir da diferença entre o horário atual (`Date.now()`) e o horário de término planejado, garantindo precisão mesmo que o navegador congele temporizadores em segundo plano.
- **Controle Compacto Flutuante**: O timer continua rodando ao fechar o modal, permitindo acompanhar e pausar através de um widget no canto da tela.
- **Registro Único por Ciclo**: Cada ciclo concluído é contabilizado uma única vez (evita contagens duplicadas em recargas ou oscilações de abas).
- **Vínculo com Tarefas**: Ao finalizar um ciclo de foco associado a uma tarefa, o contador de pomodoros da tarefa e o tempo de foco do perfil são atualizados.
- **Feedback Sensorial Acessível**: Beep sonoro sintetizado via Web Audio API (com liberação de recursos) e efeito de celebração respeitando a preferência do sistema por movimento reduzido (`prefers-reduced-motion`).

### 3. Notificações no Navegador
- **Avisos com o App Aberto**:
  - Notificação de início de pausa ou foco do Pomodoro.
  - Verificação periódica honesta de prazos (tarefas com prazo para o dia ou atrasadas).
- *Limitação Técnica Transparente*: As notificações operam através da Web Notifications API do navegador enquanto o aplicativo estiver aberto em uma aba. O AppToDo **não** envia notificações push em segundo plano quando a página ou o navegador estiverem totalmente fechados.

### 4. Funcionamento Local, Offline e Nuvem
- **Modo Visitante (Guest)**: Uso imediato sem cadastro, com dados salvos no `localStorage` do navegador.
- **Migração Transparente**: Ao criar uma conta ou fazer login, as tarefas criadas como visitante são sincronizadas com o perfil na nuvem.
- **Fila Offline com Resiliência**:
  - Quando a conexão com a nuvem falha, as alterações são salvas localmente e enfileiradas (`enqueueSyncItem`).
  - Indicadores visuais claros em cada tarefa: *Salvo localmente*, *Sincronizando*, *Sincronizado* e *Não sincronizado (erro)*.
  - Botão "Tentar novamente" na barra de status para reprocessar a fila sem duplicar itens.
  - Isolamento estrito entre espaços: operações no espaço pessoal não afetam grupos compartilhados e vice-versa.

### 5. Colaboração em Grupos
- **Criação e Gestão**: Crie grupos com cores e descrições personalizadas.
- **Código de Convite**: Entrada por código alfanumérico seguro de 6 caracteres (normalização com caixa alta e remoção de espaços).
- **Atualização em Tempo Real**: Canal Supabase Realtime isolado apenas para o espaço ativo, garantindo limpeza da assinatura anterior na troca de grupos para evitar conexões órfãs ou dados duplicados.
- **Segurança e RLS**: Políticas de segurança a nível de linha (*Row Level Security*) garantem que apenas membros do grupo possam visualizar ou editar tarefas do grupo.

### 6. Recuperação de Senha Segura
- **Fluxo Completo**: Rota `/auth/reset-password` dedicada para redefinição.
- **Suporte Duplo**: Aceita links de recuperação com troca de código PKCE e fragmentos de hash com token.
- **Segurança de Redirecionamento**: Redirecionamentos estritamente restritos a rotas internas relativas (previne ataques de *Open Redirect*).
- **Validação de Interface**: Exigência de senha forte (mínimo 6 caracteres), confirmação idêntica, mensagens traduzidas para português e caminho direto para solicitar um novo link caso o atual tenha expirado.

### 7. Backup e Restauração
- **Formato Versionado V2**: Arquivos JSON estruturados com versão, data de exportação e metadados de contexto (omite senhas ou credenciais).
- **Validação Estrita**: Verificação profunda de cada item e subtarefa (tamanho, formato de data, enumerações de categoria e prioridade).
- **Prévia e Resolução de Conflitos**: Exibe quantidade de tarefas antes de aplicar e oferece escolha entre *Mesclar* (gera novos IDs para itens conflitantes) e *Substituir* (requer confirmação explícita).

### 8. Acessibilidade (WCAG 2.1 AA) & Design
- **Navegação por Teclado**: Criação, edição, movimentação no Kanban e conclusão de tarefas operáveis 100% via teclado.
- **Contenção de Foco (Focus Trap)**: Implementada em todos os modais através do hook `useAccessibleModal`, com devolução de foco ao elemento de origem e fechamento consistente por `Escape`.
- **Proteção Contra Atalhos**: Atalhos rápidos (`N`, `/`, `K`, `?`) são automaticamente suprimidos quando o usuário estiver digitando em campos de formulário ou se houver um modal aberto.
- **Temas Claro e Escuro Coerentes**: Compatível com Tailwind CSS v4, com persistência da preferência do usuário e acompanhamento da preferência do sistema operacional (`prefers-color-scheme`), prevenindo *Flash of Unstyled Content* (FOUC).

---

## 🛠️ Tecnologias

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/)
- **Estilização**: Tailwind CSS v4 & Tokens de Design em CSS puro
- **Nuvem & Auth**: [Supabase](https://supabase.com/) (PostgreSQL, RLS, Auth, Realtime)
- **Ícones**: [Lucide React](https://lucide.dev/)
- **Testes**: Node.js Test Runner Nativo (`node:test`, `node:assert/strict`)

---

## 🚀 Como Executar Localmente

### 1. Clonar e Instalar
```bash
git clone https://github.com/Daniel-lins/app-todo.git
cd app-todo
npm install
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz do projeto com as suas credenciais do Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima-publica
```

### 3. Configurar o Supabase e Migrações
No painel do seu projeto Supabase (ou via Supabase CLI), execute a migração SQL versionada localizada em:
```
supabase/migrations/20260924180000_group_collaboration_and_rls.sql
```
Esta migração provisiona:
- Tabelas: `profiles`, `groups`, `group_members`, `tasks` e `subtasks`.
- Triggers atômicos para inserção de membros proprietários.
- Função RPC `join_group_by_code` para validação e entrada em grupos por código de convite.
- Políticas de segurança RLS protegendo tarefas pessoais e de grupos.
- Publicação de Realtime para sincronização colaborativa.

**Configuração do Fluxo de Recuperação de Senha no Supabase**:
1. No painel do Supabase, acesse **Authentication -> URL Configuration**.
2. Adicione nas **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/reset-password`
   - *(E a URL do seu domínio de produção, caso publicado).*

### 4. Executar em Desenvolvimento
```bash
npm run dev
```
Acesse [http://localhost:3000](http://localhost:3000).

---

## 🧪 Como Testar e Validar

O projeto conta com suítes de testes automatizados com cobertura para os fluxos de maior risco da aplicação:

```bash
# Executa todas as suítes de testes unitários e de integração
npm test

# Executa a verificação estrita de linting (ESLint)
npm run lint

# Executa a verificação de tipos e compilação de produção
npm run build
```

### Principais Suítes Testadas:
- `themeConsolidation.test.ts`: Mecanismo de tema claro/escuro, persistência e prevenção de FOUC.
- `taskDomainRules.test.ts`: Transições de status, integridade de subtarefas e métricas.
- `uiHierarchyOptimization.test.ts`: Layout responsivo, resumo de produtividade e filtros.
- `accessibilityInteraction.test.ts`: Foco acessível, contraste WCAG e navegação por teclado.
- `backupImportExport.test.ts`: Validação de backups, mesclagem e resiliência offline.
- `authRecovery.test.ts`: Troca de código PKCE, tokens expirados e redirecionamentos seguros.
- `pomodoroNotifications.test.ts`: Cálculo do timer absoluto e transparência de avisos.
- `groupCollaboration.test.ts`: Entrada por código de convite, isolamento de grupos e sincronização.
- `supabaseErrorHandling.test.ts`: Recuperação contra falhas de rede e filas de sincronização.
