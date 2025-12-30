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

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean username (remove @ if present)
    const cleanUsername = username.replace(/^@/, '').trim();
    const instagramUrl = `https://www.instagram.com/${cleanUsername}/`;

    console.log('Scraping Instagram profile:', instagramUrl);

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
        waitFor: 3000, // Wait for dynamic content to load
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scrape successful, parsing data...');

    // Extract profile data from scraped content
    const profileData = parseInstagramProfile(data, cleanUsername);

    return new Response(
      JSON.stringify({ success: true, data: profileData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping Instagram:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape Instagram';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseInstagramProfile(data: any, username: string) {
  const markdown = data.data?.markdown || data.markdown || '';
  const metadata = data.data?.metadata || data.metadata || {};
  
  // Default profile data
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
    // Extract display name from title or content
    if (metadata.title) {
      // Title often contains "Name (@username)"
      const titleMatch = metadata.title.match(/^([^(@]+)/);
      if (titleMatch) {
        profile.displayName = titleMatch[1].trim();
      }
    }

    // Try to extract follower/following/posts counts from markdown
    // Common patterns: "1,234 Followers" or "1.2K followers"
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

    // Extract bio - usually the description after the stats
    if (metadata.description) {
      profile.bio = metadata.description;
    }

    // Check for verified badge
    profile.isVerified = markdown.includes('Verified') || markdown.includes('verified');

    // Try to extract profile picture from og:image
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
