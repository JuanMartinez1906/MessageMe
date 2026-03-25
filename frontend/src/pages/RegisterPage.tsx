import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', username: '', displayName: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function setField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#111b21] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light text-[#00a884] mb-2">MessageMe</h1>
          <p className="text-[#8696a0] text-sm">Crea tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#202c33] rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
          {[
            { id: 'displayName', label: 'Nombre completo', type: 'text', placeholder: 'Juan Martínez' },
            { id: 'username', label: 'Usuario', type: 'text', placeholder: 'juanm' },
            { id: 'email', label: 'Email', type: 'email', placeholder: 'juan@ejemplo.com' },
            { id: 'password', label: 'Contraseña', type: 'password', placeholder: '••••••••' },
          ].map(({ id, label, type, placeholder }) => (
            <div key={id}>
              <label className="block text-[#8696a0] text-xs mb-1">{label}</label>
              <input
                type={type}
                value={form[id as keyof typeof form]}
                onChange={(e) => setField(id, e.target.value)}
                className="w-full bg-[#2a3942] text-[#e9edef] rounded-lg px-3 py-2.5 text-sm outline-none border border-transparent focus:border-teal-500 transition-colors"
                placeholder={placeholder}
                required
              />
            </div>
          ))}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors mt-1"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-[#8696a0] text-sm mt-4">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-teal-400 hover:text-teal-300">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
