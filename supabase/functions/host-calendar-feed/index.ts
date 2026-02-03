import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { format } from "https://esm.sh/date-fns@3.6.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'text/calendar; charset=utf-8',
};

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatICSDate(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss'Z'");
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Missing token parameter', { status: 400 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up the feed token
    const { data: feedRecord, error: feedError } = await supabase
      .from('host_calendar_feeds')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (feedError || !feedRecord) {
      console.error('Feed lookup error:', feedError);
      return new Response('Invalid or expired feed token', { status: 403 });
    }

    const userId = feedRecord.user_id;

    // Update last accessed timestamp
    await supabase
      .from('host_calendar_feeds')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', feedRecord.id);

    // Get user's organization memberships
    const { data: orgMemberships } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId);

    const orgIds = orgMemberships?.map(m => m.organization_id) || [];

    // Fetch events where user is creator OR belongs to one of their organizations
    let eventsQuery = supabase
      .from('events')
      .select('*')
      .gte('start_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Past 30 days
      .lte('start_date', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()) // Next year
      .order('start_date', { ascending: true });

    // Build OR condition for creator_id and organization_id
    if (orgIds.length > 0) {
      eventsQuery = eventsQuery.or(`creator_id.eq.${userId},organization_id.in.(${orgIds.join(',')})`);
    } else {
      eventsQuery = eventsQuery.eq('creator_id', userId);
    }

    const { data: events, error: eventsError } = await eventsQuery;

    if (eventsError) {
      console.error('Events fetch error:', eventsError);
      return new Response('Error fetching events', { status: 500 });
    }

    // Get user profile for calendar name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', userId)
      .single();

    const calendarName = profile?.display_name 
      ? `${profile.display_name}'s Hosted Events` 
      : 'My Hosted Events';

    // Generate ICS content
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lcove//Host Calendar Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeICSText(calendarName)}`,
      'X-WR-TIMEZONE:UTC',
    ];

    for (const event of events || []) {
      const startDate = new Date(event.start_date);
      const endDate = event.end_date ? new Date(event.end_date) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
      
      const location = [event.venue, event.address, event.city, event.state]
        .filter(Boolean)
        .join(', ');

      const eventUrl = `https://lcove.lovable.app/calendar?event=${event.id}`;

      icsLines.push(
        'BEGIN:VEVENT',
        `UID:${event.id}@lcove.app`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        `DTSTART:${formatICSDate(startDate)}`,
        `DTEND:${formatICSDate(endDate)}`,
        `SUMMARY:${escapeICSText(event.title)}`,
      );

      if (event.description) {
        icsLines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
      }

      if (location) {
        icsLines.push(`LOCATION:${escapeICSText(location)}`);
      }

      icsLines.push(`URL:${eventUrl}`);
      
      // Add status
      if (event.is_cancelled) {
        icsLines.push('STATUS:CANCELLED');
      } else {
        icsLines.push('STATUS:CONFIRMED');
      }

      icsLines.push('END:VEVENT');
    }

    icsLines.push('END:VCALENDAR');

    const icsContent = icsLines.join('\r\n');

    console.log(`Generated ICS feed for user ${userId} with ${events?.length || 0} events`);

    return new Response(icsContent, {
      headers: {
        ...corsHeaders,
        'Content-Disposition': 'attachment; filename="hosted-events.ics"',
      },
    });

  } catch (error) {
    console.error('Error generating calendar feed:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
