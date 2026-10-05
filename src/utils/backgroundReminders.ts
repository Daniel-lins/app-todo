import { createClient } from "./supabase/client";

export async function registerAppWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext)
    throw new Error("Este navegador não permite avisos em segundo plano.");
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export async function enableBackgroundReminders(userId: string) {
  if (!("PushManager" in window) || !("Notification" in window))
    throw new Error(
      "Este navegador não suporta Web Push. No iPhone, adicione o app à Tela de Início e abra por lá.",
    );
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "Permita notificações no navegador para ativar os lembretes.",
    );
  const client = createClient();
  const { data: key, error } = await client.rpc("get_push_public_key");
  if (error || typeof key !== "string" || !key)
    throw new Error("O serviço de lembretes ainda não está disponível.");
  const registration = await registerAppWorker();
  const base64 = key.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const applicationServerKey = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription)
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  const json = subscription.toJSON();
  const { error: saveError } = await client
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      { onConflict: "endpoint" },
    );
  if (saveError)
    throw new Error(
      "Não foi possível salvar os lembretes deste dispositivo. Tente novamente.",
    );
  localStorage.setItem("apptodo_push_user", userId);
}

export async function disableBackgroundReminders(userId: string) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    const { error } = await createClient()
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", subscription.endpoint);
    if (error)
      throw new Error(
        "Não foi possível desativar os lembretes. Tente novamente com conexão.",
      );
    await subscription.unsubscribe();
  }
  localStorage.removeItem("apptodo_push_user");
}

export function backgroundRemindersEnabled(userId?: string) {
  try {
    return !!userId && localStorage.getItem("apptodo_push_user") === userId;
  } catch {
    return false;
  }
}
