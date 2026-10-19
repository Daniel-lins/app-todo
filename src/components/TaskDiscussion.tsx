"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../utils/supabase/client";
import type { GroupMember } from "../types/todo";

interface Comment {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
}
export function TaskDiscussion({
  taskId,
  userId,
  members,
}: {
  taskId: string;
  userId: string;
  members: GroupMember[];
}) {
  const client = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [commitment, setCommitment] = useState("");
  const [commitmentDate, setCommitmentDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    client
      .from("task_comments")
      .select("id,author_id,body,created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError("Não foi possível carregar os comentários.");
        else {
          setComments((data || []).reverse());
          setError("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, taskId, revision]);
  async function post() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await client
        .from("task_comments")
        .insert({ task_id: taskId, author_id: userId, body: text.trim() });
      if (error) throw error;
      setText("");
      setRevision((r) => r + 1);
    } catch {
      setError(
        "Não foi possível enviar. Seu comentário continua no campo para tentar novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-4">
      <h3 className="font-semibold text-sm">Comentários do grupo</h3>
      {comments.map((c) => (
        <article
          key={c.id}
          className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-3"
        >
          <p className="text-xs text-zinc-500">
            {members.find((m) => m.userId === c.author_id)?.displayName ||
              (c.author_id === userId ? "Você" : "Membro")}{" "}
            · {new Date(c.created_at).toLocaleString("pt-BR")}
          </p>
          <p className="text-sm mt-1 whitespace-pre-wrap break-words">
            {c.body}
          </p>
        </article>
      ))}
      {!comments.length && (
        <p className="text-xs text-zinc-500">
          Compartilhe uma atualização ou tire uma dúvida sobre esta tarefa.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      <details className="border-t border-zinc-200 dark:border-zinc-800 pt-2">
        <summary className="cursor-pointer min-h-11 content-center text-sm font-medium">
          Combinar um compromisso com o grupo (opcional)
        </summary>
        <div className="space-y-3 py-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Será publicado como comentário para todos os membros deste grupo.
            Não cria cobranças automáticas nem compartilha sua reflexão privada.
          </p>
          <label className="block text-sm">
            O que você pretende entregar?
            <input
              maxLength={300}
              value={commitment}
              onChange={(e) => setCommitment(e.target.value)}
              className="block w-full border border-zinc-300 dark:border-zinc-700 rounded-lg p-3 mt-1 bg-transparent"
              placeholder="Ex.: terminar o primeiro rascunho"
            />
          </label>
          <label className="block text-sm">
            Até quando?
            <input
              type="date"
              value={commitmentDate}
              onChange={(e) => setCommitmentDate(e.target.value)}
              className="block w-full min-w-0 border border-zinc-300 dark:border-zinc-700 rounded-lg p-3 mt-1 bg-transparent"
            />
          </label>
          <button
            type="button"
            disabled={
              busy || !!text.trim() || !commitment.trim() || !commitmentDate
            }
            onClick={() =>
              setText(
                `Meu compromisso: ${commitment.trim()}. Até ${new Date(commitmentDate + "T12:00:00").toLocaleDateString("pt-BR")}.`,
              )
            }
            className="min-h-11 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm disabled:opacity-50"
          >
            Preparar comentário para revisar
          </button>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Revise o campo abaixo e toque em Enviar comentário para
            compartilhar. Esvazie um rascunho existente antes de preparar outro.
          </p>
        </div>
      </details>
      <label className="block text-sm">
        Novo comentário
        <textarea
          maxLength={5000}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="block w-full mt-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3"
        />
      </label>
      <button
        type="button"
        disabled={busy || !text.trim()}
        onClick={post}
        className="min-h-11 px-4 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-40"
      >
        {busy ? "Enviando…" : "Enviar comentário"}
      </button>
    </section>
  );
}
