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

    const isSpotify = url.includes('open.spotify.com')
    const isAppleMusic = url.includes('music.apple.com')

    if (!isSpotify && !isAppleMusic) {
      return new Response(
        JSON.stringify({ error: 'URL must be a Spotify or Apple Music URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let imageUrl: string | null = null
    let artistName: string | null = null
    let genres: string[] = []
    let topTracks: { name: string; album_name?: string; album_image?: string; preview_url?: string; spotify_url?: string; apple_music_url?: string }[] = []
    let albums: { name: string; image_url?: string; release_date?: string; type?: string; spotify_url?: string; apple_music_url?: string }[] = []

    // --- Spotify oEmbed (works for artist, album, track, playlist) ---
    if (isSpotify) {
      try {
        const oembedRes = await fetch(
          `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        )
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json()
          imageUrl = oembedData.thumbnail_url || null
          // oEmbed title includes " - Album by Artist" or "Artist" for artist pages
          let title = oembedData.title || null
          if (title) {
            // For albums: "Album Name" (artist is in description)
            // For artists: "Artist Name"
            // For tracks: "Track Name"
            const desc = oembedData.description || ''
            // Try to extract artist from description patterns
            const byMatch = desc.match(/by\s+(.+?)(?:\s+on\s+Spotify)?$/i)
            if (byMatch) {
              artistName = byMatch[1].trim()
              // The title is the album/track name - also store it
              if (url.includes('/album/')) {
                albums.push({
                  name: title,
                  image_url: imageUrl || undefined,
                  type: 'album',
                  spotify_url: url,
                })
              }
            } else {
              // Likely an artist page
              artistName = title
            }
          }
        }
      } catch (e) {
        console.error('oEmbed failed:', e)
      }
    }

    // --- Fetch HTML for metadata ---
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

        // Extract og:image
        if (!imageUrl) {
          const ogImageMatch = html.match(
            /<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i
          ) || html.match(
            /content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i
          )
          if (ogImageMatch) imageUrl = ogImageMatch[1]
        }

        // Extract og:title - try to get artist name
        if (!artistName) {
          const ogTitleMatch = html.match(
            /<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i
          ) || html.match(
            /content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i
          )
          if (ogTitleMatch) {
            let title = ogTitleMatch[1]
            // Clean common suffixes first
            title = title.replace(/\s+on\s+(Spotify|Apple Music)$/i, '').trim()
            // For Apple Music: "Song (feat. X) by Artist" -> extract "Artist"
            const byArtistMatch = title.match(/\bby\s+(.+)$/i)
            if (byArtistMatch) {
              artistName = byArtistMatch[1].replace(/\s+on\s+(Spotify|Apple Music)$/i, '').trim()
            } else {
              // Clean "Song - Album" or "Song · Artist" patterns for Spotify
              title = title.replace(/\s+[-·]\s+.*$/, '').trim()
              artistName = title
            }
          }
        }

        // Extract description for genre info
        const descMatch = html.match(
          /<meta\s+(?:property|name)=["'](?:og:description|description)["']\s+content=["']([^"']+)["']/i
        ) || html.match(
          /content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:description|description)["']/i
        )
        const description = descMatch ? descMatch[1] : ''

        // Extract artist name from description if we got a track/album page
        if (description && !artistName) {
          const artistFromDesc = description.match(/(?:by|from)\s+([^.·,]+)/i)
          if (artistFromDesc) artistName = artistFromDesc[1].trim()
        }

        // For Spotify pages - try to get artist name from description even if title was set
        if (isSpotify && description) {
          // Spotify descriptions: "Song · Artist · Album" or "Listen to Artist on Spotify"
          const spotifyArtistMatch = description.match(/Listen to (.+?) on Spotify/i)
          if (spotifyArtistMatch && !artistName) {
            artistName = spotifyArtistMatch[1].trim()
          }
          // "Artist · Song · 2024" pattern
          const dotPattern = description.match(/^([^·]+)\s·/i)
          if (dotPattern && !url.includes('/artist/') && !artistName) {
            artistName = dotPattern[1].trim()
          }
        }

        // --- JSON-LD structured data ---
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

            // MusicAlbum type
            if (entity['@type'] === 'MusicAlbum') {
              if (entity.byArtist) {
                const byArtist = Array.isArray(entity.byArtist) ? entity.byArtist[0] : entity.byArtist
                if (!artistName && byArtist.name) artistName = byArtist.name
              }
              if (albums.length === 0 && entity.name) {
                albums.push({
                  name: entity.name,
                  image_url: typeof entity.image === 'string' ? entity.image : entity.image?.url,
                  release_date: entity.datePublished || entity.dateCreated,
                  type: 'album',
                })
              }
            }

            // MusicRecording type (track)
            if (entity['@type'] === 'MusicRecording') {
              if (entity.byArtist) {
                const byArtist = Array.isArray(entity.byArtist) ? entity.byArtist[0] : entity.byArtist
                if (!artistName && byArtist.name) artistName = byArtist.name
              }
              if (topTracks.length === 0 && entity.name) {
                topTracks.push({
                  name: entity.name,
                  album_name: entity.inAlbum?.name,
                  album_image: typeof entity.inAlbum?.image === 'string' ? entity.inAlbum.image : entity.inAlbum?.image?.url,
                })
              }
            }

            // Extract tracks from any entity
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

        // Extract genres from description
        if (genres.length === 0 && description) {
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

        // Apple Music: meta music:genre
        const musicGenreMatches = html.matchAll(/<meta\s+(?:property|name)=["']music:genre["']\s+content=["']([^"']+)["']/gi)
        for (const gm of musicGenreMatches) {
          if (!genres.includes(gm[1])) genres.push(gm[1])
        }
        const musicGenreMatches2 = html.matchAll(/content=["']([^"']+)["']\s+(?:property|name)=["']music:genre["']/gi)
        for (const gm of musicGenreMatches2) {
          if (!genres.includes(gm[1])) genres.push(gm[1])
        }

        // Apple Music: extract track listing from music:song meta tags
        if (isAppleMusic && topTracks.length === 0) {
          const songMatches = html.matchAll(/<meta\s+(?:property|name)=["']music:song["']\s+content=["']([^"']+)["']/gi)
          for (const sm of songMatches) {
            // These are URLs to individual songs
            const songUrl = sm[1]
            const songNameMatch = songUrl.match(/\/([^/?]+)\?/)
            if (songNameMatch) {
              topTracks.push({
                name: decodeURIComponent(songNameMatch[1]).replace(/-/g, ' '),
                apple_music_url: songUrl,
              })
            }
          }
        }

        // Apple Music: extract album info from music:musician meta tags  
        if (isAppleMusic) {
          const musicianMatch = html.match(/<meta\s+(?:property|name)=["']music:musician["']\s+content=["']([^"']+)["']/i)
            || html.match(/content=["']([^"']+)["']\s+(?:property|name)=["']music:musician["']/i)
          if (musicianMatch && !artistName) {
            // Extract artist name from musician URL
            const musicianUrl = musicianMatch[1]
            const nameFromUrl = musicianUrl.match(/\/artist\/([^/]+)\//)
            if (nameFromUrl) {
              artistName = decodeURIComponent(nameFromUrl[1]).replace(/-/g, ' ')
              // Title case
              artistName = artistName.replace(/\b\w/g, c => c.toUpperCase())
            }
          }
        }
      }
    } catch (e) {
      console.error('Page fetch failed:', e)
    }

    // Deduplicate genres
    genres = [...new Set(genres)]

    // Deduplicate tracks by name
    const trackNames = new Set<string>()
    topTracks = topTracks.filter(t => {
      const key = t.name.toLowerCase()
      if (trackNames.has(key)) return false
      trackNames.add(key)
      return true
    })

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
