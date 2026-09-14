# -*- coding: utf-8 -*-
"""Build clean CSV, KML and JSON from the Paige & Perreault (2023) procedural-units workbook."""
import sys, os, json, csv, html, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geocode import Countries

SCRATCH = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import openpyxl

# --- procedural unit columns -> (column, number, label, definition from Table 1) -----------
PU = [
 ("PU.RM",                                  1,  "Heat treatment",             "Heat treatment used to improve flake-ability"),
 ("PU.facetting",                           2,  "Platform faceting",          "Platform morphology modified by striking flakes across platform"),
 ("PU.faceshaping.rad.",                    3,  "Centripetal shaping",        "Convexities maintained through centripetal removals"),
 ("PU.lat.trimming",                        4,  "Lateral shaping",            "Flakes struck from lateral margins of core to maintain convexities"),
 ("PU.dist.trimming",                       5,  "Distal shaping",             "Convexities maintained through flakes struck from distal edge of core"),
 ("PU.back.shaping",                        6,  "Back shaping",               "Back of the core is shaped"),
 ("PU.cresting",                            7,  "Cresting",                   "Cresting to shape core face during initial steps of core preparation"),
 ("PU.debord",                              8,  "Debordante shaping",         "Convexities maintained through flakes along lateral margins of core face"),
 ("PU.overshot",                            9,  "Overshot flaking",           "Invasive flake removals that clip or remove the distal margin of the core"),
 ("PU.kombewa",                            10,  "Kombewa flaking",            "Removal of flake from ventral surface of a flake"),
 ("PU.tablet",                             11,  "Core tablet",                "Removal of core platform by striking flake into face"),
 ("PU.abrasion",                           12,  "Abrasion",                   "Abrasion or grinding performed at any point in reduction sequence"),
 ("PU.overhang",                           13,  "Trimming platform overhang", "Removal of chips to modify area below platform"),
 ("PU.hard.hammer.percussion",             14,  "Hard hammer percussion",     "Use of hard hammer"),
 ("PU.use.of.hand.to.support.percussed.object",  15, "Support core with hand", "Support of core by hand"),
 ("PU.use.of.anvil.to.support.percussed.object", 16, "Use of an anvil",        "Use of an anvil"),
 ("PU.core.rotation",                      17,  "Core rotation",              "Rotation of core"),
 ("PU.Soft",                               18,  "Soft hammer percussion",     "Use of a soft hammer"),
 ("PU.indirect",                           19,  "Indirect percussion",        "Use of a punch to remove flakes"),
 ("PU.Flaking.through.pressure",           20,  "Flaking through pressure",   "Removal of flakes through application of pressure on core platform"),
 ("PU.pecking",                            21,  "Hammer dressing",            "Modification of a piece through pecking"),
 ("PU.invasive",                           22,  "Invasive flaking",           "Removal of non-cortical flakes that extend beyond the midpoint of the piece"),
 ("PU.ochre",                              23,  "Ochre use",                  "Use of ochre"),
 ("PU.asphalt",                            24,  "Asphalt use",                "Use of asphalt"),
 ("PU.retouch",                            25,  "Retouch",                    "Retouch of flake or core tool (unifacial only)"),
 ("PU.backing",                            26,  "Backing",                    "Retouch forms an abrupt, scraper-like margin"),
 ("PU.notching",                           27,  "Notching",                   "Retouch forms round concavity"),
 ("PU.burin",                              28,  "Burination",                 "Removal of spalls along the margins of flakes"),
 ("PU.tang",                               29,  "Tanging",                    "Retouching base of piece to form a tang"),
 ("PU.tranchet",                           30,  "Tranchet",                   "Rejuvenation of core tool by striking a flake across the edge"),
 ("PU.rt.bif",                             31,  "Bifacial retouch",           "Retouch on both faces of a flake or core-tool"),
 ("PU.rt.invasive",                        32,  "Invasive retouch",           "Retouch that extends to the midline of a tool"),
 ("PU.rt..pressure.flake",                 33,  "Pressure flaked retouch",    "Pressure flaking retouch"),
]


