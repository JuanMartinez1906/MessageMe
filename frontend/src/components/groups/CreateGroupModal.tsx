import { useState, FormEvent } from 'react';
import Modal from '../ui/Modal';
import { api } from '../../services/api';
import { useChatStore } from '../../store/chatStore';
import { Group } from '../../types';

interface Props {
  onClose: () => void;
}

export default function CreateGroupModal({ onClose }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const addGroup = useChatStore((s) => s.addGroup);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data }: { data: Group } = await api.post('/groups', {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      addGroup(data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Error al crear grupo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Crear grupo" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-[#8696a0] text-xs mb-1">Nombre del grupo *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#2a3942] text-[#e9edef] rounded-lg px-3 py-2 text-sm outline-none border border-transparent focus:border-teal-500"
            placeholder="Mi grupo"
            required
          />
        </div>
        <div>
          <label className="block text-[#8696a0] text-xs mb-1">Descripción (opcional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-[#2a3942] text-[#e9edef] rounded-lg px-3 py-2 text-sm outline-none border border-transparent focus:border-teal-500"
            placeholder="De qué trata este grupo"
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium transition-colors"
        >
          {loading ? 'Creando...' : 'Crear grupo'}
        </button>
      </form>
    </Modal>
  );
}
