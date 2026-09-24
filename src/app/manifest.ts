import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AppToDo - Gestor de Tarefas & Pomodoro',
    short_name: 'AppToDo',
    description: 'Organize suas tarefas com agilidade, quadro Kanban e timer Pomodoro.',
    start_url: '/',
    display: 'standalone',
    background_color: '#090d16',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
