import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { AuthResponse } from '../types';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data }: { data: AuthResponse } = await api.post('/auth/login', { email, password });
      login(data.user, data.accessToken, data.refreshToken);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#111b21] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light text-[#00a884] mb-2">MessageMe</h1>
          <p className="text-[#8696a0] text-sm">Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#202c33] rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
          <div>
            <label className="block text-[#8696a0] text-xs mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#2a3942] text-[#e9edef] rounded-lg px-3 py-2.5 text-sm outline-none border border-transparent focus:border-teal-500 transition-colors"
              placeholder="correo@ejemplo.com"
              required
            />
          </div>
          <div>
            <label className="block text-[#8696a0] text-xs mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#2a3942] text-[#e9edef] rounded-lg px-3 py-2.5 text-sm outline-none border border-transparent focus:border-teal-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors mt-1"
          >
            {loading ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-[#8696a0] text-sm mt-4">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-teal-400 hover:text-teal-300">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
