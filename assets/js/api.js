(function () {
  const cfg = window.APP_CONFIG;

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }

    const session = localStorage.getItem('csi_session_token');

    if (session) {
      headers.set('Authorization', `Bearer ${session}`);
    }

    const response = await fetch(
      `${cfg.API_BASE_URL}${path}`,
      {
        ...options,
        headers
      }
    );

    const data = await response.json().catch(() => ({
      ok: false,
      error: 'INVALID_JSON'
    }));

    if (!response.ok || data.ok === false) {
      throw new Error(
        data.message ||
        data.error ||
        `HTTP_${response.status}`
      );
    }

    return data;
  }

  window.Api = { request };
})();
