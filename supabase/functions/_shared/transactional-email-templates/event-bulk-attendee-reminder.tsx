/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Img, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  organizerName?: string
  recipientName?: string
  customMessage?: string
  signature?: string
  hostAvatarUrl?: string
  headerImageUrl?: string
  brandColor?: string
  eventTitle?: string
  eventDate?: string
  eventTime?: string
  location?: string
  eventUrl?: string
  subjectLine?: string
}

const EventBulkAttendeeReminderEmail = ({
  organizerName = 'Your host',
  recipientName,
  customMessage,
  signature,
  hostAvatarUrl,
  headerImageUrl,
  brandColor = '#ff4d8d',
  eventTitle = 'Event',
  eventDate = '',
  eventTime = '',
  location = 'Location TBA',
  eventUrl = '#',
}: Props) => {
  const first = (recipientName || '').trim().split(' ')[0] || 'there'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Update for ${eventTitle}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            {headerImageUrl ? (
              <Img src={headerImageUrl} alt="" width="600" style={hero} />
            ) : (
              <div style={{ ...heroBar, background: brandColor }} />
            )}
            <Section style={inner}>
              <Heading style={h1}>{eventTitle}</Heading>
              <Text style={subline}>Hosted by {organizerName}</Text>
              <Text style={text}>Hey {first},</Text>

              {customMessage && (
                <Section style={{ ...quote, borderLeftColor: brandColor }}>
                  <Text style={quoteText}>{customMessage}</Text>
                </Section>
              )}

              <Section style={metaBox}>
                <Text style={meta}>📅 {eventDate} at {eventTime}</Text>
                <Text style={meta}>📍 {location}</Text>
              </Section>

              <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
                <Button href={eventUrl} style={{ ...btn, backgroundColor: brandColor }}>
                  View Event
                </Button>
              </Section>

              <Hr style={hr} />
              <Section>
                {hostAvatarUrl && (
                  <Img src={hostAvatarUrl} alt="" width="40" height="40" style={avatar} />
                )}
                <Text style={hostName}>{organizerName}</Text>
                {signature && <Text style={sig}>{signature}</Text>}
              </Section>
            </Section>
          </Section>
          <Text style={footer}>
            Sent via ETHER by lcove on behalf of {organizerName}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: EventBulkAttendeeReminderEmail,
  subject: (d: Record<string, any>) =>
    d.subjectLine || `Update: ${d.eventTitle || 'your event'}`,
  displayName: 'Event bulk attendee reminder',
  previewData: {
    organizerName: 'Cadre Wallace',
    recipientName: 'Jordan',
    customMessage: 'Doors open at 6:30 — see you soon!',
    eventTitle: 'Sunset Listening Session',
    eventDate: 'Saturday, May 4, 2026',
    eventTime: '7:00 PM',
    location: 'The Loft, Brooklyn',
    eventUrl: 'https://etherbylcove.com/event/demo',
    brandColor: '#ff4d8d',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" }
const container = { maxWidth: '600px', margin: '0 auto', padding: '20px' }
const card = { border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' as const }
const hero = { width: '100%', height: 'auto', display: 'block' as const }
const heroBar = { width: '100%', height: '8px' }
const inner = { padding: '24px' }
const h1 = { margin: '0 0 4px', color: '#1a1a2e', fontSize: '22px' as const, fontWeight: 700 as const }
const subline = { margin: '0 0 18px', color: '#888', fontSize: '13px' }
const text = { color: '#333', lineHeight: 1.5, margin: '0 0 16px', fontSize: '15px' }
const quote = { background: '#fafafa', borderLeftStyle: 'solid' as const, borderLeftWidth: '3px', padding: '12px 16px', margin: '16px 0', borderRadius: '6px' }
const quoteText = { fontStyle: 'italic' as const, color: '#444', margin: 0, fontSize: '14px' }
const metaBox = { background: '#f8f8f8', borderRadius: '10px', padding: '16px', margin: '16px 0' }
const meta = { margin: '4px 0', color: '#444', fontSize: '14px' }
const btn = { color: '#ffffff', padding: '13px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 as const, fontSize: '15px' }
const hr = { borderColor: '#eee', margin: '28px 0 20px' }
const avatar = { borderRadius: '50%', display: 'inline-block', verticalAlign: 'middle' as const, marginRight: '10px' }
const hostName = { fontWeight: 600 as const, color: '#1a1a2e', display: 'inline-block', margin: 0 }
const sig = { color: '#666', fontSize: '13px', margin: '2px 0 0' }
const footer = { color: '#aaa', fontSize: '11px', textAlign: 'center' as const, marginTop: '16px' }
