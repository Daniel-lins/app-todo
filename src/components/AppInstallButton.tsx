"use client";

import { useEffect, useState } from "react";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function AppInstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const installed = () => {
      setPrompt(null);
      setFeedback("App instalado neste dispositivo.");
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  async function install() {
    if (!prompt) {
      setFeedback(
        "No navegador, procure “Instalar aplicativo” no menu. No iPhone, use Compartilhar → Adicionar à Tela de Início.",
      );
      return;
    }
    try {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } catch {
      setFeedback("Abra o menu do navegador para instalar o app.");
    }
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={install}
        className="min-h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 text-sm"
      >
        Instalar no dispositivo
      </button>
      {feedback && (
        <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">
          {feedback}
        </p>
      )}
    </div>
  );
}
