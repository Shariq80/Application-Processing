import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';

export default function GmailAccountSelector() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/auth/gmail/accounts');
      setAccounts(response.data);
    } catch (error) {
      toast.error('Failed to fetch Gmail accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountChange = async (credentialId) => {
    try {
      await api.post('/auth/gmail/preferred', { credentialId });
      toast.success('Gmail account switched successfully');
      await fetchAccounts();
    } catch (error) {
      toast.error('Failed to switch Gmail account');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="mt-4">
      <label className="block text-sm font-medium text-gray-700">
        Active Gmail Account
      </label>
      <select
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        onChange={(e) => handleAccountChange(e.target.value)}
        value={accounts.find(acc => acc.isPreferred)?._id}
      >
        {accounts.map(account => (
          <option key={account.id} value={account.id}>
            {account.email} {account.isDefault ? '(Default)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
} 