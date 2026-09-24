import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSafeRedirectUrl,
  validateNewPassword,
  validatePasswordConfirmation,
  translateAuthError,
} from '../src/utils/authUtils';

describe('Fluxo de Recuperação de Senha: Validação e Segurança', () => {
  it('Proteção contra Open Redirect: Aceita apenas caminhos internos permitidos', () => {
    // Caminhos internos válidos
    assert.equal(getSafeRedirectUrl('/auth/reset-password'), '/auth/reset-password');
    assert.equal(getSafeRedirectUrl('/'), '/');
    assert.equal(getSafeRedirectUrl('/dashboard'), '/dashboard');
    assert.equal(getSafeRedirectUrl('/auth/reset-password?step=2'), '/auth/reset-password?step=2');

    // Tentativas maliciosas de redirecionamento aberto (CWE-601)
    assert.equal(getSafeRedirectUrl('https://evil.com', '/'), '/');
    assert.equal(getSafeRedirectUrl('http://attacker.org', '/'), '/');
    assert.equal(getSafeRedirectUrl('//evil.com', '/'), '/');
    assert.equal(getSafeRedirectUrl('/\\evil.com', '/'), '/');
    assert.equal(getSafeRedirectUrl('javascript:alert(1)', '/'), '/');
    assert.equal(getSafeRedirectUrl('data:text/html,evil', '/'), '/');
    assert.equal(getSafeRedirectUrl('', '/fallback'), '/fallback');
    assert.equal(getSafeRedirectUrl(null, '/fallback'), '/fallback');
    assert.equal(getSafeRedirectUrl(undefined, '/auth/reset-password'), '/auth/reset-password');
    assert.equal(getSafeRedirectUrl('   ', '/'), '/');
    assert.equal(getSafeRedirectUrl('/path\nwith\rnewline', '/'), '/');
  });

  it('Validação da política de senha: Mínimo 6 caracteres', () => {
    // Vazio
    const emptyRes = validateNewPassword('');
    assert.equal(emptyRes.valid, false);
    assert.ok(emptyRes.message?.includes('informe uma nova senha'));

    // Menor que 6 caracteres
    const shortRes = validateNewPassword('12345');
    assert.equal(shortRes.valid, false);
    assert.ok(shortRes.message?.includes('no mínimo 6 caracteres'));

    // 6 caracteres ou mais
    const validRes = validateNewPassword('123456');
    assert.equal(validRes.valid, true);
    assert.equal(validRes.message, undefined);

    const strongRes = validateNewPassword('SenhaForte@2026!');
    assert.equal(strongRes.valid, true);
  });

  it('Validação de confirmação de senha', () => {
    // Senhas diferentes
    const diffRes = validatePasswordConfirmation('minhasenha123', 'outrasenha123');
    assert.equal(diffRes.valid, false);
    assert.ok(diffRes.message?.includes('não coincidem'));

    // Confirmação vazia
    const emptyConfirm = validatePasswordConfirmation('minhasenha123', '');
    assert.equal(emptyConfirm.valid, false);
    assert.ok(emptyConfirm.message?.includes('confirme a nova senha'));

    // Senha base inválida (curta) com confirmação
    const shortWithConfirm = validatePasswordConfirmation('123', '123');
    assert.equal(shortWithConfirm.valid, false);
    assert.ok(shortWithConfirm.message?.includes('no mínimo 6 caracteres'));

    // Válido e idêntico
    const successRes = validatePasswordConfirmation('NovaSenha@2026', 'NovaSenha@2026');
    assert.equal(successRes.valid, true);
  });

  it('Tradução de erros do Supabase Auth para português compreensível', () => {
    // Link expirado / OTP inválido
    const expErr1 = translateAuthError(new Error('Email link is invalid or has expired'));
    assert.ok(expErr1.includes('inválido ou expirou'));

    const expErr2 = translateAuthError({ message: 'otp_expired' });
    assert.ok(expErr2.includes('inválido ou expirou'));

    // Nova senha idêntica à anterior
    const samePwdErr = translateAuthError(
      new Error('New password should be different from the old password')
    );
    assert.ok(samePwdErr.includes('diferente da senha utilizada anteriormente'));

    // Senha curta
    const shortErr = translateAuthError(
      new Error('Password should be at least 6 characters')
    );
    assert.ok(shortErr.includes('pelo menos 6 caracteres'));

    // Sessão ausente
    const sessionErr = translateAuthError(new Error('Auth session missing!'));
    assert.ok(sessionErr.includes('Sessão de recuperação não encontrada'));

    // Limite de taxa (rate limit)
    const rateErr = translateAuthError(new Error('Too many requests / rate limit exceeded'));
    assert.ok(rateErr.includes('Muitas tentativas'));
  });
});

