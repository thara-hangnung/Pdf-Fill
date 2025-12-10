import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { Template, TemplateField, FieldType, Profile } from '../types';
import { generateFilledPDF } from '../services/pdfService';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Trash2, Download, Move, ChevronUp, ChevronDown, X } from 'lucide-react';

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
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  
  // Canvas & Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interaction State
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showProperties, setShowProperties] = useState(false); // Mobile bottom sheet
  
  // Load Template
  useEffect(() => {
    db.templates.get(templateId).then(t => {
      if (t) setTemplate(t);
    });
  }, [templateId]);

  // Load PDF JS
  useEffect(() => {
    if (!template) return;
    const globalWin = window as any;
    const pdfLib = globalWin.pdfjsLib;
    if (!pdfLib) return;

    const loadingTask = pdfLib.getDocument(template.pdfData);
    loadingTask.promise.then((pdf: any) => {
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      renderPage(1, pdf);
    });
  }, [template?.pdfData]); 

  // Render Page
  const renderPage = async (pageNum: number, pdf: any) => {
    if (!canvasRef.current) return;
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale });
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
      const desiredScale = (containerWidth - 32) / viewport.width; // 32px padding
      const scaledViewport = page.getViewport({ scale: desiredScale });
      
      setScale(desiredScale);

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      
      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      const renderContext = { canvasContext: context, viewport: scaledViewport };
      await page.render(renderContext).promise;
    } catch (e) {
      console.error(e);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= numPages) {
      setCurrentPage(newPage);
      renderPage(newPage, pdfDoc);
    }
  };

  const addManualField = () => {
    if (!template) return;
    const newField: TemplateField = {
      id: `custom_${Date.now()}`,
      name: 'New Field',
      type: FieldType.TEXT,
      isManual: true,
      pageIndex: currentPage - 1,
      x: 50, y: 50, width: 150, height: 30, fontSize: 12
    };
    const newTemplate = { ...template, fields: [...template.fields, newField] };
    setTemplate(newTemplate);
    db.templates.update(template.id!, newTemplate);
    setSelectedFieldId(newField.id);
    setShowProperties(true);
  };

  const updateField = (id: string, updates: Partial<TemplateField>) => {
    if (!template) return;
    const newFields = template.fields.map(f => f.id === id ? { ...f, ...updates } : f);
    setTemplate({ ...template, fields: newFields });
  };

  const persistField = async () => {
    if(template) await db.templates.update(template.id!, { fields: template.fields });
  }

  const deleteField = (id: string) => {
    if (!template) return;
    const newFields = template.fields.filter(f => f.id !== id);
    const newMappings = template.mappings.filter(m => m.templateFieldId !== id);
    const updated = { ...template, fields: newFields, mappings: newMappings };
    setTemplate(updated);
    db.templates.update(template.id!, updated);
    setSelectedFieldId(null);
    setShowProperties(false);
  };

  const saveMapping = async (fieldId: string, profileKey: string) => {
    if (!template) return;
    const existingIndex = template.mappings.findIndex(m => m.templateFieldId === fieldId);
    let newMappings = [...template.mappings];

    if (profileKey === '') {
      if (existingIndex > -1) newMappings.splice(existingIndex, 1);
    } else {
      if (existingIndex > -1) newMappings[existingIndex].profileKey = profileKey;
      else newMappings.push({ templateFieldId: fieldId, profileKey });
    }

    const updated = { ...template, mappings: newMappings };
    setTemplate(updated);
    await db.templates.update(template.id!, updated);
  };

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
      alert("Error generating PDF");
    }
  };

  if (!template) return <div className="p-8 text-center">Loading...</div>;

  const currentFields = template.fields.filter(f => f.pageIndex === currentPage - 1 && f.isManual);
  const selectedField = template.fields.find(f => f.id === selectedFieldId);

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 relative">
      {/* Mobile-Optimized Header */}
      <div className="h-14 border-b flex items-center justify-between px-4 bg-white shrink-0 z-20">
        <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={24}/></button>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setActiveTab('design')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'design' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Design</button>
          <button onClick={() => setActiveTab('mapping')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'mapping' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Data</button>
        </div>
        <button onClick={handleGenerate} className={`p-2 rounded-full ${selectedProfileId ? 'text-blue-600' : 'text-slate-300'}`} disabled={!selectedProfileId}><Download size={24} /></button>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'design' ? (
          <>
            {/* Canvas Area */}
            <div className="flex-1 overflow-auto p-4 bg-slate-100 flex justify-center" ref={containerRef}>
               <div className="relative shadow-lg h-fit bg-white" style={{ width: canvasRef.current?.width, height: canvasRef.current?.height }}>
                  <canvas ref={canvasRef} />
                  
                  {/* Field Overlay */}
                  <div className="absolute inset-0 z-10">
                    {currentFields.map(field => (
                      <div
                        key={field.id}
                        className={`absolute flex items-start p-0.5 ${selectedFieldId === field.id ? 'border-2 border-blue-600 bg-blue-500/10 z-20' : 'border border-blue-400 border-dashed'}`}
                        style={{
                          left: (field.x || 0) * scale,
                          top: (field.y || 0) * scale,
                          width: (field.width || 100) * scale,
                          height: (field.height || 20) * scale,
                        }}
                        onMouseDown={(e) => {
                          // Simple click to select. Complex drag handled via properties or desktop mouse
                          e.stopPropagation();
                          setSelectedFieldId(field.id);
                          setShowProperties(true);
                          
                          // Mouse/Touch Drag Logic
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const startLeft = field.x || 0;
                          const startTop = field.y || 0;
                          
                          // Allow drag if not resizing
                          if ((e.target as HTMLElement).classList.contains('resize-handle')) return;

                          const onMove = (moveEvent: MouseEvent) => {
                            const dx = (moveEvent.clientX - startX) / scale;
                            const dy = (moveEvent.clientY - startY) / scale;
                            updateField(field.id, { x: startLeft + dx, y: startTop + dy });
                          };
                          const onUp = () => {
                             window.removeEventListener('mousemove', onMove);
                             window.removeEventListener('mouseup', onUp);
                             persistField();
                          };
                          window.addEventListener('mousemove', onMove);
                          window.addEventListener('mouseup', onUp);
                        }}
                        onTouchStart={(e) => {
                           e.stopPropagation();
                           setSelectedFieldId(field.id);
                           setShowProperties(true);
                           // Touch drag omitted for brevity, relies on props panel for mobile adjustments
                        }}
                      >
                         {/* Name Preview */}
                         <span className="pointer-events-none text-blue-900 font-bold truncate w-full block" style={{ fontSize: Math.max(8, (field.fontSize || 12) * scale) + 'px', lineHeight: 1 }}>
                           {field.name}
                         </span>
                         
                         {/* Resize Handle (Desktop mainly) */}
                         {selectedFieldId === field.id && (
                            <div className="resize-handle absolute bottom-0 right-0 w-6 h-6 bg-blue-500/50 rounded-tl cursor-nwse-resize" />
                         )}
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            {/* Bottom Controls Bar (Floating) */}
            <div className="absolute bottom-6 left-0 right-0 px-6 flex justify-between items-end pointer-events-none">
                <div className="bg-white/90 backdrop-blur border shadow-lg rounded-full p-2 flex gap-4 items-center pointer-events-auto">
                    <button disabled={currentPage <= 1} onClick={() => handlePageChange(currentPage - 1)} className="p-2 hover:bg-slate-100 rounded-full disabled:opacity-30"><ChevronUp className="-rotate-90" size={20}/></button>
                    <span className="text-xs font-bold w-12 text-center">{currentPage} / {numPages}</span>
                    <button disabled={currentPage >= numPages} onClick={() => handlePageChange(currentPage + 1)} className="p-2 hover:bg-slate-100 rounded-full disabled:opacity-30"><ChevronUp className="rotate-90" size={20}/></button>
                </div>

                <button 
                  onClick={addManualField} 
                  className="bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 pointer-events-auto"
                >
                  <Plus size={24} />
                </button>
            </div>

            {/* Mobile Properties Sheet */}
            {showProperties && selectedField && (
              <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl border-t z-30 flex flex-col max-h-[50vh]">
                 <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-bold text-slate-800">Edit Field</h3>
                    <button onClick={() => setShowProperties(false)} className="p-1"><X size={20}/></button>
                 </div>
                 <div className="p-4 overflow-y-auto space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Field Name</label>
                      <input 
                        className="w-full border p-3 rounded-lg mt-1 text-base bg-slate-50" 
                        value={selectedField.name}
                        onChange={e => { updateField(selectedField.id, { name: e.target.value }); persistField(); }}
                      />
                    </div>
                    
                    <div className="flex gap-4">
                       <div className="flex-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Font Size</label>
                          <div className="flex items-center gap-3 mt-1 h-12">
                             <button className="h-full aspect-square bg-slate-100 rounded text-xl" onClick={() => { updateField(selectedField.id, { fontSize: (selectedField.fontSize||12)-1 }); persistField(); }}>-</button>
                             <span className="flex-1 text-center font-bold text-lg">{selectedField.fontSize || 12}</span>
                             <button className="h-full aspect-square bg-slate-100 rounded text-xl" onClick={() => { updateField(selectedField.id, { fontSize: (selectedField.fontSize||12)+1 }); persistField(); }}>+</button>
                          </div>
                       </div>
                    </div>

                    <button onClick={() => deleteField(selectedField.id)} className="w-full py-3 text-red-600 bg-red-50 rounded-lg font-bold mt-2 flex items-center justify-center gap-2">
                      <Trash2 size={18}/> Delete Field
                    </button>
                 </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-4 overflow-y-auto h-full bg-white">
             {/* Mobile Mapping Mode */}
             <div className="mb-4">
                <label className="text-xs font-bold text-slate-500 uppercase">Fill With Profile</label>
                <select 
                  className="w-full p-3 border rounded-lg mt-1 bg-white text-lg"
                  onChange={(e) => setSelectedProfileId(Number(e.target.value))}
                  value={selectedProfileId || ''}
                >
                  <option value="">Select Profile...</option>
                  {profiles?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
             </div>

             <div className="space-y-3 pb-20">
                <h3 className="font-bold text-lg">Field Mappings</h3>
                {template.fields.map(field => {
                    const mapping = template.mappings.find(m => m.templateFieldId === field.id);
                    return (
                      <div key={field.id} className="p-3 border rounded-lg bg-slate-50">
                        <div className="font-medium text-slate-800 mb-1">{field.name}</div>
                        <select 
                          className="w-full p-2 border rounded bg-white text-sm"
                          value={mapping?.profileKey || ''}
                          onChange={(e) => saveMapping(field.id, e.target.value)}
                        >
                          <option value="">-- Manual Entry (Blank) --</option>
                          <optgroup label="Common">
                            <option value="Full Name">Full Name</option>
                            <option value="Address">Address</option>
                            <option value="Phone">Phone</option>
                            <option value="Email">Email</option>
                            <option value="Date">Current Date</option>
                          </optgroup>
                        </select>
                      </div>
                    )
                })}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};