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
