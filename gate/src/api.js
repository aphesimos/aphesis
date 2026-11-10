/* api: the content service, as the gate and the dashboard use it. Credentialed requests to the API's own host
   (content-api.aphes.ist, the same site as aphes.ist), so its HttpOnly session cookie travels and no script here ever
   sees it. Every write carries the session's CSRF token, which lives only in this closure. Answers are
   {status, data}; nothing throws but the network. */

export function createApi(base) {
  let csrf = '';
  const root = String(base || '').replace(/\/+$/, '');
  async function call(method, path, body) {
    const init = { method, credentials: 'include', headers: {} };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
    if (method !== 'GET' && csrf) init.headers['X-CSRF-Token'] = csrf;
    let r;
    try { r = await fetch(root + path, init); } catch (_) { return { status: 0, data: { error: 'the service did not answer' } }; }
    let data = null;
    try { data = await r.json(); } catch (_) { data = {}; }
    return { status: r.status, data };
  }
  const kinds = { posts: 'post', books: 'book', works: 'work' };
  return {
    async session() { const r = await call('GET', '/v1/auth/session'); if (r.status === 200 && r.data.open) { csrf = r.data.csrf; return true; } return false; },
    async password(password) { return (await call('POST', '/v1/auth/password', { password })).status === 200; },
    async code(code) { const r = await call('POST', '/v1/auth/code', { code }); if (r.status === 200) csrf = r.data.csrf; return r.status === 200; },
    async logout() { await call('POST', '/v1/auth/logout'); csrf = ''; },
    list: (kind) => call('GET', `/v1/admin/${kind}`),
    get: (kind, id) => call('GET', `/v1/admin/${kind}/${encodeURIComponent(id)}`),
    save: (kind, id, entry) => call('PUT', `/v1/admin/${kind}/${encodeURIComponent(id)}`, entry),
    remove: (kind, id) => call('DELETE', `/v1/admin/${kind}/${encodeURIComponent(id)}`),
    publish: (kind, id, on) => call('POST', `/v1/admin/${kind}/${encodeURIComponent(id)}/${on ? 'publish' : 'unpublish'}`),
    upload(blob) { const fd = new FormData(); fd.append('file', blob, 'map.jpg'); return call('POST', '/v1/admin/media', fd); },
    wall: () => call('GET', '/v1/admin/wall'),
    wallRemove: (id) => call('DELETE', `/v1/admin/wall/${encodeURIComponent(id)}`),
    board: (cursor) => call('GET', '/v1/admin/forum/board' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')),
    thread: (id) => call('GET', `/v1/admin/forum/threads/${encodeURIComponent(id)}`),
    reports: () => call('GET', '/v1/admin/forum/reports'),
    forumRemove: (t, n) => call('DELETE', `/v1/admin/forum/threads/${encodeURIComponent(t)}/posts/${n}`),
    one: (kind) => kinds[kind],
  };
}
