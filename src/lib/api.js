const TOKEN_KEY = 'buildright-access-token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export async function api(path, { method = 'GET', body, headers } = {}) {
  const token = getToken();
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    const error = new Error('Cannot reach the BuildRight API. Run `npm run dev:full` (or `npm run server`) so the backend is listening on port 3001.');
    error.status = 0;
    error.cause = networkError;
    throw error;
  }
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/pdf')) {
    if (!response.ok) throw new Error('The report could not be downloaded.');
    return response.blob();
  }
  let payload = {};
  if (type.includes('application/json')) {
    payload = await response.json();
  } else if (!response.ok) {
    // Vite returns HTML/plain text when the API proxy target is down.
    const error = new Error(
      response.status === 500 || response.status === 502 || response.status === 503 || response.status === 504
        ? 'The BuildRight API is not responding. Keep MongoDB running and start the backend with `npm run server` or `npm run dev:full`.'
        : `Request failed (${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status}).`);
    error.status = response.status;
    error.details = payload.details;
    throw error;
  }
  return payload;
}

export function money(value) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(value || 0);
}
