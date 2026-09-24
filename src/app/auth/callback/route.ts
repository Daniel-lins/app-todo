import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSafeRedirectUrl } from '@/utils/authUtils';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Parâmetros de erro recebidos diretamente do provedor de auth
  const errorParam = searchParams.get('error');
  const errorCode = searchParams.get('error_code');
  const errorDescription = searchParams.get('error_description');

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const rawNext = searchParams.get('next');

  // Determina se a requisição é de recuperação de senha
  const isRecovery =
    type === 'recovery' ||
    rawNext === '/auth/reset-password' ||
    (rawNext && rawNext.startsWith('/auth/reset-password'));

  // Sanitização estrita do destino interno para proteção contra Open Redirect
  const defaultFallback = isRecovery ? '/auth/reset-password' : '/';
  const safeNext = getSafeRedirectUrl(rawNext, defaultFallback);

  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';

  const buildRedirectUrl = (pathWithQuery: string) => {
    if (isLocalEnv || !forwardedHost) {
      return `${origin}${pathWithQuery}`;
    }
    return `https://${forwardedHost}${pathWithQuery}`;
  };

  // 1. Trata erro informado diretamente pela URL de callback do Supabase
  if (errorParam || errorCode || errorDescription) {
    const errorTarget = `/auth/reset-password?error=${encodeURIComponent(
      errorParam || errorCode || 'auth_error'
    )}&error_description=${encodeURIComponent(
      errorDescription || 'O link de autenticação é inválido ou expirou.'
    )}`;
    return NextResponse.redirect(buildRedirectUrl(errorTarget));
  }

  // 2. Trata verificação via token_hash (ex: templates com verifyOtp)
  if (tokenHash && type) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (error) {
        console.error('Callback verifyOtp error:', error.message);
        const errorTarget = `/auth/reset-password?error=invalid_link&error_description=${encodeURIComponent(
          error.message
        )}`;
        return NextResponse.redirect(buildRedirectUrl(errorTarget));
      }

      return NextResponse.redirect(buildRedirectUrl(safeNext));
    } catch (err) {
      console.error('Unexpected error in verifyOtp callback:', err);
      const errorTarget = `/auth/reset-password?error=invalid_link&error_description=Falha+ao+validar+token`;
      return NextResponse.redirect(buildRedirectUrl(errorTarget));
    }
  }

  // 3. Trata troca de código PKCE (exchangeCodeForSession)
  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Callback exchangeCodeForSession error:', error.message);
        const errorTarget = `/auth/reset-password?error=invalid_link&error_description=${encodeURIComponent(
          error.message
        )}`;
        return NextResponse.redirect(buildRedirectUrl(errorTarget));
      }

      return NextResponse.redirect(buildRedirectUrl(safeNext));
    } catch (err) {
      console.error('Unexpected error in code exchange callback:', err);
      const errorTarget = `/auth/reset-password?error=invalid_link&error_description=Falha+na+troca+de+codigo`;
      return NextResponse.redirect(buildRedirectUrl(errorTarget));
    }
  }

  // 4. Sem código nem token: redireciona para destino seguro
  return NextResponse.redirect(buildRedirectUrl(safeNext));
}
