import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import webpush from 'npm:web-push@3.6.7';

// This scheduled endpoint uses a private cron secret rather than a user's JWT.
// The service key is supplied by the Edge runtime and never sent to browsers.
const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const allowedEndpoint = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;
interface Delivery { subscription_id: string; task_id: string; deadline: string; endpoint: string; p256dh: string; auth: string }

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret.length < 32) return new Response('Unauthorized', { status: 401 });
  const { data: config, error: configError } = await client.rpc('get_push_config');
  if (configError || !config) return new Response('Configuration unavailable', { status: 503 });
  // Hashes have fixed length; compare without leaking the first differing character.
  const expected = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(config.cron_secret)));
  const supplied = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)));
  if (expected.reduce((difference, byte, i) => difference | (byte ^ supplied[i]), 0) !== 0) return new Response('Unauthorized', { status: 401 });
  webpush.setVapidDetails('https://apptodo-seila14.vercel.app', config.public_key, config.private_key);
  const { data, error } = await client.rpc('claim_push_reminders');
  if (error) return new Response('Could not claim reminders', { status: 500 });
  const deliveries = (data || []) as Delivery[];
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < deliveries.length; i += 8) {
    await Promise.all(deliveries.slice(i, i + 8).map(async d => {
      if (!allowedEndpoint.test(d.endpoint)) { failed++; return; }
      try {
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, JSON.stringify({ title: 'AppToDo · Lembrete', body: 'Você tem uma tarefa perto do prazo. Abra o app para conferir.', tag: `deadline:${d.task_id}:${d.deadline}` }), { TTL: 900, timeout: 10000 });
        const { error } = await client.from('push_deliveries').update({ delivered: true }).eq('subscription_id', d.subscription_id).eq('task_id', d.task_id).eq('deadline', d.deadline);
        if (error) failed++; else sent++;
      } catch (error) {
        failed++;
        if ([404, 410].includes((error as { statusCode?: number }).statusCode || 0)) await client.from('push_subscriptions').delete().eq('id', d.subscription_id);
      }
    }));
  }
  return Response.json({ claimed: deliveries.length, sent, failed });
});