def key_for(n, label):
    """Stable machine key used in the CSV header and the web app."""
    slug = label.lower().replace(" ", "_").replace("-", "_")
    return "pu%02d_%s" % (n, slug)


PU_KEYS = [key_for(n, lab) for (_c, n, lab, _d) in PU]

GROUPS = collections.OrderedDict([
    ("Core preparation & management", [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
    ("Percussion technique",          [14, 15, 16, 17, 18, 19, 20, 21, 22]),
    ("Raw material & additives",      [1, 23, 24]),
    ("Retouch & tool shaping",        [25, 26, 27, 28, 29, 30, 31, 32, 33]),
])
GROUP_OF = {n: g for g, nums in GROUPS.items() for n in nums}

PRIMATES = ("S. libidinosus", "P. troglodytes", "M. fascicularis aurea")

# ---------------------------------------------------------------------------
# Technology (INTERPRETED - not part of the published dataset)
#
# Paige & Perreault code procedural units, not technocomplexes. Only four rows
# name an industry at all in the free-text Descr. field ("Oldowan" at EG12 and
# NY 18 Nyabusosi, "Acheulean handaxe" in the Moore & Perston experiment).
# Everything else here is attributed from the site, its published age and the
# coder's description of the artefacts.
#
#   Lomekwian           Harmand et al. named the Lomekwi 3 industry; explicitly
#                       pre-Oldowan.
#   Oldowan             Canonical Oldowan localities, or the Descr. says so.
#   Oldowan (probable)  Attribution contested or the entry describes only part
#                       of the assemblage.
#   Acheulean           Canonical Acheulean localities whose Descr. names a
#                       diagnostic large cutting tool, handaxe or cleaver.
#   Acheulean (probable)Same, but the attribution is argued rather than settled.
#   Other               Everything else - including assemblages that contain
#                       bifaces but are not Acheulean (Acheulo-Yabrudian at
#                       Qesem, Fauresmith at Kathu Pan 1, Nor Geghi 1), all MSA
#                       / Upper Palaeolithic / Holocene entries, and primate
#                       tool use.
#
# Keyed by row id (1-based, matching the workbook order).
# ---------------------------------------------------------------------------
TECHNOLOGY = {}


def _tag(label, ids):
    for i in ids:
        TECHNOLOGY[i] = label


_tag("Lomekwian", [25, 26])                               # Lomekwi 3, 3.3 Ma
_tag("Oldowan", [
    93, 94,      # Bokol Dora 1 - Braun et al. 2019, "earliest known Oldowan"
    6, 7, 8,     # EG12, Gona - Descr. says "Oldowan"
    27, 28,      # Lokalalei 2c - Delagnes & Roche 2005
    29, 30,      # Kanjera - Plummer & Bishop 2016
    57, 58,      # NY 18 Nyabusosi - Descr. says "Oldowan"
])
_tag("Oldowan (probable)", [31, 32])                      # Olduvai Bed II BK
_tag("Acheulean", [
    49, 50,      # RHS-Mugulud, Peninj - "large cutting tool"
    33,          # Olorgesailie - "biface with invasive scarring"
    21,          # Canteen Koppie - Victoria West cleaver
    18, 19, 20,  # Gesher Benot Ya'aqov - "handaxes from kombewa flakes"
    55, 56,      # Hugub KK51 - "large cutting tool on a flake"
    37,          # Boxgrove - "handaxes with tranchet sharpening"
    51, 52,      # Torre in Pietra level M - "large cutting tool"
])
_tag("Acheulean (probable)", [
    45, 46,      # Garba IVd - the contested ~1.7 Ma "older origin" case
    100,         # Moore & Perston experimental Acheulean handaxe (a replication,
                 # not an assemblage; entry_type marks it Experimental)
])

TECHNOLOGY_ORDER = ["Lomekwian", "Oldowan", "Oldowan (probable)",
                    "Acheulean", "Acheulean (probable)", "Other"]

# Reference photographs, from Wikimedia Commons. Both are of artefacts from the
# type sites of their industry. Attribution is required by both licences and is
# rendered with every appearance of the image.
#
# There is deliberately no Lomekwian photograph: no freely-licensed image of a
# Lomekwi 3 artefact exists on Wikimedia (searched Commons for Lomekwi,
# Lomekwian, West Turkana and Harmand). The only published photographs are the
# copyrighted figures in Harmand et al. 2015, so that card says so instead of
# showing something misleading.
TECHNOLOGY_IMAGES = {
    "Lomekwian": {
        "image": None,
        "caption": "No freely-licensed photograph of a Lomekwi 3 artefact exists — the "
                   "published images are copyrighted. These pages show and explain them.",
        "links": [
            {"url": "https://becominghuman.org/pathways-to-discovery/the-fossil-record/"
                    "archaeology-tools-and-artifacts/lithics-lomekwi-and-dikika/",
             "text": "See the tools: Becoming Human (Institute of Human Origins, ASU)"},
            {"url": "https://doi.org/10.1038/nature14464",
             "text": "Original paper: Harmand et al. 2015, Nature"},
        ],
    },
    "Oldowan": {
        "image": "assets/img/oldowan-chopper.jpg",
        "alt": "A rounded volcanic cobble with several large flakes struck from one edge, "
               "forming an irregular chopping edge, displayed on a museum mount.",
        "caption": "Oldowan chopper from Olduvai Gorge, Tanzania, c. 1.8 Ma. "
                   "British Museum.",
        "credit": "Archaeomoonwalker",
        "licence": "CC BY 3.0",
        "licence_url": "https://creativecommons.org/licenses/by/3.0",
        "source": "https://commons.wikimedia.org/wiki/File:Olduvai_Chopper.JPG",
    },
    "Acheulean": {
        "image": "assets/img/acheulean-biface.jpg",
        "alt": "A teardrop-shaped flint handaxe worked over both faces to a symmetrical "
               "point, with a 19th-century oval collection label reading St Acheul.",
        "caption": "Acheulean biface from Saint-Acheul, France, c. 500-300 ka — the "
                   "type site of the Acheulean. Muséum de Toulouse.",
        "credit": "Didier Descouens",
        "licence": "CC BY-SA 4.0",
        "licence_url": "https://creativecommons.org/licenses/by-sa/4.0",
        "source": "https://commons.wikimedia.org/wiki/File:Biface_de_St_Acheul_MHNT.jpg",
    },
}
# the "(probable)" values borrow their parent industry's photograph
TECHNOLOGY_IMAGE_OF = {
    "Lomekwian": "Lomekwian",
    "Oldowan": "Oldowan",
    "Oldowan (probable)": "Oldowan",
    "Acheulean": "Acheulean",
    "Acheulean (probable)": "Acheulean",
}


def norm_species(s):
    s = (s or "").strip()
    if s in ("", "None"):
        return "Not applicable (experimental)"
    return "Unattributed" if s == "?" else s


def entry_type(arch, species):
    if str(arch) == "1":
        return "Archaeological"
    return "Primate" if species in PRIMATES else "Experimental"


def demojibake(s):
    """The workbook holds some UTF-8 text that was decoded as cp1252 somewhere upstream
    (â€™ for ', Ã© for e-acute). Round-trip it back where that is lossless."""
    if not any(ch in s for ch in ("Â", "Ã", "â")):
        return s
    try:
        fixed = s.encode("cp1252", errors="strict").decode("utf-8", errors="strict")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s
    return fixed


def clean(v):
    if not isinstance(v, str):
        return v
    v = demojibake(v)
    # an orphaned Â (the lead byte of a mangled nbsp) survives the round-trip; drop it
    v = v.replace("Â\xa0", " ").replace("Â ", " ").replace("Â", "")
    return (v.replace("\xa0", " ")
             .replace("’", "'")
             .replace("“", '"').replace("”", '"')
             .strip())


def main():
    countries = Countries(os.path.join(SCRATCH, "countries50.geojson"))
    wb = openpyxl.load_workbook(os.path.join(ROOT, "procedural units obfus.xlsx"), data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    hdr = rows[0]
    raw = [r for r in rows[1:] if any(c is not None for c in r)]
    idx = {h: i for i, h in enumerate(hdr)}

    recs = []
    for i, r in enumerate(raw):
        def g(col):
            return clean(r[idx[col]])

        lat, lon = g("Lat"), g("Long")
        has_xy = isinstance(lat, (int, float)) and isinstance(lon, (int, float))
        country = iso = continent = None
        approx = False
        if has_xy:
            f, _ = countries.lookup(lon, lat)
            if f is None:
                f, _dist = countries.nearest(lon, lat)
                approx = True
            if f:
                country, iso, continent = f["name"], f["iso"], f["continent"]

        ky, ko = g("KA.young"), g("KA.old")
        ky = ky if isinstance(ky, (int, float)) else None
        ko = ko if isinstance(ko, (int, float)) else None
        sc = str(g("Single.Chain") or "").strip().lower()

        pus = {}
        for (col, n, lab, _d) in PU:
            pus[key_for(n, lab)] = 1 if r[idx[col]] == 1 else 0

        rec = {
            "id": i + 1,
            "source": g("Source") or "",
            "site": g("Sitename") or "",
            "description": g("Descr.") or "",
            "species": norm_species(g("Species.attribution")),
            "technology": TECHNOLOGY.get(i + 1, "Other"),
            "entry_type": entry_type(g("Arch"), g("Species.attribution")),
            "single_chain": "Single sequence" if sc == "yes" else "Whole assemblage",
            "country": country,
            "iso_a2": iso,
            "continent": continent,
            "country_approx": 1 if approx else 0,
            "lat": round(lat, 6) if has_xy else None,
            "lon": round(lon, 6) if has_xy else None,
            "ka_young": ky,
            "ka_old": ko,
            "ka_mid": round((ky + ko) / 2.0, 4) if (ky is not None and ko is not None) else None,
            "date_citation": g("date.citation") or "",
            "pu_count": sum(pus.values()),
        }
        rec.update(pus)
        recs.append(rec)

    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)

    cols = ["id", "source", "site", "description", "species", "technology",
            "entry_type", "single_chain",
            "country", "iso_a2", "continent", "country_approx", "lat", "lon",
            "ka_young", "ka_old", "ka_mid", "date_citation", "pu_count"] + PU_KEYS
    csv_path = os.path.join(ROOT, "data", "stone_tools.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        for rec in recs:
            w.writerow({c: ("" if rec[c] is None else rec[c]) for c in cols})

    # Which industry does each technique first show up in, across the
    # Lomekwian -> Oldowan -> Acheulean sequence? Derived from the records, so it
    # tracks the Technology attribution rather than being hand-listed.
    seq = [("Lomekwian", ["Lomekwian"]),
           ("Oldowan", ["Oldowan", "Oldowan (probable)"]),
           ("Acheulean", ["Acheulean", "Acheulean (probable)"])]
    buckets = [(name, [r for r in recs if r["technology"] in vals]) for name, vals in seq]
    technique_industry = {}
    for key in PU_KEYS:
        technique_industry[key] = next(
            (name for name, rows in buckets if any(r[key] == 1 for r in rows)), None)

    meta = {
        "citation": {
            "authors": "Paige, J. and Perreault, C.",
            "year": 2023,
            "title": "A Dataset Describing the Manufacturing of Stone Tools Over 3 Million Years",
            "journal": "Journal of Open Archaeology Data",
            "volume": "11",
            "article": "12",
            "pages": "1-7",
            "doi": "10.5334/joad.114",
            "url": "https://doi.org/10.5334/joad.114",
            "data_doi": "10.5281/zenodo.7847839",
            "data_url": "https://doi.org/10.5281/zenodo.7847839",
            "codebook_doi": "10.5281/zenodo.7847876",
            "codebook_url": "https://doi.org/10.5281/zenodo.7847876",
            "license": "CC BY 4.0",
            "license_url": "https://creativecommons.org/licenses/by/4.0/",
            "published": "30 November 2023",
            "pdf": "Paige_Perreault_2023_DatasetManufacture.pdf",
        },
        "procedural_units": [
            {"key": key_for(n, lab), "n": n, "label": lab, "definition": d, "group": GROUP_OF[n]}
            for (_c, n, lab, d) in PU
        ],
        "groups": list(GROUPS.keys()),
        "technology_order": TECHNOLOGY_ORDER,
        "technique_industry": technique_industry,
        "industry_sequence": ["Lomekwian", "Oldowan", "Acheulean"],
        "technology_images": TECHNOLOGY_IMAGES,
        "technology_image_of": TECHNOLOGY_IMAGE_OF,
        "n_records": len(recs),
    }
    with open(os.path.join(ROOT, "data", "stone_tools.json"), "w", encoding="utf-8") as fh:
        json.dump({"meta": meta, "records": recs}, fh, ensure_ascii=False, separators=(",", ":"))

    write_kml(os.path.join(ROOT, "stone_tools.kml"), recs, meta)

    print("records: %d | with coordinates: %d" % (len(recs), sum(1 for r in recs if r["lat"] is not None)))
    print("countries: %d" % len({r["country"] for r in recs if r["country"]}))
    for k in ("continent", "entry_type", "technology"):
        print("%-11s %s" % (k, dict(collections.Counter(r[k] for r in recs).most_common())))
    print("country resolved by nearest coastline: %d" % sum(1 for r in recs if r["country_approx"]))


# ---------------------------- KML ----------------------------
STYLES = [
    ("arch", "Archaeological", "ffe86f3b", "http://maps.google.com/mapfiles/kml/paddle/blu-circle.png"),
    ("prim", "Primate",        "ff47a043", "http://maps.google.com/mapfiles/kml/paddle/grn-circle.png"),
    ("exp",  "Experimental",   "ff2b9df5", "http://maps.google.com/mapfiles/kml/paddle/ylw-circle.png"),
]
STYLE_ID = {"Archaeological": "arch", "Primate": "prim", "Experimental": "exp"}


def esc(s):
    return html.escape("" if s is None else str(s), quote=False)


def fmt_ka(v):
    if v is None:
        return "?"
    if v >= 1000:
        return "{:,.0f}".format(v)
    if v >= 10:
        return "{:.0f}".format(v)
    return ("%g" % v)


def age_label(r):
    if r["ka_young"] is None or r["ka_old"] is None:
        return "not reported"
    return "%s - %s ka" % (fmt_ka(r["ka_old"]), fmt_ka(r["ka_young"]))


def write_kml(path, recs, meta):
    c = meta["citation"]
    pu_lookup = {p["key"]: p for p in meta["procedural_units"]}
    out = []
    A = out.append
    A('<?xml version="1.0" encoding="UTF-8"?>')
    A('<kml xmlns="http://www.opengis.net/kml/2.2">')
    A('<Document>')
    A('  <name>Stone Tool Manufacturing Techniques over 3 Million Years</name>')
    doc_desc = (
        "Archaeological assemblages, primate tool use and flintknapping experiments coded for "
        "33 stone-tool-making procedural units (techniques).<br/><br/>"
        "<b>Source:</b> %s %d. <i>%s</i>. %s %s(%s): %s. "
        '<a href="%s">%s</a><br/>'
        "<b>License:</b> CC BY 4.0<br/><br/>"
        "<b>Note:</b> site coordinates in this release are approximate. Country labels were "
        "derived from those coordinates and are not part of the published dataset."
        % (c["authors"], c["year"], c["title"], c["journal"], c["volume"], c["article"],
           c["pages"], c["url"], c["doi"]))
    A('  <description><![CDATA[%s]]></description>' % doc_desc)
    A('  <open>1</open>')
    for sid, _label, colour, icon in STYLES:
        A('  <Style id="%s">' % sid)
        A('    <IconStyle><color>%s</color><scale>1.05</scale><Icon><href>%s</href></Icon></IconStyle>'
          % (colour, icon))
        A('    <LabelStyle><scale>0.8</scale></LabelStyle>')
        A('    <BalloonStyle><text><![CDATA[$[description]]]></text></BalloonStyle>')
        A('  </Style>')

    for sid, label, _c, _i in STYLES:
        sel = [r for r in recs if r["entry_type"] == label and r["lat"] is not None]
        if not sel:
            continue
        A('  <Folder><name>%s (%d)</name><open>0</open>' % (esc(label), len(sel)))
        by_country = collections.OrderedDict()
        for r in sorted(sel, key=lambda x: (x["country"] or "zz", x["site"])):
            by_country.setdefault(r["country"] or "Unknown", []).append(r)
        for country, group in by_country.items():
            A('    <Folder><name>%s (%d)</name><open>0</open>' % (esc(country), len(group)))
            for r in group:
                A(placemark(r, pu_lookup))
            A('    </Folder>')
        A('  </Folder>')

    unmapped = [r for r in recs if r["lat"] is None]
    if unmapped:
        lines = "<br/>".join(esc("%s - %s (%s)" % (r["site"], r["source"], r["species"]))
                             for r in unmapped)
        A('  <Folder><name>No coordinates reported (%d)</name><open>0</open>' % len(unmapped))
        A('    <description><![CDATA[These %d entries (primate tool use and flintknapping '
          'experiments) carry no coordinates in the source dataset and cannot be mapped.<br/><br/>%s]]>'
          '</description>' % (len(unmapped), lines))
        A('  </Folder>')
    A('</Document>')
    A('</kml>')
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out))


def placemark(r, pu_lookup):
    present = [pu_lookup[k]["label"] for k in PU_KEYS if r[k] == 1]
    fields = [
        ("Site", r["site"]),
        ("Country", (r["country"] or "-") + (" (nearest, approx.)" if r["country_approx"] else "")),
        ("Entry type", r["entry_type"]),
        ("Species attribution", r["species"]),
        ("Technology (interpreted)", r["technology"]),
        ("Age", age_label(r)),
        ("Basis for date", r["date_citation"] or "-"),
        ("Scope of entry", r["single_chain"]),
        ("Technology described", r["description"] or "-"),
        ("Published source", r["source"]),
        ("Techniques recorded", "%d of 33" % r["pu_count"]),
    ]
    tbl = "".join(
        '<tr><td style="padding:2px 10px 2px 0;vertical-align:top;white-space:nowrap">'
        '<b>%s</b></td><td style="padding:2px 0">%s</td></tr>' % (esc(k), esc(v))
        for k, v in fields)
    desc = ('<div style="font:13px/1.45 Helvetica,Arial,sans-serif;max-width:400px">'
            '<table>%s</table>'
            '<p style="margin:10px 0 3px"><b>Procedural units present</b></p>'
            '<p style="margin:0">%s</p></div>') % (tbl, esc(", ".join(present)) or "none recorded")
    ext = "\n".join('        <Data name="%s"><value>%d</value></Data>'
                    % (esc(pu_lookup[k]["label"]), r[k]) for k in PU_KEYS)
    return ('    <Placemark>\n'
            '      <name>%s</name>\n'
            '      <styleUrl>#%s</styleUrl>\n'
            '      <description><![CDATA[%s]]></description>\n'
            '      <ExtendedData>\n'
            '        <Data name="Source"><value>%s</value></Data>\n'
            '        <Data name="Species"><value>%s</value></Data>\n'
            '        <Data name="Technology"><value>%s</value></Data>\n'
            '        <Data name="Country"><value>%s</value></Data>\n'
            '        <Data name="Entry type"><value>%s</value></Data>\n'
            '        <Data name="KA young"><value>%s</value></Data>\n'
            '        <Data name="KA old"><value>%s</value></Data>\n'
            '        <Data name="Technique count"><value>%d</value></Data>\n'
            '%s\n'
            '      </ExtendedData>\n'
            '      <Point><coordinates>%.6f,%.6f,0</coordinates></Point>\n'
            '    </Placemark>'
            % (esc(r["site"]), STYLE_ID[r["entry_type"]], desc, esc(r["source"]),
               esc(r["species"]), esc(r["technology"]), esc(r["country"]),
               esc(r["entry_type"]),
               esc(r["ka_young"]), esc(r["ka_old"]), r["pu_count"], ext,
               r["lon"], r["lat"]))


if __name__ == "__main__":
    main()
