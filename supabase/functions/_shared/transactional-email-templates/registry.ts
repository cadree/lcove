/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<Record<string, unknown>>
  subject: string | ((data: Record<string, unknown>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, unknown>
}

export function defineTemplate<P extends object>(entry: {
  component: React.ComponentType<P>
  subject: string | ((data: P) => string)
  to?: string
  displayName?: string
  previewData?: P
}): TemplateEntry {
  return entry as unknown as TemplateEntry
}

import { template as eventInvite } from './event-invite.tsx'
import { template as eventReminder } from './event-reminder.tsx'
import { template as eventBulkAttendeeReminder } from './event-bulk-attendee-reminder.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'event-invite': eventInvite,
  'event-reminder': eventReminder,
  'event-bulk-attendee-reminder': eventBulkAttendeeReminder,
}
