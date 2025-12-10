import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Template, Profile, TemplateField, FieldType } from '../types';

/**
 * loads a PDF and detects existing AcroFields
 */
export const analyzePDF = async (arrayBuffer: ArrayBuffer, fileName: string): Promise<Partial<Template>> => {
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  
  const templateFields: TemplateField[] = fields.map(f => {
    // Attempt to get widgets to determine location (simplified)
    const widgets = f.acroField.getWidgets();
    
    return {
      id: f.getName(),
      name: f.getName(),
      type: FieldType.TEXT, // Simplified: assume text
      isManual: false,
      pageIndex: 0, // Defaulting detected fields to page 0
    };
  });

  return {
    name: fileName,
    pdfData: arrayBuffer,
    fields: templateFields,
    mappings: [],
    createdAt: Date.now(),
  };
};

/**
 * Generates the final filled PDF
 */
export const generateFilledPDF = async (template: Template, profile: Profile): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.load(template.pdfData);
  const form = pdfDoc.getForm();
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // 1. Fill AcroFields
  for (const mapping of template.mappings) {
    const fieldDef = template.fields.find(f => f.id === mapping.templateFieldId);
    if (!fieldDef) continue;

    let value = profile.fields[mapping.profileKey] || '';
    
    // Apply transformations
    if (mapping.transformation === 'uppercase') value = value.toUpperCase();
    if (mapping.transformation === 'lowercase') value = value.toLowerCase();

    if (!fieldDef.isManual) {
      // It's an AcroField
      try {
        const field = form.getField(fieldDef.id);
        if (field) {
          field.setText(value);
        }
      } catch (e) {
        console.warn(`Could not fill field ${fieldDef.id}`, e);
      }
    } else {
      // It's a Manual Field - Draw Text
      const page = pages[fieldDef.pageIndex];
      if (page && fieldDef.x !== undefined && fieldDef.y !== undefined) {
        const { height } = page.getSize();
        
        // Use defined font size or default to 12
        const fontSize = fieldDef.fontSize || 12;

        // Adjust Y because PDF is bottom-up
        // fieldDef.y is distance from TOP. 
        // pdf-lib y is distance from BOTTOM.
        // We adjust slightly (+4) to align visually with where the box starts
        const pdfY = height - (fieldDef.y || 0) - (fieldDef.height || 20) + 4; 

        page.drawText(value, {
          x: fieldDef.x,
          y: pdfY,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
          maxWidth: fieldDef.width // Optional: limit width
        });
      }
    }
  }

  return await pdfDoc.save();
};