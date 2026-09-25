/**
 * Utilitários de geração, normalização e validação de códigos de convite para grupos.
 */

// Conjunto de caracteres legíveis e não ambíguos (remove 0, O, 1, I, L)
const UNAMBIGUOUS_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Gera um código de convite padronizado e seguro (ex: TODO-8K9X2M).
 * 32^6 = mais de 1 bilhão de combinações possíveis.
 */
export function generateInviteCode(length = 6): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % UNAMBIGUOUS_CHARS.length;
    result += UNAMBIGUOUS_CHARS.charAt(randomIndex);
  }
  return `TODO-${result}`;
}

/**
 * Normaliza o código de convite inserido pelo usuário:
 * - Remove espaços em branco
 * - Converte para maiúsculas
 * - Substitui caracteres ambíguos comuns (0 -> O, 1 -> I, l -> I)
 * - Adiciona o prefixo TODO- caso o usuário tenha digitado apenas o sufixo.
 */
export function normalizeInviteCode(rawInput: string): string {
  if (!rawInput) return '';

  let cleaned = rawInput.trim().toUpperCase();

  // Se o usuário digitou sem prefixo TODO-, adiciona automaticamente
  if (!cleaned.startsWith('TODO-')) {
    // Se digitou com outro separador ou apenas o código
    cleaned = cleaned.replace(/^TODO[:_\s]*/, '');
    cleaned = `TODO-${cleaned}`;
  }

  // Remove caracteres que não pertencem ao padrão
  const parts = cleaned.split('-');
  const prefix = parts[0];
  const suffix = (parts.slice(1).join('')).replace(/[^A-Z0-9]/g, '');

  return `${prefix}-${suffix}`;
}

/**
 * Valida se um código de convite atende ao formato esperado.
 */
export function isValidInviteCodeFormat(code: string): boolean {
  if (!code) return false;
  const normalized = normalizeInviteCode(code);
  // Prefixo TODO- seguido de 4 a 10 caracteres alfanuméricos
  return /^TODO-[A-Z0-9]{4,10}$/.test(normalized);
}
