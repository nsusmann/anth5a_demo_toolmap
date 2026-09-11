import sys, openpyxl
sys.path.insert(0, 'build')
from geocode import Countries
SP = sys.argv[1]
C = Countries(SP + '/countries50.geojson')
wb = openpyxl.load_workbook('procedural units obfus.xlsx', data_only=True); ws = wb.active
rows = list(ws.iter_rows(values_only=True)); hdr = rows[0]
data = [r for r in rows[1:] if any(c is not None for c in r)]
idx = {h: i for i, h in enumerate(hdr)}
miss = []
for r in data:
    lat, lon = r[idx['Lat']], r[idx['Long']]
    if not isinstance(lat, (int, float)):
        continue
    f, d = C.lookup(lon, lat)
    if f is None:
        f2, dist = C.nearest(lon, lat)
        miss.append((r[idx['Sitename']], lat, lon, f2['name'] if f2 else None, round(dist, 1)))
print('points needing nearest-fallback:', len(miss))
for m in miss:
    print('   ', m)
