import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

// Attach access token to every request
api.interceptors.request.use((config) => {
  const raw = localStorage.getItem('auth');
  if (raw) {
    try {
      const { state } = JSON.parse(raw);
      if (state?.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`;
      }
    } catch { /* ignore */ }
  }
  return config;
});

// On 401, attempt token refresh and retry once
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const raw = localStorage.getItem('auth');
        if (!raw) throw new Error('no auth');
        const { state } = JSON.parse(raw);
        const { data } = await axios.post('/api/auth/refresh', {
          refreshToken: state.refreshToken,
        });
        // Update stored token
        const updated = { state: { ...state, accessToken: data.accessToken } };
        localStorage.setItem('auth', JSON.stringify(updated));
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('auth');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
