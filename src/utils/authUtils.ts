/**
 * Utilitários de autenticação, segurança de redirecionamento,
 * validação de política de senha e tradução de mensagens.
 */

/**
 * Valida e sanitiza uma URL de redirecionamento para garantir que seja
 * estritamente um destino interno seguro no mesmo domínio.
 * Previne vulnerabilidades de Open Redirect (CWE-601).
 */
export function getSafeRedirectUrl(
  target: string | null | undefined,
  fallback = '/'
): string {
  if (!target || typeof target !== 'string') {
    return fallback;
  }

  const trimmed = target.trim();

  // Rejeita strings vazias
  if (!trimmed) {
    return fallback;
  }

  // Deve iniciar obrigatoriamente com '/'
  if (!trimmed.startsWith('/')) {
    return fallback;
  }

  // Previne '//' (protocol-relative URLs como //evil.com)
  if (trimmed.startsWith('//')) {
    return fallback;
  }

  // Previne '/\' (truques de parser em alguns navegadores/servidores)
  if (trimmed.startsWith('/\\')) {
    return fallback;
  }

  // Previne caracteres de controle ou CRLF
  if (/[\r\n\t]/.test(trimmed)) {
    return fallback;
  }

  // Rejeita esquemas explícitos (javascript:, data:, http:, https:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}

/**
 * Valida uma nova senha com base na política de autenticação do Supabase (mínimo de 6 caracteres).
 */
export function validateNewPassword(password: string): {
  valid: boolean;
  message?: string;
} {
  if (!password) {
    return { valid: false, message: 'Por favor, informe uma nova senha.' };
  }

  if (password.length < 6) {
    return {
      valid: false,
      message: 'A senha deve conter no mínimo 6 caracteres.',
    };
  }

  return { valid: true };
}

/**
 * Valida a confirmação da nova senha.
 */
export function validatePasswordConfirmation(
  password: string,
  confirmation: string
): {
  valid: boolean;
  message?: string;
} {
  const baseValidation = validateNewPassword(password);
  if (!baseValidation.valid) {
    return baseValidation;
  }

  if (!confirmation) {
    return { valid: false, message: 'Por favor, confirme a nova senha.' };
  }

  if (password !== confirmation) {
    return { valid: false, message: 'As senhas informadas não coincidem.' };
  }

  return { valid: true };
}

/**
 * Traduz erros comuns do Supabase Auth para mensagens claras e compreensíveis em português.
 */
export function translateAuthError(error: unknown): string {
  if (!error) return 'Ocorreu um erro inesperado.';

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);

  const lower = message.toLowerCase();

  if (
    lower.includes('expired') ||
    lower.includes('otp_expired') ||
    lower.includes('token has expired') ||
    lower.includes('email link is invalid or has expired')
  ) {
    return 'O link de recuperação é inválido ou expirou. Por favor, solicite um novo link.';
  }

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_grant')
  ) {
    return 'Credenciais de acesso inválidas ou sessão expirada.';
  }

  if (lower.includes('password should be at least 6 characters')) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }

  if (lower.includes('new password should be different')) {
    return 'A nova senha deve ser diferente da senha utilizada anteriormente.';
  }

  if (
    lower.includes('auth session missing') ||
    lower.includes('session not found') ||
    lower.includes('user not found')
  ) {
    return 'Sessão de recuperação não encontrada. Por favor, solicite um novo link de redefinição.';
  }

  if (lower.includes('user already registered')) {
    return 'Este e-mail já está cadastrado no sistema.';
  }

  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns instantes antes de tentar novamente.';
  }

  return message;
}
