export const triggerConfetti = async () => {
  if (typeof window === 'undefined') return;
  // Respeito a usuários com preferência de movimento reduzido
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  try {
    const confetti = (await import('canvas-confetti')).default;
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#10b981'],
    });
  } catch {
    // Graceful fallback if confetti fails to load
  }
};
