import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('service worker caches the anonymous shell and serves it offline without intercepting APIs or recovery links', async () => {
  const handlers: Record<string, (event: Record<string, unknown>) => void> = {};
  const cacheEntries = new Map<string, Response>();
  let initialRequest: Request | undefined;
  let offline = false;
  const cache = {
    add: async (request: Request) => { initialRequest = request; cacheEntries.set('https://app.example/', new Response('<html>public shell</html>')); },
    put: async (request: Request, response: Response) => { cacheEntries.set(request.url, response); },
    keys: async () => [...cacheEntries.keys()].map(url => new Request(url)),
    match: async (request: Request) => cacheEntries.get(request.url)?.clone(),
    delete: async (request: Request) => cacheEntries.delete(request.url),
  };
  class LocalRequest extends Request { constructor(url: string, options?: RequestInit) { super(new URL(url, 'https://app.example').toString(), options); } }
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: { location: { origin: 'https://app.example' }, addEventListener: (name: string, callback: (event: Record<string, unknown>) => void) => { handlers[name] = callback; }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { open: async () => cache, keys: async () => [] }, Request: LocalRequest, Response, URL,
    fetch: async () => { if (offline) throw new Error('offline'); return new Response('online shell'); },
  });
  let installed: Promise<unknown> | undefined;
  handlers.install({ waitUntil: (promise: Promise<unknown>) => { installed = promise; } });
  await installed;
  assert.equal(initialRequest!.credentials, 'omit');
  offline = true;
  let response: Promise<Response> | undefined;
  const navigate = { url: 'https://app.example/', method: 'GET', mode: 'navigate' };
  handlers.fetch({ request: navigate, respondWith: (promise: Promise<Response>) => { response = promise; } });
  assert.equal(await (await response!).text(), '<html>public shell</html>');
  for (const url of ['https://app.example/auth/reset-password?code=private', 'https://app.example/api/private', 'https://db.example/rest/v1/tasks']) {
    let intercepted = false;
    handlers.fetch({ request: { ...navigate, url }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false);
  }
});
