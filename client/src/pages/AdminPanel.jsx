import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminPanel() {
  const { logout } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyReps, setCompanyReps] = useState([]);
  const [companyManagers, setCompanyManagers] = useState([]);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', websiteUrl: '', phoneNumber: '' });
  const [showAddRep, setShowAddRep] = useState(false);
  const [showAddManager, setShowAddManager] = useState(false);
  const [newRep, setNewRep] = useState({ firstName: '', lastName: '' });
  const [newManager, setNewManager] = useState({ firstName: '', lastName: '', username: '', password: '' });
  const [createdRepCreds, setCreatedRepCreds] = useState(null);
  const [createdManagerCreds, setCreatedManagerCreds] = useState(null);
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingMsg, setBrandingMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCompanies();
    fetchUsers();
  }, []);

  async function fetchCompanies() {
    try {
      const data = await api('/api/companies');
      setCompanies(data);
    } catch {}
  }

  async function fetchUsers() {
    try {
      const data = await api('/api/users');
      setUsers(data);
    } catch {}
  }

  function openCompany(company) {
    setSelectedCompany(company);
    setBrandingMsg('');
    const reps = users.filter(u => u.company_id === company.id && u.role === 'rep');
    const managers = users.filter(u => u.company_id === company.id && u.role === 'manager');
    setCompanyReps(reps);
    setCompanyManagers(managers);
    setCreatedRepCreds(null);
    setCreatedManagerCreds(null);
    setDeleteConfirm('');
  }

  function refreshCompanyUsers() {
    fetchUsers().then(() => {
      if (selectedCompany) {
        const reps = users.filter(u => u.company_id === selectedCompany.id && u.role === 'rep');
        const managers = users.filter(u => u.company_id === selectedCompany.id && u.role === 'manager');
        setCompanyReps(reps);
        setCompanyManagers(managers);
      }
    });
  }

  async function addCompany() {
    if (!newCompany.name) return;
    setSaving(true);
    try {
      await api('/api/companies', {
        method: 'POST',
        body: JSON.stringify(newCompany),
      });
      setNewCompany({ name: '', websiteUrl: '', phoneNumber: '' });
      setShowAddCompany(false);
      fetchCompanies();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCompany(company) {
    if (deleteConfirm !== company.name) {
      alert('Type the company name exactly to confirm deletion.');
      return;
    }
    try {
      await api(`/api/companies/${company.id}`, { method: 'DELETE' });
      setSelectedCompany(null);
      fetchCompanies();
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  }

  async function pullBranding() {
    setBrandingLoading(true);
    setBrandingMsg('');
    try {
      const data = await api(`/api/companies/${selectedCompany.id}/branding`);
      setBrandingMsg(`Branding updated — logo and colors pulled from ${data.domain}`);
      const updated = await api('/api/companies');
      setCompanies(updated);
      const company = updated.find(c => c.id === selectedCompany.id);
      if (company) setSelectedCompany(company);
    } catch (err) {
      setBrandingMsg('Failed: ' + err.message);
    } finally {
      setBrandingLoading(false);
    }
  }

  async function addRep() {
    if (!newRep.firstName || !newRep.lastName) return;
    setSaving(true);
    try {
      const allUsers = await api('/api/users');
      const username = `${newRep.firstName}_${newRep.lastName}`.toLowerCase().replace(/\s+/g, '');
      let n = 1;
      while (allUsers.find(u => u.username === `doorknock${n}`)) n++;
      const password = `doorknock${n}`;

      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          role: 'rep',
          companyId: selectedCompany.id,
          firstName: newRep.firstName,
          lastName: newRep.lastName,
          knocktrakrEnabled: true,
        }),
      });

      setCreatedRepCreds({ username, password });
      setNewRep({ firstName: '', lastName: '' });
      setShowAddRep(false);
      const updated = await api('/api/users');
      setUsers(updated);
      setCompanyReps(updated.filter(u => u.company_id === selectedCompany.id && u.role === 'rep'));
      fetchCompanies();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addManager() {
    if (!newManager.firstName || !newManager.lastName || !newManager.username || !newManager.password) return;
    setSaving(true);
    try {
      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newManager.username,
          password: newManager.password,
          role: 'manager',
          companyId: selectedCompany.id,
          firstName: newManager.firstName,
          lastName: newManager.lastName,
          knocktrakrEnabled: true,
        }),
      });
      setCreatedManagerCreds({ username: newManager.username, password: newManager.password });
      setNewManager({ firstName: '', lastName: '', username: '', password: '' });
      setShowAddManager(false);
      const updated = await api('/api/users');
      setUsers(updated);
      setCompanyManagers(updated.filter(u => u.company_id === selectedCompany.id && u.role === 'manager'));
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(userId, name) {
    if (!confirm(`Remove ${name}?`)) return;
    try {
      await api(`/api/users/${userId}`, { method: 'DELETE' });
      const updated = await api('/api/users');
      setUsers(updated);
      if (selectedCompany) {
        setCompanyReps(updated.filter(u => u.company_id === selectedCompany.id && u.role === 'rep'));
        setCompanyManagers(updated.filter(u => u.company_id === selectedCompany.id && u.role === 'manager'));
      }
    } catch (err) {
      alert(err.message);
    }
  }

  const totalReps = users.filter(u => u.role === 'rep').length;
  const totalManagers = users.filter(u => u.role === 'manager').length;

  function CompanyLogo({ company, size = 'md' }) {
    const sz = size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-10 h-10 text-lg';
    if (company.logo_url) {
      return <img src={company.logo_url} alt={company.name} className={`${sz} rounded-xl object-contain border border-stone-200`} />;
    }
    return (
      <div
        className={`${sz} rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0`}
        style={{ backgroundColor: company.brand_color || '#ea580c' }}
      >
        {company.name[0]?.toUpperCase()}
      </div>
    );
  }

  if (selectedCompany) {
    return (
      <div className="min-h-screen bg-stone-50">
        <div style={{ backgroundColor: '#1c1917' }} className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedCompany(null)} className="text-stone-400 hover:text-white text-sm">← Back</button>
            <span className="text-white font-bold text-xl">LeadCatch Admin</span>
          </div>
          <button onClick={logout} className="text-stone-400 text-sm hover:text-white">Logout</button>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <CompanyLogo company={selectedCompany} size="lg" />
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-stone-800">{selectedCompany.name}</h2>
                {selectedCompany.website_url && (
                  <div className="text-stone-500 text-sm">{selectedCompany.website_url}</div>
                )}
              </div>
              <button
                onClick={pullBranding}
                disabled={brandingLoading}
                className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: '#ea580c' }}
              >
                {brandingLoading ? 'Pulling...' : 'Pull Branding'}
              </button>
            </div>
            {brandingMsg && (
              <div className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                {brandingMsg}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-800">Managers</h3>
              <button
                onClick={() => setShowAddManager(true)}
                className="px-3 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#ea580c' }}
              >
                + Add Manager
              </button>
            </div>

            {createdManagerCreds && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 font-mono text-sm">
                <div className="text-green-800 font-semibold mb-1">Manager Created</div>
                <div>URL: www.useleadcatch.com/login</div>
                <div>Username: {createdManagerCreds.username}</div>
                <div>Password: {createdManagerCreds.password}</div>
              </div>
            )}

            {companyManagers.length === 0 ? (
              <div className="text-stone-400 text-sm">No managers yet.</div>
            ) : (
              companyManagers.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                  <div>
                    <div className="font-medium text-stone-800">{m.first_name} {m.last_name}</div>
                    <div className="text-stone-500 text-sm">@{m.username}</div>
                  </div>
                  <button onClick={() => removeUser(m.id, `${m.first_name} ${m.last_name}`)} className="text-red-500 text-sm">Remove</button>
                </div>
              ))
            )}
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-800">Reps</h3>
              <button
                onClick={() => setShowAddRep(true)}
                className="px-3 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: '#ea580c' }}
              >
                + Add Rep
              </button>
            </div>

            {createdRepCreds && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 font-mono text-sm">
                <div className="text-green-800 font-semibold mb-1">Rep Created</div>
                <div>URL: www.useleadcatch.com/login</div>
                <div>Username: {createdRepCreds.username}</div>
                <div>Password: {createdRepCreds.password}</div>
              </div>
            )}

            {companyReps.length === 0 ? (
              <div className="text-stone-400 text-sm">No reps yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-stone-500 border-b border-stone-100">
                    <th className="text-left py-2 font-medium">Name</th>
                    <th className="text-left py-2 font-medium">Username</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {companyReps.map(r => (
                    <tr key={r.id} className="border-b border-stone-100 last:border-0">
                      <td className="py-2 text-stone-800">{r.first_name} {r.last_name}</td>
                      <td className="py-2 text-stone-500">@{r.username}</td>
                      <td className="py-2"><span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Active</span></td>
                      <td className="py-2 text-right"><button onClick={() => removeUser(r.id, `${r.first_name} ${r.last_name}`)} className="text-red-500">Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-red-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-red-700 mb-3">Delete Company</h3>
            <p className="text-stone-500 text-sm mb-3">Type <strong>{selectedCompany.name}</strong> to confirm deletion. This will also delete all associated users.</p>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Type company name to confirm"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                className="flex-1 border border-stone-300 rounded-xl px-4 py-2 text-stone-800 outline-none"
                style={{ fontSize: '16px' }}
              />
              <button
                onClick={() => deleteCompany(selectedCompany)}
                className="px-4 py-2 rounded-xl text-white font-semibold bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {showAddRep && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-stone-800 mb-4">Add Rep</h2>
              <div className="space-y-3">
                <input type="text" placeholder="First Name" value={newRep.firstName} onChange={e => setNewRep(r => ({ ...r, firstName: e.target.value }))} className="w-full border border-stone-300 rounded-xl px-4 py-3 outline-none focus:border-orange-500" style={{ fontSize: '16px' }} />
                <input type="text" placeholder="Last Name" value={newRep.lastName} onChange={e => setNewRep(r => ({ ...r, lastName: e.target.value }))} className="w-full border border-stone-300 rounded-xl px-4 py-3 outline-none focus:border-orange-500" style={{ fontSize: '16px' }} />
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowAddRep(false)} className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-700">Cancel</button>
                  <button onClick={addRep} disabled={saving} className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#ea580c' }}>{saving ? 'Creating...' : 'Create Rep'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAddManager && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-stone-800 mb-4">Add Manager</h2>
              <div className="space-y-3">
                <input type="text" placeholder="First Name" value={newManager.firstName} onChange={e => setNewManager(m => ({ ...m, firstName: e.target.value }))} className="w-full border border-stone-300 rounded-xl px-4 py-3 outline-none focus:border-orange-500" style={{ fontSize: '16px' }} />
                <input type="text" placeholder="Last Name" value={newManager.lastName} onChange={e => setNewManager(m => ({ ...m, lastName: e.target.value }))} className="w-full border border-stone-300 rounded-xl px-4 py-3 outline-none focus:border-orange-500" style={{ fontSize: '16px' }} />
                <input type="text" placeholder="Username" value={newManager.username} onChange={e => setNewManager(m => ({ ...m, username: e.target.value }))} className="w-full border border-stone-300 rounded-xl px-4 py-3 outline-none focus:border-orange-500" style={{ fontSize: '16px' }} />
                <input type="password" placeholder="Password" value={newManager.password} onChange={e => setNewManager(m => ({ ...m, password: e.target.value }))} className="w-full border border-stone-300 rounded-xl px-4 py-3 outline-none focus:border-orange-500" style={{ fontSize: '16px' }} />
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowAddManager(false)} className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-700">Cancel</button>
                  <button onClick={addManager} disabled={saving} className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#ea580c' }}>{saving ? 'Creating...' : 'Create Manager'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div style={{ backgroundColor: '#1c1917' }} className="px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-white font-bold text-xl">LeadCatch Admin</span>
          <span className="text-stone-400 text-sm ml-3">Manage your KnockTrakr clients</span>
        </div>
        <button onClick={logout} className="text-stone-400 text-sm hover:text-white">Logout</button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Companies', value: companies.length },
            { label: 'Total Reps', value: totalReps },
            { label: 'Total Managers', value: totalManagers },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
              <div className="text-3xl font-bold text-stone-800">{card.value}</div>
              <div className="text-stone-500 text-sm mt-1">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-stone-800">Companies</h2>
          <button
            onClick={() => setShowAddCompany(true)}
            className="px-4 py-2 rounded-xl text-white font-semibold text-sm"
            style={{ backgroundColor: '#ea580c' }}
          >
            + Add Company
          </button>
        </div>

        <div className="space-y-3">
          {companies.length === 0 && (
            <div className="text-stone-400 text-center py-8">No companies yet. Add one to get started.</div>
          )}
          {companies.map(company => (
            <div
              key={company.id}
              onClick={() => openCompany(company)}
              className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm flex items-center gap-4 cursor-pointer hover:border-orange-300 transition"
            >
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-10 h-10 rounded-xl object-contain border border-stone-200" />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-lg flex-shrink-0"
                  style={{ backgroundColor: company.brand_color || '#ea580c' }}
                >
                  {company.name[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <div className="font-bold text-stone-800">{company.name}</div>
                <div className="text-stone-500 text-xs">{company.website_url || 'No website'}</div>
              </div>
              <div className="text-stone-500 text-sm">{company.rep_count || 0} reps</div>
              <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Active</span>
            </div>
          ))}
        </div>
      </div>

      {showAddCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-stone-800 mb-4">Add Company</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Company Name *" value={newCompany.name} onChange={e => setNewCompany(c => ({ ...c, name: e.target.value }))} className="w-full border border-stone-300 rounded-xl px-4 py-3 outline-none focus:border-orange-500" style={{ fontSize: '16px' }} />
              <input type="text" placeholder="Website URL" value={newCompany.websiteUrl} onChange={e => setNewCompany(c => ({ ...c, websiteUrl: e.target.value }))} className="w-full border border-stone-300 rounded-xl px-4 py-3 outline-none focus:border-orange-500" style={{ fontSize: '16px' }} />
              <input type="text" placeholder="Phone Number" value={newCompany.phoneNumber} onChange={e => setNewCompany(c => ({ ...c, phoneNumber: e.target.value }))} className="w-full border border-stone-300 rounded-xl px-4 py-3 outline-none focus:border-orange-500" style={{ fontSize: '16px' }} />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddCompany(false)} className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-700">Cancel</button>
                <button onClick={addCompany} disabled={saving} className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#ea580c' }}>{saving ? 'Creating...' : 'Create Company'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
