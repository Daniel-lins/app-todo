# 🚀 AppToDo - Gestor Produtivo de Tarefas & Pomodoro

Um aplicativo moderno e fluido de produtividade e gestão de tarefas no estilo **Kanban**, integrado com **Timer Pomodoro**, efeitos visuais dinâmicos e sincronização em tempo real com **Supabase (PostgreSQL)**.

---

## ✨ Funcionalidades Principais

- 📋 **Quadro Kanban Interativo**: Organize tarefas por colunas (*A Fazer*, *Em Andamento*, *Concluídas*) com drag-and-drop e reordenação intuitiva.
- ⏱️ **Timer Pomodoro Integrado**: Foco ajustável (25min / 5min / 15min) com sons ambientes e celebração com confetes ao concluir ciclos.
- ☁️ **Sincronização com Nuvem (Supabase)**: Backup seguro de tarefas, categorias e histórico de pomodoro na nuvem, com fallback offline local.
- 🎨 **Design Moderno & Temas**: Interface refinada com suporte a Modo Escuro / Claro, glassmorphism e animações suaves.
- 🏷️ **Categorias & Prioridades**: Filtre por tags personalizadas, níveis de prioridade (Baixa, Média, Alta, Urgente) e data limite.
- ⚡ **Atalhos de Teclado**: Atalhos para adicionar tarefas, alternar visualizações e controlar o timer com agilidade.

---

## 🛠️ Tecnologias Utilizadas

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/)
- **Estilização**: Tailwind CSS & Design Tokens modernos
- **Banco de Dados & Autenticação**: [Supabase](https://supabase.com/)
- **Ícones**: [Lucide React](https://lucide.dev/)
- **Efeitos**: Canvas-Confetti

---

## 🚀 Como Executar Localmente

1. Clone o repositório:
```bash
git clone https://github.com/Daniel-lins/app-todo.git
cd app-todo
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente no arquivo `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_supabase
```

4. Execute o servidor de desenvolvimento:
```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no seu navegador.
