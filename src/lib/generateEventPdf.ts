import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { CalendarEvent } from '@/hooks/useCalendar';

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

async function loadImageAsDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { data: dataUrl, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

/**
 * Generate a single-page PDF flyer for an event and trigger download.
 * Pure client-side — no edge function or external service needed.
 */
export async function generateEventPdf(event: CalendarEvent): Promise<void> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let y = MARGIN;

  // Cover image (if any)
  if (event.image_url) {
    const img = await loadImageAsDataUrl(event.image_url);
    if (img) {
      const targetH = 80;
      const ratio = img.w / img.h;
      const drawW = Math.min(CONTENT_W, targetH * ratio);
      const drawH = drawW / ratio;
      const ext = img.data.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      try {
        pdf.addImage(img.data, ext, MARGIN, y, drawW, drawH);
        y += drawH + 8;
      } catch {
        // ignore image failure
      }
    }
  }

  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(20, 20, 20);
  const titleLines = pdf.splitTextToSize(event.title, CONTENT_W) as string[];
  pdf.text(titleLines, MARGIN, y);
  y += titleLines.length * 9 + 4;

  // Organizer
  if (event.organizer?.display_name) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Hosted by ${event.organizer.display_name}`, MARGIN, y);
    y += 8;
  }

  // Divider
  pdf.setDrawColor(220, 220, 220);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  // Detail rows
  const details: Array<[string, string]> = [];
  const start = new Date(event.start_date);
  details.push(['Date', format(start, 'EEEE, MMMM d, yyyy')]);
  details.push(['Time', format(start, 'h:mm a') + (event.end_date ? ` – ${format(new Date(event.end_date), 'h:mm a')}` : '')]);
  const locParts = [event.venue, event.address, [event.city, event.state, event.country].filter(Boolean).join(', ')].filter(Boolean);
  if (locParts.length) details.push(['Location', locParts.join('\n')]);

  if (event.ticket_type === 'free') details.push(['Tickets', 'Free']);
  else if (event.ticket_type === 'credits' && event.credits_price) details.push(['Tickets', `${event.credits_price} credits`]);
  else if (event.ticket_type === 'paid' && event.ticket_price) details.push(['Tickets', `$${(event.ticket_price / 100).toFixed(2)}`]);
  else if (event.ticket_type === 'hybrid') {
    const opts: string[] = [];
    if (event.ticket_price) opts.push(`$${(event.ticket_price / 100).toFixed(2)}`);
    if (event.credits_price) opts.push(`${event.credits_price} credits`);
    details.push(['Tickets', opts.join(' or ')]);
  }

  if (event.capacity) details.push(['Capacity', `${event.capacity} attendees`]);

  pdf.setFontSize(11);
  for (const [label, value] of details) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(60, 60, 60);
    pdf.text(label.toUpperCase(), MARGIN, y);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(30, 30, 30);
    const valueLines = pdf.splitTextToSize(value, CONTENT_W - 35) as string[];
    pdf.text(valueLines, MARGIN + 35, y);
    y += Math.max(7, valueLines.length * 6) + 2;

    if (y > PAGE_H - 40) {
      pdf.addPage();
      y = MARGIN;
    }
  }

  // Description
  if (event.description) {
    y += 4;
    pdf.setDrawColor(220, 220, 220);
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(60, 60, 60);
    pdf.text('ABOUT', MARGIN, y);
    y += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(40, 40, 40);
    const descLines = pdf.splitTextToSize(event.description, CONTENT_W) as string[];
    for (const line of descLines) {
      if (y > PAGE_H - 25) {
        pdf.addPage();
        y = MARGIN;
      }
      pdf.text(line, MARGIN, y);
      y += 5.5;
    }
  }

  // Footer with share URL
  const shareUrl = `https://etherbylcove.com/event/${event.id}`;
  pdf.setFontSize(9);
  pdf.setTextColor(140, 140, 140);
  pdf.text(shareUrl, MARGIN, PAGE_H - 10);
  pdf.text('etherbylcove.com', PAGE_W - MARGIN, PAGE_H - 10, { align: 'right' });

  const filename = `${event.title.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')}_event.pdf`;
  pdf.save(filename);
}
