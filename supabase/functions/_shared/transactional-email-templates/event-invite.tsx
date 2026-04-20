/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Img, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  organizerName?: string
  recipientName?: string
  personalNote?: string
  signature?: string
  hostAvatarUrl?: string
  headerImageUrl?: string
  brandColor?: string
  eventTitle?: string
  eventDate?: string
  eventTime?: string
  location?: string
  isFree?: boolean
  ticketPrice?: number
  eventUrl?: string
  moodboardThumbnails?: string[]
}

const EventInviteEmail = ({
  organizerName = 'Your host',
  recipientName,
  personalNote,
  signature,
  hostAvatarUrl,
  headerImageUrl,
  brandColor = '#ff4d8d',
  eventTitle = 'Event',
  eventDate = '',
  eventTime = '',
  location = 'Location TBA',
  isFree = true,
  ticketPrice,
  eventUrl = '#',
  moodboardThumbnails = [],
}: Props) => {
  const first = (recipientName || '').trim().split(' ')[0] || 'there'
  const cta = isFree ? 'RSVP Now' : 'Get Tickets'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${organizerName} invited you to ${eventTitle}`}</Preview>
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
              <Text style={text}>
                {personalNote
                  ? `Hey ${first}, ${personalNote}`
                  : `Hey ${first}, I'd love to personally invite you to ${eventTitle}.`}
              </Text>

              {moodboardThumbnails.length > 0 && (
                <Section style={{ marginTop: 12, marginBottom: 12 }}>
                  {moodboardThumbnails.slice(0, 3).map((u, i) => (
                    <Img key={i} src={u} alt="" width="180" style={moodImg} />
                  ))}
                </Section>
              )}

              <Section style={metaBox}>
                <Text style={meta}>📅 {eventDate} at {eventTime}</Text>
                <Text style={meta}>📍 {location}</Text>
                {!isFree && ticketPrice ? (
                  <Text style={meta}>🎟️ Tickets: ${ticketPrice}</Text>
                ) : isFree ? (
                  <Text style={meta}>🎟️ Free Event</Text>
                ) : null}
              </Section>

              <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
                <Button href={eventUrl} style={{ ...btn, backgroundColor: brandColor }}>
                  {cta}
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
  component: EventInviteEmail,
  subject: (d: Record<string, any>) =>
    `${d.organizerName || 'Your host'} invited you to ${d.eventTitle || 'an event'}`,
  displayName: 'Event invite',
  previewData: {
    organizerName: 'Cadre Wallace',
    recipientName: 'Jordan',
    eventTitle: 'Sunset Listening Session',
    eventDate: 'Saturday, May 4, 2026',
    eventTime: '7:00 PM',
    location: 'The Loft, Brooklyn',
    isFree: true,
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
const metaBox = { background: '#f8f8f8', borderRadius: '10px', padding: '16px', margin: '16px 0' }
const meta = { margin: '4px 0', color: '#444', fontSize: '14px' }
const moodImg = { display: 'inline-block', height: '80px', objectFit: 'cover' as const, borderRadius: '8px', marginRight: '6px' }
const btn = { color: '#ffffff', padding: '13px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 as const, fontSize: '15px' }
const hr = { borderColor: '#eee', margin: '28px 0 20px' }
const avatar = { borderRadius: '50%', display: 'inline-block', verticalAlign: 'middle' as const, marginRight: '10px' }
const hostName = { fontWeight: 600 as const, color: '#1a1a2e', display: 'inline-block', margin: 0 }
const sig = { color: '#666', fontSize: '13px', margin: '2px 0 0' }
const footer = { color: '#aaa', fontSize: '11px', textAlign: 'center' as const, marginTop: '16px' }
