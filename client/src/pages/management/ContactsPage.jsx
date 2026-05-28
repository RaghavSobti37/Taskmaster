import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Search, Contact } from 'lucide-react';
import { PageContainer, PageHeader, Card, Button, Input, NexusModal } from '../../components/ui';

const ContactsPage = () => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({ name: '', role: '', phone: '', email: '', notes: '' });
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => (await axios.get('/api/contacts')).data
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => editingContact ? axios.put(`/api/contacts/${editingContact._id}`, data) : axios.post('/api/contacts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsModalOpen(false);
      setEditingContact(null);
      setFormData({ name: '', role: '', phone: '', email: '', notes: '' });
    }
  });

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader title="Important Contacts" subtitle="Manage key contacts for operations." actions={<Button size="sm" onClick={() => setIsModalOpen(true)}><Plus size={14} /> Add Contact</Button>} />
      <Card className="p-4 space-y-4">
        <Input placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} icon={Search} />
        <div className="overflow-x-auto border border-[var(--color-bg-border)] rounded-xl">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">Email</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td className="px-3 py-2" colSpan={4}>Loading...</td></tr>}
              {!isLoading && filtered.map((contact) => (
                <tr key={contact._id} className="border-t border-[var(--color-bg-border)] cursor-pointer" onClick={() => { setEditingContact(contact); setFormData(contact); setIsModalOpen(true); }}>
                  <td className="px-3 py-2 font-bold">{contact.name}</td>
                  <td className="px-3 py-2">{contact.role}</td>
                  <td className="px-3 py-2">{contact.phone}</td>
                  <td className="px-3 py-2">{contact.email || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <NexusModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingContact ? 'Edit Contact' : 'Add Contact'} showFooter={false} width="max-w-2xl">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }}>
          <Input label="Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} icon={Contact} />
          <Input label="Role" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} />
          <Input label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          <Input label="Email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          <Input label="Notes" value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
          <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : 'Save'}</Button>
        </form>
      </NexusModal>
    </PageContainer>
  );
};

export default ContactsPage;
