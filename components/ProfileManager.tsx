import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Profile } from '../types';
import { Trash2, Plus, Save, User } from 'lucide-react';

export const ProfileManager: React.FC = () => {
  const profiles = useLiveQuery(() => db.profiles.toArray());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Profile>({ name: '', fields: {} });

  // Standard fields that are always suggested
  const standardKeys = ['Full Name', 'Address', 'City', 'State', 'Zip', 'Phone', 'Email', 'DOB', 'Father\'s Name'];

  const startEdit = (p?: Profile) => {
    if (p) {
      setEditingId(p.id!);
      setFormData(JSON.parse(JSON.stringify(p)));
    } else {
      setEditingId(-1); // New
      setFormData({ name: '', fields: {} });
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      fields: { ...prev.fields, [key]: value }
    }));
  };

  const saveProfile = async () => {
    if (!formData.name) return alert("Profile Name is required");
    
    if (editingId === -1) {
      await db.profiles.add({ name: formData.name, fields: formData.fields });
    } else if (editingId) {
      await db.profiles.update(editingId, { name: formData.name, fields: formData.fields });
    }
    setEditingId(null);
  };

  const deleteProfile = async (id: number) => {
    if (confirm('Delete this profile?')) {
      await db.profiles.delete(id);
    }
  };

  if (editingId !== null) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">{editingId === -1 ? 'New Profile' : 'Edit Profile'}</h2>
          <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-700">Cancel</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Profile Name (e.g., "Myself", "Dad")</label>
            <input 
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-3">Data Fields</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {standardKeys.map(key => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-500 uppercase">{key}</label>
                  <input 
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
                    value={formData.fields[key] || ''}
                    onChange={e => handleFieldChange(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
            
            {/* Dynamic Custom Data Fields */}
            <div className="mt-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Custom Keys</h4>
              {Object.keys(formData.fields).filter(k => !standardKeys.includes(k)).map(key => (
                 <div key={key} className="flex gap-2 mb-2">
                   <input className="w-1/3 p-2 bg-slate-100 rounded text-sm" value={key} disabled />
                   <input 
                      className="w-full p-2 border border-slate-300 rounded"
                      value={formData.fields[key]} 
                      onChange={e => handleFieldChange(key, e.target.value)}
                   />
                   <button onClick={() => {
                      const newFields = {...formData.fields};
                      delete newFields[key];
                      setFormData({...formData, fields: newFields});
                   }} className="text-red-500"><Trash2 size={16}/></button>
                 </div>
              ))}
              
              <div className="flex gap-2 mt-2">
                <input id="newKey" placeholder="New Field Name (e.g. Passport No)" className="w-1/3 p-2 border rounded text-sm" />
                <button 
                  onClick={() => {
                    const input = document.getElementById('newKey') as HTMLInputElement;
                    if(input.value) {
                      handleFieldChange(input.value, '');
                      input.value = '';
                    }
                  }}
                  className="px-3 py-2 bg-slate-200 text-slate-700 rounded text-sm hover:bg-slate-300"
                >Add Field</button>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
             <button 
                onClick={saveProfile}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 shadow-sm"
              >
                <Save size={18} /> Save Profile
              </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Profiles</h2>
        <button 
          onClick={() => startEdit()} 
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
        >
          <Plus size={18} /> New Profile
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles?.map(profile => (
          <div key={profile.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 transition-all group relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <User size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{profile.name}</h3>
                <p className="text-xs text-slate-500">{Object.keys(profile.fields).length} fields defined</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
               <button onClick={() => startEdit(profile)} className="text-blue-600 hover:bg-blue-50 p-2 rounded">Edit</button>
               <button onClick={() => deleteProfile(profile.id!)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
            </div>
          </div>
        ))}
        {profiles?.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
            No profiles found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
};
