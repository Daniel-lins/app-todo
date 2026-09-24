/**
 * Utilitários de data e fuso horário para tarefas e métricas.
 * Garante que todas as verificações de 'Hoje' e prazos respeitem o fuso local do usuário.
 */

/**
 * Retorna a data no formato YYYY-MM-DD com base no horário LOCAL do usuário.
 * Corrige o bug de fusos (ex: no Brasil UTC-3, após as 21h o UTC já vira o dia seguinte).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retorna a data local de um carimbo ISO ou string de data.
 */
export function parseDateToLocalString(isoOrDateStr?: string | null): string | null {
  if (!isoOrDateStr) return null;
  // Se já estiver no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDateStr)) {
    return isoOrDateStr;
  }
  const d = new Date(isoOrDateStr);
  if (isNaN(d.getTime())) return null;
  return getLocalDateString(d);
}

/**
 * Verifica se uma data YYYY-MM-DD corresponde ao dia de hoje no fuso local.
 */
export function isTodayLocal(dateStr?: string | null, referenceDate: Date = new Date()): boolean {
  if (!dateStr) return false;
  const todayStr = getLocalDateString(referenceDate);
  // Se for timestamp ISO ou YYYY-MM-DD
  const cleanDate = dateStr.includes('T') ? parseDateToLocalString(dateStr) : dateStr;
  return cleanDate === todayStr;
}

/**
 * Verifica se uma data YYYY-MM-DD é estritamente anterior a hoje no fuso local (atrasada).
 */
export function isOverdueLocal(dateStr?: string | null, referenceDate: Date = new Date()): boolean {
  if (!dateStr) return false;
  const todayStr = getLocalDateString(referenceDate);
  const cleanDate = dateStr.includes('T') ? parseDateToLocalString(dateStr) : dateStr;
  if (!cleanDate) return false;
  return cleanDate < todayStr;
}

/**
 * Retorna os milissegundos restantes até a próxima meia-noite local.
 * Usado para recomputar indicadores automaticamente quando o dia vira.
 */
export function getMsUntilNextMidnight(now: Date = new Date()): number {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    500
  );
  return Math.max(1000, nextMidnight.getTime() - now.getTime());
}
