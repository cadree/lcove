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
    let genres: string[] = []
    let topTracks: { name: string; album_name?: string; album_image?: string; preview_url?: string; spotify_url?: string; apple_music_url?: string }[] = []
    let albums: { name: string; image_url?: string; release_date?: string; type?: string; spotify_url?: string; apple_music_url?: string }[] = []

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

    // Fetch the page HTML for additional metadata
    try {
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      })

      if (pageRes.ok) {
        const html = await pageRes.text()

        // Extract og:image if not already set
        if (!imageUrl) {
          const ogImageMatch = html.match(
            /<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i
          ) || html.match(
            /content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i
          )
          if (ogImageMatch) imageUrl = ogImageMatch[1]
        }

        // Extract og:title if not already set
        if (!artistName) {
          const ogTitleMatch = html.match(
            /<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i
          ) || html.match(
            /content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i
          )
          if (ogTitleMatch) {
            artistName = ogTitleMatch[1]
            // Clean up titles like "Artist Name on Spotify" or "Artist Name on Apple Music"
            artistName = artistName.replace(/\s+on\s+(Spotify|Apple Music)$/i, '').trim()
          }
        }

        // Extract description which often contains genre info
        const descMatch = html.match(
          /<meta\s+(?:property|name)=["'](?:og:description|description)["']\s+content=["']([^"']+)["']/i
        ) || html.match(
          /content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:description|description)["']/i
        )
        const description = descMatch ? descMatch[1] : ''

        // Try to extract structured data (JSON-LD)
        const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
        for (const match of jsonLdMatches) {
          try {
            const ld = JSON.parse(match[1])
            const entity = Array.isArray(ld) ? ld[0] : ld
            
            if (entity['@type'] === 'MusicGroup' || entity['@type'] === 'MusicArtist' || entity['@type']?.includes?.('Music')) {
              if (!artistName && entity.name) artistName = entity.name
              if (!imageUrl && entity.image) {
                imageUrl = typeof entity.image === 'string' ? entity.image : entity.image?.url || entity.image?.[0]
              }
              if (entity.genre) {
                const g = Array.isArray(entity.genre) ? entity.genre : [entity.genre]
                genres.push(...g.filter((x: string) => typeof x === 'string'))
              }
            }

            // Extract tracks from JSON-LD
            if (entity.track) {
              const trackList = Array.isArray(entity.track) ? entity.track : (entity.track?.itemListElement || [])
              for (const t of trackList.slice(0, 10)) {
                const item = t.item || t
                if (item.name) {
                  topTracks.push({
                    name: item.name,
                    album_name: item.inAlbum?.name,
                    album_image: typeof item.inAlbum?.image === 'string' ? item.inAlbum.image : item.inAlbum?.image?.url,
                    preview_url: item.audio?.url || item.contentUrl,
                    spotify_url: isSpotify ? item.url : undefined,
                    apple_music_url: isAppleMusic ? item.url : undefined,
                  })
                }
              }
            }

            // Extract albums
            if (entity.album) {
              const albumList = Array.isArray(entity.album) ? entity.album : [entity.album]
              for (const a of albumList.slice(0, 20)) {
                const item = a.item || a
                if (item.name) {
                  albums.push({
                    name: item.name,
                    image_url: typeof item.image === 'string' ? item.image : item.image?.url,
                    release_date: item.datePublished || item.dateCreated,
                    type: item['@type'] === 'MusicAlbum' ? 'album' : (item.albumProductionType || 'album'),
                    spotify_url: isSpotify ? item.url : undefined,
                    apple_music_url: isAppleMusic ? item.url : undefined,
                  })
                }
              }
            }
          } catch {
            // JSON parse failed, skip
          }
        }

        // If no genres from JSON-LD, try to extract from description or page content
        if (genres.length === 0 && description) {
          // Spotify descriptions often say "Artist · Song · album" or mention genres
          // Apple Music descriptions say things like "Listen to music by Artist. Genre: Hip-Hop/Rap"
          const genrePatterns = [
            /Genre[s]?:\s*([^.]+)/i,
            /(?:genres?\s*(?:include|:)\s*)([^.]+)/i,
          ]
          for (const pattern of genrePatterns) {
            const gm = description.match(pattern)
            if (gm) {
              genres.push(...gm[1].split(/[,&\/]/).map((g: string) => g.trim()).filter(Boolean))
            }
          }
        }

        // Apple Music: try to extract from meta music:genre
        const musicGenreMatches = html.matchAll(/<meta\s+(?:property|name)=["']music:genre["']\s+content=["']([^"']+)["']/gi)
        for (const gm of musicGenreMatches) {
          if (!genres.includes(gm[1])) genres.push(gm[1])
        }
        // Also try reversed attribute order
        const musicGenreMatches2 = html.matchAll(/content=["']([^"']+)["']\s+(?:property|name)=["']music:genre["']/gi)
        for (const gm of musicGenreMatches2) {
          if (!genres.includes(gm[1])) genres.push(gm[1])
        }
      }
    } catch (e) {
      console.error('Page fetch failed:', e)
    }

    // Deduplicate genres
    genres = [...new Set(genres)]

    return new Response(
      JSON.stringify({
        image_url: imageUrl,
        artist_name: artistName,
        genres,
        top_tracks: topTracks,
        albums,
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
