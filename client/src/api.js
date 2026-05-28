export async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(path, { ...options, headers });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {}
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return res;
  }

  return res.json();
}
