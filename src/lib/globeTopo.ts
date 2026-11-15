/** Decode a quantized TopoJSON object into GeoJSON that d3-geo can project. */
// cspell:words TopoJSON topojson TopoGeometry

export interface Topology {
  type: "Topology";
  transform?: { scale: [number, number]; translate: [number, number] };
  arcs: number[][][];
  objects: Record<string, TopoGeometry>;
}

type TopoGeometry =
  | { type: "Polygon"; arcs: number[][] }
  | { type: "MultiPolygon"; arcs: number[][][] }
  | { type: "LineString"; arcs: number[] }
  | { type: "MultiLineString"; arcs: number[][] }
  | { type: "GeometryCollection"; geometries: TopoGeometry[] }
  | { type: "Point" | "MultiPoint" | null; coordinates?: unknown; arcs?: unknown };

function decodeArc(topology: Topology, index: number): [number, number][] {
  const arc = topology.arcs[index < 0 ? ~index : index];
  const transform = topology.transform;
  const line: [number, number][] = [];
  if (!arc) return line;
  if (transform) {
    const [sx, sy] = transform.scale;
    const [tx, ty] = transform.translate;
    let x = 0;
    let y = 0;
    for (const point of arc) {
      x += point[0];
      y += point[1];
      line.push([x * sx + tx, y * sy + ty]);
    }
  } else {
    for (const point of arc) line.push([point[0], point[1]]);
  }
  if (index < 0) line.reverse();
  return line;
}

function stitch(topology: Topology, arcs: number[]): [number, number][] {
  const line: [number, number][] = [];
  for (let i = 0; i < arcs.length; i++) {
    const piece = decodeArc(topology, arcs[i]);
    if (i === 0) line.push(...piece);
    else line.push(...piece.slice(1));
  }
  return line;
}

export function topologyGeometry(topology: Topology, objectName: string): GeoJSON.Geometry | null {
  const object = topology.objects[objectName];
  return object ? toGeometry(topology, object) : null;
}

function toGeometry(topology: Topology, object: TopoGeometry): GeoJSON.Geometry | null {
  switch (object.type) {
    case "Polygon":
      return { type: "Polygon", coordinates: object.arcs.map((ring) => stitch(topology, ring)) };
    case "MultiPolygon":
      return {
        type: "MultiPolygon",
        coordinates: object.arcs.map((polygon) => polygon.map((ring) => stitch(topology, ring))),
      };
    case "LineString":
      return { type: "LineString", coordinates: stitch(topology, object.arcs) };
    case "MultiLineString":
      return { type: "MultiLineString", coordinates: object.arcs.map((line) => stitch(topology, line)) };
    case "GeometryCollection": {
      const geometries = object.geometries.flatMap((item) => {
        const geometry = toGeometry(topology, item);
        return geometry ? [geometry] : [];
      });
      return { type: "GeometryCollection", geometries };
    }
    default:
      return null;
  }
}
