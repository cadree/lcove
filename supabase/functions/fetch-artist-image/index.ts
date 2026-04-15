const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate it's a Spotify or Apple Music URL
    const isSpotify = url.includes('open.spotify.com/artist')
    const isAppleMusic = url.includes('music.apple.com')

    if (!isSpotify && !isAppleMusic) {
      return new Response(
        JSON.stringify({ error: 'URL must be a Spotify or Apple Music artist URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let imageUrl: string | null = null
    let artistName: string | null = null

    if (isSpotify) {
      // Use Spotify oEmbed endpoint (no auth needed)
      try {
        const oembedRes = await fetch(
          `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        )
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json()
          imageUrl = oembedData.thumbnail_url || null
          artistName = oembedData.title || null
        }
      } catch (e) {
        console.error('oEmbed failed:', e)
      }
    }

    // Fallback: fetch the page and extract og:image
    if (!imageUrl) {
      try {
        const pageRes = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Lovable/1.0)',
            'Accept': 'text/html',
          },
          redirect: 'follow',
        })

        if (pageRes.ok) {
          const html = await pageRes.text()

          // Extract og:image
          const ogImageMatch = html.match(
            /<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i
          ) || html.match(
            /content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i
          )
          if (ogImageMatch) {
            imageUrl = ogImageMatch[1]
          }

          // Extract og:title if we don't have artist name
          if (!artistName) {
            const ogTitleMatch = html.match(
              /<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i
            ) || html.match(
              /content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i
            )
            if (ogTitleMatch) {
              artistName = ogTitleMatch[1]
            }
          }
        }
      } catch (e) {
        console.error('Page fetch failed:', e)
      }
    }

    return new Response(
      JSON.stringify({
        image_url: imageUrl,
        artist_name: artistName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch artist info' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
