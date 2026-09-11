"""Assign country + continent to each record by point-in-polygon against Natural Earth 50m."""
import json, math, sys

GEO = sys.argv[1]

def rings_of(geom):
    t, c = geom['type'], geom['coordinates']
    if t == 'Polygon':
        return [c]
    if t == 'MultiPolygon':
        return list(c)
    return []

def pt_in_ring(x, y, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-300) + xi):
            inside = not inside
        j = i
    return inside

def pt_in_poly(x, y, poly):
    if not poly or not pt_in_ring(x, y, poly[0]):
        return False
    for hole in poly[1:]:
        if pt_in_ring(x, y, hole):
            return False
    return True

class Countries:
    def __init__(self, path):
        d = json.load(open(path, encoding='utf-8'))
        self.feats = []
        for f in d['features']:
            p = f['properties']
            polys = rings_of(f['geometry'])
            if not polys:
                continue
            # bbox per polygon for fast rejection
            entries = []
            for poly in polys:
                xs = [c[0] for c in poly[0]]
                ys = [c[1] for c in poly[0]]
                entries.append((min(xs), min(ys), max(xs), max(ys), poly))
            self.feats.append({
                'name': p.get('NAME_EN') or p.get('NAME'),
                'iso': p.get('ISO_A2_EH') or p.get('ISO_A2'),
                'continent': p.get('CONTINENT'),
                'subregion': p.get('SUBREGION'),
                'polys': entries,
            })

    def lookup(self, lon, lat):
        for f in self.feats:
            for (x0, y0, x1, y1, poly) in f['polys']:
                if x0 <= lon <= x1 and y0 <= lat <= y1 and pt_in_poly(lon, lat, poly):
                    return f, 0.0
        return None, None

    def nearest(self, lon, lat):
        """Fallback: nearest vertex on any country outline (for coastal/offshore points)."""
        best, bestd = None, 1e18
        latr = math.radians(lat)
        for f in self.feats:
            for (x0, y0, x1, y1, poly) in f['polys']:
                # cheap bbox distance prefilter
                dx = max(x0 - lon, 0, lon - x1) * math.cos(latr) * 111.32
                dy = max(y0 - lat, 0, lat - y1) * 110.57
                if dx * dx + dy * dy > bestd:
                    continue
                for ring in poly:
                    for cx, cy in ring:
                        ddx = (cx - lon) * math.cos(latr) * 111.32
                        ddy = (cy - lat) * 110.57
                        d = ddx * ddx + ddy * ddy
                        if d < bestd:
                            bestd, best = d, f
        return best, math.sqrt(bestd)

if __name__ == '__main__':
    C = Countries(GEO)
    print('loaded', len(C.feats), 'countries')
