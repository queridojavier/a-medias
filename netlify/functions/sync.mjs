// Netlify Function: sync de blobs cifrados por sesión.
// El servidor solo ve un blob opaco (ciphertext + iv) identificado por un UUID.
// La clave de descifrado vive en el fragment del URL del cliente y nunca llega aquí.

import { getStore } from '@netlify/blobs';

const ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const MAX_BODY_BYTES = 512 * 1024; // 512 KB por sesión: suficiente para esta app

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

export default async (request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id || !ID_PATTERN.test(id)) {
    return json({ error: 'invalid_id' }, { status: 400 });
  }

  const store = getStore('a-medias-sessions');

  if (request.method === 'GET') {
    const record = await store.get(id, { type: 'json' });
    if (!record) return json({ error: 'not_found' }, { status: 404 });
    return json(record);
  }

  if (request.method === 'PUT') {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > MAX_BODY_BYTES) {
      return json({ error: 'payload_too_large' }, { status: 413 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_json' }, { status: 400 });
    }

    if (!body || typeof body.data !== 'string' || typeof body.iv !== 'string') {
      return json({ error: 'invalid_body' }, { status: 400 });
    }

    const previous = await store.get(id, { type: 'json' });
    const nextVersion = (previous?.version || 0) + 1;

    const record = {
      data: body.data,
      iv: body.iv,
      version: nextVersion,
      updatedAt: new Date().toISOString(),
    };

    await store.setJSON(id, record);
    return json(record);
  }

  if (request.method === 'DELETE') {
    await store.delete(id);
    return json({ ok: true });
  }

  return json({ error: 'method_not_allowed' }, { status: 405 });
};

export const config = {
  path: '/.netlify/functions/sync',
};
