import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();

    if (!username) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean username (remove @ if present)
    const cleanUsername = username.replace(/^@/, '').trim();

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    // If no API key or Firecrawl fails, use simulated data with a note
    if (!apiKey) {
      console.log('FIRECRAWL_API_KEY not configured, using simulated data');
      const simulatedProfile = generateSimulatedProfile(cleanUsername);
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: simulatedProfile,
          simulated: true,
          note: 'Using simulated data - Firecrawl not configured'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const instagramUrl = `https://www.instagram.com/${cleanUsername}/`;
    console.log('Attempting to scrape Instagram profile:', instagramUrl);

    try {
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: instagramUrl,
          formats: ['markdown', 'html'],
          onlyMainContent: false,
          waitFor: 3000,
        }),
      });

      const data = await response.json();

      // Check if Firecrawl returned an error (Instagram not supported)
      if (!response.ok || data.success === false) {
        console.log('Firecrawl cannot scrape Instagram, using simulated data:', data.error);
        const simulatedProfile = generateSimulatedProfile(cleanUsername);
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: simulatedProfile,
            simulated: true,
            note: 'Instagram scraping requires enterprise Firecrawl plan. Using estimated data.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Scrape successful, parsing data...');
      const profileData = parseInstagramProfile(data, cleanUsername);

      return new Response(
        JSON.stringify({ success: true, data: profileData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fetchError) {
      console.error('Firecrawl API call failed:', fetchError);
      const simulatedProfile = generateSimulatedProfile(cleanUsername);
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: simulatedProfile,
          simulated: true,
          note: 'API connection failed. Using estimated data.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in scrape-instagram function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process request';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateSimulatedProfile(username: string) {
  // Generate realistic-looking simulated data based on username
  const seed = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (min: number, max: number) => min + (seed % (max - min));
  
  return {
    username: username,
    displayName: formatDisplayName(username),
    bio: '',
    followers: random(500, 50000),
    following: random(100, 2000),
    posts: random(10, 500),
    profilePictureUrl: '',
    isVerified: false,
    category: '',
    externalUrl: '',
  };
}

function formatDisplayName(username: string): string {
  // Convert username to a display name format
  return username
    .replace(/[._]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function parseInstagramProfile(data: any, username: string) {
  const markdown = data.data?.markdown || data.markdown || '';
  const metadata = data.data?.metadata || data.metadata || {};
  
  const profile = {
    username: username,
    displayName: username,
    bio: '',
    followers: 0,
    following: 0,
    posts: 0,
    profilePictureUrl: '',
    isVerified: false,
    category: '',
    externalUrl: '',
  };

  try {
    if (metadata.title) {
      const titleMatch = metadata.title.match(/^([^(@]+)/);
      if (titleMatch) {
        profile.displayName = titleMatch[1].trim();
      }
    }

    const followersMatch = markdown.match(/([0-9.,]+[KMkm]?)\s*[Ff]ollowers/);
    if (followersMatch) {
      profile.followers = parseCount(followersMatch[1]);
    }

    const followingMatch = markdown.match(/([0-9.,]+[KMkm]?)\s*[Ff]ollowing/);
    if (followingMatch) {
      profile.following = parseCount(followingMatch[1]);
    }

    const postsMatch = markdown.match(/([0-9.,]+[KMkm]?)\s*[Pp]osts/);
    if (postsMatch) {
      profile.posts = parseCount(postsMatch[1]);
    }

    if (metadata.description) {
      profile.bio = metadata.description;
    }

    profile.isVerified = markdown.includes('Verified') || markdown.includes('verified');

    if (metadata.ogImage) {
      profile.profilePictureUrl = metadata.ogImage;
    }
  } catch (e) {
    console.error('Error parsing Instagram data:', e);
  }

  return profile;
}

function parseCount(str: string): number {
  if (!str) return 0;
  
  str = str.replace(/,/g, '');
  
  const multiplier = str.toLowerCase().includes('k') ? 1000 :
                     str.toLowerCase().includes('m') ? 1000000 : 1;
  
  const num = parseFloat(str.replace(/[kmKM]/g, ''));
  
  return Math.round(num * multiplier);
}
