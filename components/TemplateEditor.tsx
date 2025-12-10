import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { Template, TemplateField, FieldType, Profile } from '../types';
import { generateFilledPDF } from '../services/pdfService';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Trash2, Download, Save, Eye } from 'lucide-react';

interface Props {
  templateId: number;
  onClose: () => void;
}

export const TemplateEditor: React.FC<Props> = ({ templateId, onClose }) => {
  const [template, setTemplate] = useState<Template | null>(null);
  const profiles = useLiveQuery(() => db.profiles.toArray());
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  
  // Editor State
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [activeTab, setActiveTab] = useState<'design' | 'mapping'>('design');
  const [pdfDoc, setPdfDoc] = useState<any>(null); // PDFJS Document proxy
  
  // Canvas & Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interaction State
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Load Template
  useEffect(() => {
    db.templates.get(templateId).then(t => {
      if (t) setTemplate(t);
    });
  }, [templateId]);

  // Load PDF JS
  useEffect(() => {
    if (!template) return;
    
    // Explicitly cast window to any to access the global pdfjsLib injected via script tag in index.html
    const globalWin = window as any;
    const pdfLib = globalWin.pdfjsLib;
    
    if (!pdfLib) {
      console.error("PDF.js library not loaded");
      return;
    }

    const loadingTask = pdfLib.getDocument(template.pdfData);
    loadingTask.promise.then((pdf: any) => {
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      renderPage(1, pdf);
    }).catch((err: any) => console.error("Error loading PDF", err));
    
  // FIX: Only reload PDF if the binary data changes, not on every field update
  }, [template?.pdfData]); 

  // Render Page
  const renderPage = async (pageNum: number, pdf: any) => {
    if (!canvasRef.current) return;
    try {
      const page = await pdf.getPage(pageNum);
      
      // Calculate scale to fit container width roughly, or fixed
      const viewport = page.getViewport({ scale: scale }); // 1.0 scale to start
      
      // We might need to scale to fit width of container
      const containerWidth = containerRef.current?.clientWidth || 800;
      // Prevent divide by zero if containerWidth is 0 (hidden)
      const effectiveContainerWidth = containerWidth > 0 ? containerWidth : 800;
      const desiredScale = (effectiveContainerWidth - 48) / viewport.width; // 48px padding
      const scaledViewport = page.getViewport({ scale: desiredScale });
      
      setScale(desiredScale);

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      
      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };
      await page.render(renderContext).promise;
    } catch (e) {
      console.error("Error rendering page", e);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= numPages) {
      setCurrentPage(newPage);
      renderPage(newPage, pdfDoc);
    }
  };

  // Field Manipulation
  const addManualField = () => {
    if (!template) return;
    
    const newField: TemplateField = {
      id: `custom_${Date.now()}`,
      name: 'New Field',
      type: FieldType.TEXT,
      isManual: true,
      pageIndex: currentPage - 1,
      x: 50, // PDF points
      y: 50, // PDF points
      width: 150,
      height: 20
    };

    const newTemplate = {
      ...template,
      fields: [...template.fields, newField]
    };
    setTemplate(newTemplate);
    db.templates.update(template.id!, newTemplate);
    setSelectedFieldId(newField.id);
  };

  const updateField = (id: string, updates: Partial<TemplateField>) => {
    if (!template) return;
    const newFields = template.fields.map(f => f.id === id ? { ...f, ...updates } : f);
    setTemplate({ ...template, fields: newFields });
  };

  const deleteField = (id: string) => {
    if (!template) return;
    const newFields = template.fields.filter(f => f.id !== id);
    const newMappings = template.mappings.filter(m => m.templateFieldId !== id);
    const updated = { ...template, fields: newFields, mappings: newMappings };
    setTemplate(updated);
    db.templates.update(template.id!, updated);
    setSelectedFieldId(null);
  };

  const saveMapping = async (fieldId: string, profileKey: string) => {
    if (!template) return;
    
    const existingIndex = template.mappings.findIndex(m => m.templateFieldId === fieldId);
    let newMappings = [...template.mappings];

    if (profileKey === '') {
      // Remove mapping
      if (existingIndex > -1) newMappings.splice(existingIndex, 1);
    } else {
      if (existingIndex > -1) {
        newMappings[existingIndex].profileKey = profileKey;
      } else {
        newMappings.push({ templateFieldId: fieldId, profileKey });
      }
    }

    const updated = { ...template, mappings: newMappings };
    setTemplate(updated);
    await db.templates.update(template.id!, updated);
  };

  // Generation
  const handleGenerate = async () => {
    if (!template || !selectedProfileId) return alert("Select a profile first");
    const profile = profiles?.find(p => p.id === Number(selectedProfileId));
    if (!profile) return;

    try {
      const pdfBytes = await generateFilledPDF(template, profile);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${template.name}_${profile.name}.pdf`;
      link.click();
    } catch (e) {
      console.error(e);
      alert("Error generating PDF. Check console.");
    }
  };

  if (!template) return <div>Loading...</div>;

  const currentFields = template.fields.filter(f => f.pageIndex === currentPage - 1 && f.isManual);

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] bg-white rounded-xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b flex items-center justify-between px-6 bg-slate-50">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><ArrowLeft size={20}/></button>
          <h2 className="font-bold text-lg truncate max-w-[200px]">{template.name}</h2>
        </div>
        
        <div className="flex gap-2 bg-slate-200 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('design')} 
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${activeTab === 'design' ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}
          >
            Editor
          </button>
          <button 
            onClick={() => setActiveTab('mapping')} 
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${activeTab === 'mapping' ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}
          >
            Mappings
          </button>
        </div>

        <div className="flex items-center gap-2">
            <select 
              className="text-sm border rounded px-2 py-1.5 max-w-[150px]"
              onChange={(e) => setSelectedProfileId(Number(e.target.value))}
              value={selectedProfileId || ''}
            >
              <option value="">Select Profile to Fill...</option>
              {profiles?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button 
              onClick={handleGenerate} 
              disabled={!selectedProfileId}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              <Download size={16} /> Generate
            </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 bg-slate-100 overflow-auto flex justify-center p-8 relative" ref={containerRef}>
          {activeTab === 'design' ? (
             <div className="relative shadow-lg" style={{ width: canvasRef.current?.width, height: canvasRef.current?.height }}>
                <canvas ref={canvasRef} className="bg-white" />
                
                {/* Overlay Layer */}
                <div className="absolute inset-0 z-10">
                  {currentFields.map(field => (
                    <div
                      key={field.id}
                      className={`absolute border-2 flex items-center justify-center cursor-move text-xs font-bold overflow-hidden bg-blue-500/20
                        ${selectedFieldId === field.id ? 'border-blue-600 z-20' : 'border-blue-400 border-dashed hover:border-blue-500'}`}
                      style={{
                        left: (field.x || 0) * scale,
                        top: (field.y || 0) * scale,
                        width: (field.width || 100) * scale,
                        height: (field.height || 20) * scale,
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelectedFieldId(field.id);
                        
                        // Simple Drag implementation
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startLeft = field.x || 0;
                        const startTop = field.y || 0;

                        const onMove = (moveEvent: MouseEvent) => {
                          const dx = (moveEvent.clientX - startX) / scale;
                          const dy = (moveEvent.clientY - startY) / scale;
                          updateField(field.id, { x: startLeft + dx, y: startTop + dy });
                        };

                        const onUp = () => {
                          window.removeEventListener('mousemove', onMove);
                          window.removeEventListener('mouseup', onUp);
                          // Persist to DB on mouse up
                          db.templates.update(template.id!, { fields: template.fields });
                        };

                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                      }}
                    >
                      {field.name}
                    </div>
                  ))}
                </div>
             </div>
          ) : (
            <div className="w-full max-w-3xl bg-white rounded-lg shadow p-6 h-fit min-h-full">
               <h3 className="text-lg font-bold mb-4">Map Profile Fields to PDF</h3>
               <div className="space-y-4">
                  {template.fields.length === 0 && <p className="text-slate-500 italic">No fields detected. Switch to Editor to add manual fields.</p>}
                  {template.fields.map(field => {
                    const mapping = template.mappings.find(m => m.templateFieldId === field.id);
                    return (
                      <div key={field.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-slate-50">
                        <div className="w-1/3">
                          <div className="font-semibold text-sm truncate" title={field.name}>{field.name}</div>
                          <div className="text-xs text-slate-500">{field.isManual ? 'Manual Box' : 'AcroField'}</div>
                        </div>
                        <div className="flex items-center text-slate-400"><ArrowLeft size={16} className="rotate-180"/></div>
                        <div className="flex-1">
                          <select 
                            className="w-full p-2 border rounded-md text-sm"
                            value={mapping?.profileKey || ''}
                            onChange={(e) => saveMapping(field.id, e.target.value)}
                          >
                            <option value="">-- No Value --</option>
                            <optgroup label="Common">
                              <option value="Full Name">Full Name</option>
                              <option value="Address">Address</option>
                              <option value="Phone">Phone</option>
                              <option value="Email">Email</option>
                              <option value="Date">Current Date</option>
                            </optgroup>
                          </select>
                        </div>
                      </div>
                    )
                  })}
               </div>
            </div>
          )}
        </div>

        {/* Sidebar Controls (Design Mode) */}
        {activeTab === 'design' && (
          <div className="w-64 bg-white border-l flex flex-col p-4 space-y-4 shadow-lg z-20">
             <div className="bg-slate-100 p-2 rounded flex justify-center items-center gap-4">
                <button disabled={currentPage <= 1} onClick={() => handlePageChange(currentPage - 1)} className="p-1 hover:bg-white rounded disabled:opacity-30">◀</button>
                <span className="text-sm font-medium">Page {currentPage} / {numPages}</span>
                <button disabled={currentPage >= numPages} onClick={() => handlePageChange(currentPage + 1)} className="p-1 hover:bg-white rounded disabled:opacity-30">▶</button>
             </div>

             <button 
              onClick={addManualField} 
              className="w-full py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-2 font-medium"
             >
               <Plus size={16} /> Add Text Box
             </button>

             {selectedFieldId ? (
               <div className="border-t pt-4 mt-2">
                 <h4 className="font-semibold text-sm mb-2 text-slate-700">Selected Field</h4>
                 {(() => {
                   const f = template.fields.find(x => x.id === selectedFieldId);
                   if (!f) return null;
                   return (
                     <div className="space-y-3">
                       <div>
                         <label className="text-xs text-slate-500">Name</label>
                         <input 
                          className="w-full border p-1 rounded text-sm" 
                          value={f.name}
                          onChange={(e) => {
                            updateField(f.id, { name: e.target.value });
                            // Auto save for name change
                            db.templates.update(template.id!, { fields: template.fields.map(field => field.id === f.id ? { ...field, name: e.target.value } : field) });
                          }}
                         />
                       </div>
                       <button 
                        onClick={() => deleteField(f.id)}
                        className="w-full py-1.5 bg-red-50 text-red-600 rounded border border-red-200 text-xs hover:bg-red-100 flex items-center justify-center gap-1"
                       >
                         <Trash2 size={12}/> Remove Field
                       </button>
                     </div>
                   )
                 })()}
               </div>
             ) : (
                <div className="text-sm text-slate-400 text-center mt-4">
                  Select a field on the PDF to edit properties.
                </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};