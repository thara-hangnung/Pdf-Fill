import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { Template, TemplateField, FieldType, Profile } from '../types';
import { generateFilledPDF } from '../services/pdfService';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Trash2, Download, Maximize2, Move } from 'lucide-react';

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
    
  }, [template?.pdfData]); 

  // Render Page
  const renderPage = async (pageNum: number, pdf: any) => {
    if (!canvasRef.current) return;
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale });
      const containerWidth = containerRef.current?.clientWidth || 800;
      const effectiveContainerWidth = containerWidth > 0 ? containerWidth : 800;
      const desiredScale = (effectiveContainerWidth - 48) / viewport.width;
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
      x: 50,
      y: 50,
      width: 150,
      height: 30,
      fontSize: 12
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

  const persistField = async () => {
    if(template) {
       await db.templates.update(template.id!, { fields: template.fields });
    }
  }

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
      <div className="h-16 border-b flex items-center justify-between px-6 bg-slate-50 shrink-0">
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
              <option value="">Select Profile...</option>
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
             <div className="relative shadow-lg select-none" style={{ width: canvasRef.current?.width, height: canvasRef.current?.height }}>
                <canvas ref={canvasRef} className="bg-white" />
                
                {/* Overlay Layer */}
                <div className="absolute inset-0 z-10">
                  {currentFields.map(field => (
                    <div
                      key={field.id}
                      className={`absolute group flex items-start p-1
                        ${selectedFieldId === field.id ? 'border-2 border-blue-600 z-20 bg-blue-500/10' : 'border border-blue-400 border-dashed hover:bg-blue-500/5'}`}
                      style={{
                        left: (field.x || 0) * scale,
                        top: (field.y || 0) * scale,
                        width: (field.width || 100) * scale,
                        height: (field.height || 20) * scale,
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        // Only start drag if not clicking the resize handle
                        const target = e.target as HTMLElement;
                        if(target.classList.contains('resize-handle')) return;

                        setSelectedFieldId(field.id);
                        
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
                          persistField();
                        };

                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                      }}
                    >
                      {/* Drag Handle Icon (Visual only) */}
                      <div className="absolute -top-3 -left-1 opacity-0 group-hover:opacity-100 bg-blue-600 text-white p-0.5 rounded cursor-move">
                        <Move size={10} />
                      </div>

                      {/* Text Preview */}
                      <span 
                        className="pointer-events-none truncate w-full" 
                        style={{ fontSize: (field.fontSize || 12) * scale + 'px', lineHeight: 1 }}
                      >
                        {field.name}
                      </span>

                      {/* Resize Handle */}
                      {selectedFieldId === field.id && (
                        <div 
                          className="resize-handle absolute bottom-0 right-0 w-4 h-4 bg-blue-600 cursor-nwse-resize rounded-tl-md z-30"
                          onMouseDown={(e) => {
                             e.stopPropagation();
                             e.preventDefault();
                             
                             const startX = e.clientX;
                             const startY = e.clientY;
                             const startWidth = field.width || 100;
                             const startHeight = field.height || 20;

                             const onResize = (moveEvent: MouseEvent) => {
                                const dx = (moveEvent.clientX - startX) / scale;
                                const dy = (moveEvent.clientY - startY) / scale;
                                updateField(field.id, { 
                                  width: Math.max(20, startWidth + dx), 
                                  height: Math.max(10, startHeight + dy) 
                                });
                             };

                             const onUp = () => {
                                window.removeEventListener('mousemove', onResize);
                                window.removeEventListener('mouseup', onUp);
                                persistField();
                             };

                             window.addEventListener('mousemove', onResize);
                             window.addEventListener('mouseup', onUp);
                          }}
                        />
                      )}
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
          <div className="w-64 bg-white border-l flex flex-col p-4 space-y-4 shadow-lg z-20 shrink-0">
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
                 <h4 className="font-semibold text-sm mb-3 text-slate-700">Properties</h4>
                 {(() => {
                   const f = template.fields.find(x => x.id === selectedFieldId);
                   if (!f) return null;
                   return (
                     <div className="space-y-3">
                       <div>
                         <label className="text-xs text-slate-500 font-medium uppercase">Field Name</label>
                         <input 
                          className="w-full border p-2 rounded text-sm mt-1 focus:ring-1 focus:ring-blue-500 outline-none" 
                          value={f.name}
                          onChange={(e) => {
                            updateField(f.id, { name: e.target.value });
                            persistField();
                          }}
                         />
                       </div>

                       <div>
                         <label className="text-xs text-slate-500 font-medium uppercase">Font Size (pt)</label>
                         <div className="flex items-center gap-2 mt-1">
                            <button 
                              className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center font-bold text-slate-600"
                              onClick={() => {
                                updateField(f.id, { fontSize: Math.max(6, (f.fontSize || 12) - 1) });
                                persistField();
                              }}
                            >-</button>
                            <input 
                              type="number"
                              className="w-full text-center border p-1 rounded text-sm outline-none" 
                              value={f.fontSize || 12}
                              onChange={(e) => {
                                updateField(f.id, { fontSize: parseInt(e.target.value) || 12 });
                                persistField();
                              }}
                            />
                             <button 
                              className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center font-bold text-slate-600"
                              onClick={() => {
                                updateField(f.id, { fontSize: Math.min(72, (f.fontSize || 12) + 1) });
                                persistField();
                              }}
                            >+</button>
                         </div>
                       </div>

                       <div className="pt-2">
                         <button 
                          onClick={() => deleteField(f.id)}
                          className="w-full py-2 bg-red-50 text-red-600 rounded border border-red-200 text-xs hover:bg-red-100 flex items-center justify-center gap-1 font-medium"
                         >
                           <Trash2 size={14}/> Remove Field
                         </button>
                       </div>
                     </div>
                   )
                 })()}
               </div>
             ) : (
                <div className="text-sm text-slate-400 text-center mt-4 bg-slate-50 p-4 rounded-lg border border-dashed">
                  Select a field on the PDF to edit its properties (Name, Font Size, etc).
                </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};