describe('Fluxo do Callback de Autenticação e Estados de Erro', () => {
  // Mock do cliente Supabase para testar o comportamento da rota sem requisições de rede reais
  interface MockAuthResponse {
    error: { message: string } | null;
  }

  class MockSupabaseAuth {
    private exchangeResponse: MockAuthResponse;
    private verifyOtpResponse: MockAuthResponse;
    private updatePasswordResponse: MockAuthResponse;

    constructor(
      exchangeResponse: MockAuthResponse = { error: null },
      verifyOtpResponse: MockAuthResponse = { error: null },
      updatePasswordResponse: MockAuthResponse = { error: null }
    ) {
      this.exchangeResponse = exchangeResponse;
      this.verifyOtpResponse = verifyOtpResponse;
      this.updatePasswordResponse = updatePasswordResponse;
    }

    async exchangeCodeForSession(..._args: unknown[]): Promise<MockAuthResponse> {
      void _args;
      return this.exchangeResponse;
    }

    async verifyOtp(..._args: unknown[]): Promise<MockAuthResponse> {
      void _args;
      return this.verifyOtpResponse;
    }

    async updateUser(..._args: unknown[]): Promise<MockAuthResponse> {
      void _args;
      return this.updatePasswordResponse;
    }
  }

  it('Link válido: Troca de código PKCE bem-sucedida autoriza o destino seguro', async () => {
    const mockAuth = new MockSupabaseAuth({ error: null });
    const result = await mockAuth.exchangeCodeForSession('valid-pkce-code-123');

    assert.equal(result.error, null);
    const target = getSafeRedirectUrl('/auth/reset-password', '/');
    assert.equal(target, '/auth/reset-password');
  });

  it('Link inválido ou expirado: Falha na troca de código é tratada com erro explícito', async () => {
    const mockAuth = new MockSupabaseAuth({
      error: { message: 'Token has expired or is invalid' },
    });

    const result = await mockAuth.exchangeCodeForSession('expired-code-xyz');
    assert.notEqual(result.error, null);
    assert.equal(result.error?.message, 'Token has expired or is invalid');

    // Tradução e mensagem de erro direcionada
    const friendlyMessage = translateAuthError(result.error);
    assert.ok(friendlyMessage.includes('inválido ou expirou'));
  });

  it('Link via verifyOtp com token_hash expirado ou inválido', async () => {
    const mockAuth = new MockSupabaseAuth(
      { error: null },
      { error: { message: 'Email link is invalid or has expired' } }
    );

    const result = await mockAuth.verifyOtp({ token_hash: 'bad-hash', type: 'recovery' });
    assert.notEqual(result.error, null);
    assert.ok(translateAuthError(result.error).includes('inválido ou expirou'));
  });

  it('Erro ao atualizar senha no Supabase é capturado e traduzido', async () => {
    const mockAuth = new MockSupabaseAuth(
      { error: null },
      { error: null },
      { error: { message: 'New password should be different from the old password' } }
    );

    const updateRes = await mockAuth.updateUser({ password: 'Password123!' });
    assert.notEqual(updateRes.error, null);
    const msg = translateAuthError(updateRes.error);
    assert.equal(msg, 'A nova senha deve ser diferente da senha utilizada anteriormente.');
  });

  it('Atualização bem-sucedida da senha permite redirecionamento final seguro', async () => {
    const mockAuth = new MockSupabaseAuth(
      { error: null },
      { error: null },
      { error: null }
    );

    const updateRes = await mockAuth.updateUser({ password: 'SenhaSegura@2026' });
    assert.equal(updateRes.error, null);

    // Redirecionamento após sucesso
    const finalDestination = getSafeRedirectUrl(null, '/');
    assert.equal(finalDestination, '/');
  });
});
