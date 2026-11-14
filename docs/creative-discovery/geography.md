# Bundled geographic data

- `src/data/cityCoordinates.json`: city-center coordinates matched by name, region and country to Ether's existing city catalog (4,242 unique keys), downloaded November 14, 2026 from GeoNames cities15000: https://download.geonames.org/export/dump/cities15000.zip . GeoNames data is CC BY 4.0: https://www.geonames.org/about.html . Coordinates are rounded to four decimal places and are city centers, never user GPS coordinates. Multiple source names/aliases resolve to the existing canonical keys; highest-population duplicate wins, matching the existing catalog convention.
- `src/data/globeLand.json`: Natural Earth 1:110m land polygons, public domain, https://www.naturalearthdata.com/about/terms-of-use/ , downloaded from https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson . Properties removed; geometry retained.
- d3-geo provides orthographic projection, horizon clipping and graticules. All map geometry is local; no map API key or paid provider.

The globe and city cards use opted-in members' public avatars where present, with a typographic fallback. They do not invent destination photos or member counts. Nearby controls deliberately say “My city”: there is no GPS distance claim. Cities with custom/unmapped names remain selectable in the rail and list and receive no guessed map position.
