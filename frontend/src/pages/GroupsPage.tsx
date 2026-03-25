import { useEffect, useState, FormEvent } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { useGroupsStore } from '../store/groups.store';

export default function GroupsPage() {
  const { token } = useAuthStore();
  const { groups, setGroups, addGroup } = useGroupsStore();
  const [newGroupName, setNewGroupName] = useState('');
  const [error, setError] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios.get('/api/groups', { headers }).then(({ data }) => setGroups(data));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await axios.post('/api/groups', { name: newGroupName }, { headers });
      addGroup(data);
      setNewGroupName('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear grupo');
    }
  }

  return (
    <div>
      <h1>Grupos</h1>

      <form onSubmit={handleCreate}>
        <input
          placeholder="Nombre del grupo"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          required
        />
        <button type="submit">Crear grupo</button>
      </form>
      {error && <p>{error}</p>}

      <ul>
        {groups.map((g) => (
          <li key={g.id}>
            <strong>{g.name}</strong> — {g.members.length} miembros
          </li>
        ))}
      </ul>
    </div>
  );
}
