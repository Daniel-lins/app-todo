'use client';

import React, { useState, useRef } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Cloud,
  LogOut,
  Sparkles
} from 'lucide-react';
import { createClient } from '../utils/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useAccessibleModal } from '../hooks/useAccessibleModal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: SupabaseUser | null;
  onAuthSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  user,
  onAuthSuccess,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);

  // Hook de acessibilidade: contenção de foco, foco inicial e devolução de foco
  const { modalRef } = useAccessibleModal({
    isOpen,
    onClose,
    initialFocusRef: emailInputRef,
  });

  if (!isOpen) return null;

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (authMode === 'forgot') {
        const redirectUrl =
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback?next=/auth/reset-password`
            : undefined;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: redirectUrl,
        });
        if (error) throw error;
        setSuccessMsg('Link de redefinição enviado! Verifique sua caixa de entrada.');
      } else if (authMode === 'signup') {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        if (data.session) {
          setSuccessMsg('Conta criada e conectada com sucesso!');
          setTimeout(() => {
            onAuthSuccess();
            onClose();
          }, 1200);
        } else {
          setSuccessMsg('Verifique seu e-mail para confirmar o cadastro antes de entrar!');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        setSuccessMsg('Login efetuado com sucesso!');
        setTimeout(() => {
          onAuthSuccess();
          onClose();
        }, 1000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ocorreu um erro ao processar.';
      // Friendly message translation
      if (message.includes('Invalid login credentials')) {
        setErrorMsg('E-mail ou senha incorretos.');
      } else if (message.includes('User already registered')) {
        setErrorMsg('Este e-mail já está cadastrado. Tente entrar.');
      } else if (message.includes('Password should be at least 6 characters')) {
        setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setErrorMsg(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      onAuthSuccess();
      onClose();
    } catch {
      setErrorMsg('Falha ao desconectar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative w-full max-w-md bg-white dark:bg-[#0f1422] rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar modal de autenticação"
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        {user ? (
          /* User Logged In Profile View */
          <div className="flex flex-col items-center text-center py-3">
            <div className="w-16 h-16 rounded-3xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 mb-4">
              <User className="w-8 h-8" />
            </div>

            <h2 id="auth-modal-title" className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Conta Conectada
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs break-all">
              {user.email}
            </p>

            <div className="w-full mt-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-left flex items-start gap-3">
              <Cloud className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  Sincronização em Nuvem Ativa
                </p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                  Suas tarefas e ciclos de foco estão seguros e sincronizados com a sua conta na nuvem.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={loading}
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-zinc-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-zinc-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-zinc-700 dark:text-zinc-300 font-semibold text-sm transition-colors min-h-[44px]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>Desconectar da Nuvem</span>
            </button>
          </div>
        ) : (
          /* Login, Sign Up & Forgot Password Form */
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#5b4fe9] hover:bg-[#4d40d9] flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <h2 id="auth-modal-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  {authMode === 'forgot'
                    ? 'Recuperar Senha'
                    : authMode === 'signup'
                    ? 'Criar Conta na Nuvem'
                    : 'Entrar na Nuvem'}
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {authMode === 'forgot'
                    ? 'Enviaremos um link para você redefinir sua senha'
                    : authMode === 'signup'
                    ? 'Crie sua conta para sincronizar tarefas'
                    : 'Acesse suas tarefas em qualquer dispositivo'}
                </p>
              </div>
            </div>

            {/* Error and Success Alerts */}
            {errorMsg && (
              <div role="alert" aria-live="assertive" className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div role="status" aria-live="polite" className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="auth-email-input" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    id="auth-email-input"
                    ref={emailInputRef}
                    type="email"
                    required
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>
              </div>

              {authMode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="auth-password-input" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      Senha (mínimo 6 caracteres)
                    </label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('forgot');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline min-h-[30px]"
                      >
                        Esqueci a senha
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      id="auth-password-input"
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-[#5b4fe9] hover:bg-[#4d40d9] text-white font-semibold text-sm shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 min-h-[44px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <span>
                    {authMode === 'forgot'
                      ? 'Enviar Link de Redefinição'
                      : authMode === 'signup'
                      ? 'Cadastrar e Sincronizar'
                      : 'Entrar na Conta'}
                  </span>
                )}
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
              {authMode === 'forgot' ? (
                <p>
                  Lembrou a senha?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline min-h-[30px]"
                  >
                    Voltar ao Login
                  </button>
                </p>
              ) : authMode === 'signup' ? (
                <p>
                  Já tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline min-h-[30px]"
                  >
                    Fazer Login
                  </button>
                </p>
              ) : (
                <p>
                  Ainda não tem conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline min-h-[30px]"
                  >
                    Criar Gratuitamente
                  </button>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
