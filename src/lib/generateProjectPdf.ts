import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface PdfProjectData {
  project: {
    title: string;
    description?: string | null;
    status?: string;
    progress_percent?: number;
    timeline_start?: string | null;
    timeline_end?: string | null;
    venue?: string | null;
    location_secured?: boolean;
    equipment_needed?: string | null;
    props_needed?: string | null;
    deliverables?: any[] | null;
    currency?: string;
  };
  creator?: { display_name?: string | null };
  roles?: { role_name: string; slots_available: number; slots_filled: number }[];
  milestones?: { title: string; status: string; due_date?: string | null; amount?: number | null }[];
  call_sheets?: {
    shoot_date: string;
    general_location?: string | null;
    general_notes?: string | null;
    role_entries: { role_name: string; call_time: string; wrap_time: string; location: string; notes: string }[];
  }[];
  attachments?: { file_name: string; file_type: string }[];
}

export function generateProjectPdf(data: PdfProjectData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  };

  const addHeading = (text: string) => {
    checkPage(15);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, y);
    y += 8;
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  const addText = (label: string, value: string) => {
    checkPage(10);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}: `, margin, y);
    const labelWidth = doc.getTextWidth(`${label}: `);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value, contentWidth - labelWidth);
    doc.text(lines, margin + labelWidth, y);
    y += lines.length * 5 + 3;
  };

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(data.project.title, margin, y);
  y += 10;

  if (data.creator?.display_name) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`by ${data.creator.display_name}`, margin, y);
    doc.setTextColor(0);
    y += 8;
  }

  // Status & Progress
  if (data.project.status) addText('Status', data.project.status.replace('_', ' '));
  if (data.project.progress_percent != null) addText('Progress', `${data.project.progress_percent}%`);

  // Description
  if (data.project.description) {
    addHeading('Description');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(data.project.description, contentWidth);
    checkPage(descLines.length * 5);
    doc.text(descLines, margin, y);
    y += descLines.length * 5 + 5;
  }

  // Timeline
  if (data.project.timeline_start || data.project.timeline_end) {
    addHeading('Timeline');
    const start = data.project.timeline_start ? format(new Date(data.project.timeline_start), 'MMM d, yyyy') : 'TBD';
    const end = data.project.timeline_end ? format(new Date(data.project.timeline_end), 'MMM d, yyyy') : 'TBD';
    addText('Dates', `${start} → ${end}`);
  }

  // Roles
  if (data.roles && data.roles.length > 0) {
    addHeading('Team Roles');
    data.roles.forEach(r => {
      checkPage(8);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`• ${r.role_name} (${r.slots_filled}/${r.slots_available} filled)`, margin + 4, y);
      y += 6;
    });
    y += 2;
  }

  // Resources
  if (data.project.venue || data.project.equipment_needed || data.project.props_needed) {
    addHeading('Resources & Logistics');
    if (data.project.venue) addText('Venue', `${data.project.venue}${data.project.location_secured ? ' (Secured)' : ''}`);
    if (data.project.equipment_needed) addText('Supplies', data.project.equipment_needed);
    if (data.project.props_needed) addText('Props', data.project.props_needed);
  }

  // Milestones
  if (data.milestones && data.milestones.length > 0) {
    addHeading('Milestones');
    data.milestones.forEach(ms => {
      checkPage(8);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const due = ms.due_date ? format(new Date(ms.due_date), 'MMM d') : '';
      doc.text(`• ${ms.title} — ${ms.status}${due ? ` (${due})` : ''}`, margin + 4, y);
      y += 6;
    });
    y += 2;
  }

  // Call Sheets
  if (data.call_sheets && data.call_sheets.length > 0) {
    addHeading('Call Sheets');
    data.call_sheets.forEach(cs => {
      checkPage(12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${format(new Date(cs.shoot_date + 'T00:00:00'), 'MMM d, yyyy')}${cs.general_location ? ` — ${cs.general_location}` : ''}`, margin + 4, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      if (cs.general_notes) {
        const noteLines = doc.splitTextToSize(cs.general_notes, contentWidth - 8);
        checkPage(noteLines.length * 5);
        doc.text(noteLines, margin + 8, y);
        y += noteLines.length * 5 + 2;
      }
      cs.role_entries.forEach(entry => {
        checkPage(8);
        const timeStr = [entry.call_time, entry.wrap_time].filter(Boolean).join(' → ');
        doc.text(`  • ${entry.role_name}${timeStr ? ` | ${timeStr}` : ''}${entry.location ? ` | ${entry.location}` : ''}`, margin + 8, y);
        y += 5;
        if (entry.notes) {
          doc.setTextColor(100);
          doc.text(`    ${entry.notes}`, margin + 12, y);
          doc.setTextColor(0);
          y += 5;
        }
      });
      y += 3;
    });
  }

  // Deliverables
  const deliverables = (data.project.deliverables as any[])?.filter(d => d?.type) || [];
  if (deliverables.length > 0) {
    addHeading('Deliverables');
    deliverables.forEach(d => {
      checkPage(8);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const pubDate = d.publish_date ? format(new Date(d.publish_date), 'MMM d') : '';
      doc.text(`• ${d.type}${pubDate ? ` — ${pubDate}` : ''}${d.publish_location ? ` (${d.publish_location})` : ''}`, margin + 4, y);
      y += 6;
    });
  }

  // Footer
  checkPage(15);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated on ${format(new Date(), 'MMM d, yyyy')} via ETHER`, margin, y);

  doc.save(`${data.project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_breakdown.pdf`);
}
