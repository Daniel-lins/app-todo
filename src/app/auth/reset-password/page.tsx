'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Mail, 
  Sparkles, 
  Loader2,
  Check,
  ShieldCheck
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { 
  validatePasswordConfirmation, 
  translateAuthError,
  getSafeRedirectUrl 
} from '@/utils/authUtils';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Estados principais da página:
  // - 'checking': verificando sessão / validade do link
  // - 'form': formulário pronto para digitar nova senha
  // - 'submitting': enviando atualização de senha
  // - 'success': senha atualizada com sucesso
  // - 'invalid_link': link inválido ou expirado
  const getInitialError = () => {
    const errorParam = searchParams.get('error');
    const errorDesc = searchParams.get('error_description');
    if (errorParam || errorDesc) return errorDesc || errorParam;

    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashError = hashParams.get('error');
      const hashErrorDesc = hashParams.get('error_description');
      if (hashError || hashErrorDesc) return hashErrorDesc || hashError;
    }
    return null;
  };

  const [initialError] = useState<string | null>(getInitialError);

  const [viewState, setViewState] = useState<
    'checking' | 'form' | 'submitting' | 'success' | 'invalid_link'
  >(() => (initialError ? 'invalid_link' : 'checking'));

  // Campos do formulário de redefinição
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    initialError ? translateAuthError(initialError) : null
  );

  // Solicitação de novo link
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (initialError) {
      return;
    }

    // Verifica sessão ativa via Supabase Auth
    async function checkAuthSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error fetching recovery session:', error);
          if (isMounted) {
            setViewState('invalid_link');
            setErrorMessage(translateAuthError(error));
          }
          return;
        }

        if (session) {
          // Sessão de autenticação válida para redefinir senha
          if (isMounted) {
            setViewState('form');
          }
        } else {
          // Sem sessão no servidor/local: aguarda evento onAuthStateChange
          // (alguns navegadores processam o token PKCE ou hash com ligeiro atraso)
          const timeout = setTimeout(() => {
            if (isMounted) {
              setViewState('invalid_link');
              setErrorMessage('Link de recuperação não encontrado ou expirado.');
            }
          }, 2000);

          return () => clearTimeout(timeout);
        }
      } catch (err) {
        console.error('Failed to verify session', err);
        if (isMounted) {
          setViewState('invalid_link');
          setErrorMessage('Não foi possível verificar a validade do link.');
        }
      }
    }

    checkAuthSession();

    // Inscrição para eventos de recuperação de senha do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
          if (isMounted) {
            setViewState('form');
            setErrorMessage(null);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [initialError, supabase]);

  // Submissão da nova senha
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validação de regras de negócio
    const validation = validatePasswordConfirmation(password, confirmation);
    if (!validation.valid) {
      setErrorMessage(validation.message || 'Dados inválidos.');
      return;
    }

    setViewState('submitting');

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setViewState('success');

      // Redirecionamento automático após confirmação
      setTimeout(() => {
        const rawNext = searchParams.get('next');
        const target = getSafeRedirectUrl(rawNext, '/');
        router.push(target);
      }, 2500);
    } catch (err) {
      console.error('Password update failed:', err);
      setViewState('form');
      setErrorMessage(translateAuthError(err));
    }
  };

  // Solicitar novo e-mail de recuperação
  const handleResendRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) {
      setResendError('Por favor, informe seu e-mail cadastrado.');
      return;
    }

    setResendLoading(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const redirectUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback?next=/auth/reset-password`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(
        resendEmail.trim(),
        { redirectTo: redirectUrl }
      );

      if (error) throw error;

      setResendSuccess(true);
    } catch (err) {
      console.error('Resend error:', err);
      setResendError(translateAuthError(err));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-zinc-50 via-zinc-100 to-indigo-50/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 font-sans">
      <div className="w-full max-w-md bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl shadow-xl shadow-zinc-200/50 dark:shadow-none p-6 sm:p-8 transition-all duration-300">
        
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-none">
              AppToDo
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Recuperação de Senha
            </p>
          </div>
        </div>

        {/* 1. ESTADO: Verificando Sessão */}
        {viewState === 'checking' && (
          <div className="py-12 flex flex-col items-center text-center">
            <Loader2 className="w-9 h-9 text-indigo-600 dark:text-indigo-400 animate-spin mb-4" />
            <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
              Verificando link de recuperação...
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs">
              Aguarde um instante enquanto validamos a autorização da sua solicitação.
            </p>
          </div>
        )}

        {/* 2. ESTADO: Formulário de Nova Senha */}
        {(viewState === 'form' || viewState === 'submitting') && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Criar Nova Senha
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Escolha uma senha segura com pelo menos 6 caracteres para proteger sua conta.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 flex items-start gap-2.5 text-rose-700 dark:text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {/* Campo: Nova Senha */}
              <div>
                <label 
                  htmlFor="new-password"
                  className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
                >
                  Nova Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    autoComplete="new-password"
                    required
                    disabled={viewState === 'submitting'}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Campo: Confirmação */}
              <div>
                <label 
                  htmlFor="confirm-password"
                  className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
                >
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="confirm-password"
                    type={showConfirmation ? 'text' : 'password'}
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder="Repita sua nova senha"
                    autoComplete="new-password"
                    required
                    disabled={viewState === 'submitting'}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmation(!showConfirmation)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    {showConfirmation ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Validações dinâmicas visuais */}
              <div className="space-y-1 pt-1 pb-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <span
                    className={`flex items-center justify-center w-3.5 h-3.5 rounded-full ${
                      password.length >= 6
                        ? 'bg-emerald-500 text-white'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-transparent'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </span>
                  <span
                    className={
                      password.length >= 6
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-zinc-500 dark:text-zinc-400'
                    }
                  >
                    Mínimo de 6 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span
                    className={`flex items-center justify-center w-3.5 h-3.5 rounded-full ${
                      password && confirmation && password === confirmation
                        ? 'bg-emerald-500 text-white'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-transparent'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </span>
                  <span
                    className={
                      password && confirmation && password === confirmation
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-zinc-500 dark:text-zinc-400'
                    }
                  >
                    As duas senhas são idênticas
                  </span>
                </div>
              </div>

              {/* Botão de Envio */}
              <button
                type="submit"
                disabled={viewState === 'submitting'}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium text-sm shadow-md shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {viewState === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Atualizando senha...</span>
                  </>
                ) : (
                  <>
                    <span>Atualizar Senha</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* 3. ESTADO: Sucesso */}
        {viewState === 'success' && (
          <div className="py-8 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-4 shadow-sm shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>Senha Atualizada!</span>
              <Sparkles className="w-4 h-4 text-emerald-500" />
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs">
              Sua nova senha foi gravada com sucesso. Você será redirecionado para o aplicativo automaticamente.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              <span>Ir para o aplicativo agora</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* 4. ESTADO: Link Inválido ou Expirado */}
        {viewState === 'invalid_link' && (
          <div className="py-2">
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-3 mb-5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold leading-tight">
                  Link Inválido ou Expirado
                </h2>
                <p className="text-xs text-rose-700/80 dark:text-rose-400/80 mt-1">
                  {errorMessage ||
                    'Este link de recuperação expirou, já foi utilizado ou não possui uma sessão válida.'}
                </p>
              </div>
            </div>

            {/* Formulário integrado para solicitar novo link */}
            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                Solicitar novo link de recuperação
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                Informe o seu e-mail cadastrado e enviaremos um novo link imediatamente.
              </p>

              {resendSuccess ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Novo link enviado! Verifique sua caixa de entrada e spam.</span>
                </div>
              ) : (
                <form onSubmit={handleResendRecovery} className="space-y-3">
                  {resendError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs">
                      {resendError}
                    </div>
                  )}

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="seu-email@exemplo.com"
                      required
                      disabled={resendLoading}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resendLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {resendLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Enviando link...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5" />
                        <span>Enviar Novo Link de Recuperação</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
              >
                ← Voltar para a página inicial
              </Link>
            </div>
          </div>
        )}

        {/* Footer Security Badge */}
        <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-center gap-1.5 text-zinc-400 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
          <span>Conexão criptografada de ponta a ponta</span>
        </div>

      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <span className="text-xs text-zinc-500">Carregando...</span>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
