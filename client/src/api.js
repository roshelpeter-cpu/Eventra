export async function api(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'include',
      signal,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    const unavailable = new Error('Eventra is unavailable. Check that the server is running.');
    unavailable.status = 0;
    throw unavailable;
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Something went wrong.');
    error.status = response.status;
    error.code = data?.error?.code;
    error.fields = data?.error?.fields || {};
    throw error;
  }
  return data;
}
