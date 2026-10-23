const TOKEN_KEY = 'buildright-access-token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export async function api(path, { method = 'GET', body, headers } = {}) {
  const token = getToken();
  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/pdf')) {
    if (!response.ok) throw new Error('The report could not be downloaded.');
    return response.blob();
  }
  const payload = type.includes('application/json') ? await response.json() : {};
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
