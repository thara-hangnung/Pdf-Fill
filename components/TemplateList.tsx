import React, { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { analyzePDF } from '../services/pdfService';
import { FileUp, FileText, Trash2, Edit } from 'lucide-react';

interface Props {
  onSelectTemplate: (id: number) => void;
}

export const TemplateList: React.FC<Props> = ({ onSelectTemplate }) => {
  const templates = useLiveQuery(() => db.templates.toArray());

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Analyze PDF for AcroFields
      const templateData = await analyzePDF(arrayBuffer, file.name.replace('.pdf', ''));
      
      await db.templates.add(templateData as any);
    } catch (err) {
      console.error(err);
      alert('Error processing PDF');
    }
  }, []);

  const deleteTemplate = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm("Delete this template?")) {
      await db.templates.delete(id);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">My Templates</h2>
        <div className="relative">
          <input 
            type="file" 
            accept=".pdf" 
            onChange={handleFileUpload} 
            className="hidden" 
            id="pdf-upload" 
          />
          <label 
            htmlFor="pdf-upload" 
            className="cursor-pointer flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 shadow-sm transition-colors"
          >
            <FileUp size={18} /> Upload PDF
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates?.map(t => (
          <div 
            key={t.id} 
            onClick={() => onSelectTemplate(t.id!)}
            className="group bg-white rounded-xl border border-slate-200 p-5 cursor-pointer hover:shadow-md hover:border-blue-400 transition-all flex flex-col justify-between h-40"
          >
            <div className="flex items-start gap-3">
              <div className="p-3 bg-red-50 text-red-500 rounded-lg">
                <FileText size={24} />
              </div>
              <div className="overflow-hidden">
                <h3 className="font-semibold text-slate-800 truncate pr-2">{t.name}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(t.createdAt).toLocaleDateString()}
                </p>
                <div className="flex gap-2 mt-2">
                   <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                     {t.fields.filter(f => !f.isManual).length} AcroFields
                   </span>
                   <span className="text-[10px] bg-blue-50 px-2 py-0.5 rounded text-blue-600">
                     {t.fields.filter(f => f.isManual).length} Custom
                   </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-2 opacity-50 group-hover:opacity-100 transition-opacity">
              <button className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                <Edit size={14}/> Edit
              </button>
              <button 
                onClick={(e) => deleteTemplate(t.id!, e)}
                className="text-sm text-red-500 hover:underline flex items-center gap-1"
              >
                <Trash2 size={14}/> Delete
              </button>
            </div>
          </div>
        ))}
        
        {templates?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-400">
            <FileUp size={48} className="mb-4 opacity-50" />
            <p>No templates yet. Upload a PDF to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
};
