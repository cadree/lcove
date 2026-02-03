import { useState } from "react";
import { format } from "date-fns";
import { Calendar, Download, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface CalendarEventData {
  title: string;
  description?: string | null;
  startDate: Date;
  endDate?: Date | null;
  location?: string | null;
  url?: string | null;
}

interface AddToCalendarButtonsProps {
  event: CalendarEventData;
  variant?: "default" | "compact" | "full";
  className?: string;
}

// Generate ICS file content
function generateICS(event: CalendarEventData): string {
  const formatICSDate = (date: Date) => {
    return format(date, "yyyyMMdd'T'HHmmss");
  };

  const escapeICSText = (text: string) => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@lcove.app`;
  const now = formatICSDate(new Date());
  const start = formatICSDate(event.startDate);
  const end = formatICSDate(event.endDate || new Date(event.startDate.getTime() + 2 * 60 * 60 * 1000)); // Default 2 hours

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lcove//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICSText(event.title)}`,
  ];

  if (event.description) {
    icsContent.push(`DESCRIPTION:${escapeICSText(event.description)}`);
  }

  if (event.location) {
    icsContent.push(`LOCATION:${escapeICSText(event.location)}`);
  }

  if (event.url) {
    icsContent.push(`URL:${event.url}`);
  }

  icsContent.push('END:VEVENT', 'END:VCALENDAR');

  return icsContent.join('\r\n');
}

// Download ICS file
function downloadICS(event: CalendarEventData) {
  const icsContent = generateICS(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  toast.success("Calendar file downloaded!");
}

// Generate Google Calendar URL
function getGoogleCalendarUrl(event: CalendarEventData): string {
  const formatGoogleDate = (date: Date) => {
    return format(date, "yyyyMMdd'T'HHmmss");
  };

  const start = formatGoogleDate(event.startDate);
  const end = formatGoogleDate(event.endDate || new Date(event.startDate.getTime() + 2 * 60 * 60 * 1000));

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
  });

  if (event.description) {
    let details = event.description;
    if (event.url) {
      details += `\n\nEvent Link: ${event.url}`;
    }
    params.set('details', details);
  } else if (event.url) {
    params.set('details', `Event Link: ${event.url}`);
  }

  if (event.location) {
    params.set('location', event.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Generate Outlook/Office 365 URL
function getOutlookCalendarUrl(event: CalendarEventData): string {
  const start = event.startDate.toISOString();
  const end = (event.endDate || new Date(event.startDate.getTime() + 2 * 60 * 60 * 1000)).toISOString();

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: start,
    enddt: end,
  });

  if (event.description) {
    params.set('body', event.description);
  }

  if (event.location) {
    params.set('location', event.location);
  }

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function AddToCalendarButtons({ event, variant = "default", className }: AddToCalendarButtonsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleGoogleCalendar = () => {
    window.open(getGoogleCalendarUrl(event), '_blank');
    toast.success("Opening Google Calendar...");
  };

  const handleAppleCalendar = () => {
    downloadICS(event);
  };

  const handleOutlookCalendar = () => {
    window.open(getOutlookCalendarUrl(event), '_blank');
    toast.success("Opening Outlook Calendar...");
  };

  const handleDownloadICS = () => {
    downloadICS(event);
  };

  if (variant === "compact") {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={className}>
            <Calendar className="h-4 w-4 mr-2" />
            Add to Calendar
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleGoogleCalendar}>
            <GoogleIcon className="h-4 w-4 mr-2" />
            Google Calendar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleAppleCalendar}>
            <AppleIcon className="h-4 w-4 mr-2" />
            Apple Calendar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleOutlookCalendar}>
            <OutlookIcon className="h-4 w-4 mr-2" />
            Outlook
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadICS}>
            <Download className="h-4 w-4 mr-2" />
            Download .ics
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === "full") {
    return (
      <div className={`space-y-2 ${className}`}>
        <p className="text-sm font-medium text-muted-foreground mb-2">Add to your calendar</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={handleGoogleCalendar} className="justify-start">
            <GoogleIcon className="h-4 w-4 mr-2" />
            Google
          </Button>
          <Button variant="outline" onClick={handleAppleCalendar} className="justify-start">
            <AppleIcon className="h-4 w-4 mr-2" />
            Apple
          </Button>
          <Button variant="outline" onClick={handleOutlookCalendar} className="justify-start">
            <OutlookIcon className="h-4 w-4 mr-2" />
            Outlook
          </Button>
          <Button variant="outline" onClick={handleDownloadICS} className="justify-start">
            <Download className="h-4 w-4 mr-2" />
            .ics File
          </Button>
        </div>
      </div>
    );
  }

  // Default variant - dropdown button
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className}>
          <Calendar className="h-4 w-4 mr-2" />
          Add to Calendar
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-52">
        <DropdownMenuItem onClick={handleGoogleCalendar} className="cursor-pointer">
          <GoogleIcon className="h-4 w-4 mr-2" />
          Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleAppleCalendar} className="cursor-pointer">
          <AppleIcon className="h-4 w-4 mr-2" />
          Apple Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOutlookCalendar} className="cursor-pointer">
          <OutlookIcon className="h-4 w-4 mr-2" />
          Outlook Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadICS} className="cursor-pointer">
          <Download className="h-4 w-4 mr-2" />
          Download .ics File
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Simple brand icons
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 7.387v10.478c0 .23-.08.424-.238.576-.159.154-.352.23-.578.23h-8.388v-6.342l1.55 1.152c.102.08.22.118.354.118.135 0 .252-.04.35-.118L24 7.387zm-.238-.33c.158.153.238.346.238.576v.003l-7.27 5.41-1.55-1.153V5.33h8.006c.226 0 .418.076.576.228zM14.198 5.33v6.09L7.39 17.01c-.175.13-.39.193-.647.193H.57c-.227 0-.419-.076-.577-.228C-.006 16.82 0 16.627 0 16.397V7.39c0-.23.08-.423.237-.576.157-.152.35-.228.576-.228h13.385v.744zm-7.112 8.49c1.14 0 2.097-.395 2.872-1.186.775-.79 1.162-1.77 1.162-2.94 0-1.166-.39-2.146-1.168-2.94-.778-.795-1.733-1.192-2.866-1.192-1.14 0-2.1.397-2.878 1.192-.78.794-1.168 1.774-1.168 2.94 0 1.17.389 2.15 1.168 2.94.779.79 1.738 1.186 2.878 1.186zm.006-1.543c-.64 0-1.177-.227-1.61-.68-.434-.454-.65-1.017-.65-1.69 0-.687.216-1.26.65-1.718.433-.458.97-.687 1.61-.687.647 0 1.188.229 1.622.687.434.458.65 1.03.65 1.717 0 .674-.216 1.237-.65 1.69-.434.454-.975.68-1.622.68z" fill="#0078D4"/>
    </svg>
  );
}

export default AddToCalendarButtons;
