# Stone Tool Manufacturing Explorer

An interactive teaching page for **Paige & Perreault (2023)**, a dataset describing how stone
tools were made across 3 million years of hominin evolution. Students can query the dataset by
species, country and manufacturing technique, and read the result as a chart, a map or a table.
This was purposefully designed to be an open, static site, so no login is required. As such, no copyrighted images are presented, and I am linking out to images wherever necessary.

**Live site:** <https://nsusmann.github.io/anth5a_demo_toolmap/>

> **Disclaimer.** This tool was created by Dr. Natalie Susmann for the sole purpose of an
> in-class exercise. It is for demonstration purposes only and should not be used in lieu of the
> original publication. Please refer to the original publication for any research, and give
> credit to the original authors:
>
> Paige, J. and Perreault, C. 2023. A Dataset Describing the Manufacturing of Stone Tools Over
> 3 Million Years. *Journal of Open Archaeology Data*, 11: 12, pp. 1–7.
> DOI: <https://doi.org/10.5334/joad.114>

---

---

## Notes for students

- **"Technique" is not "tool type."** The 33 columns record *how* a tool was made: faceting a
  platform, striking a burin spall, retouching a tang, etc. These are not named typologies like "handaxe" or
  "Levallois point." The *Technology described* field often names those, in my words.
- **A 0 means "not reported," not "did not happen."** Richer and better-published assemblages
  show more techniques. Paige and Perreault (2023) note that common practices such as bipolar percussion are
  probably under-represented.
- **Borders are not dynamic** The borders shown here are based on 2026 data. 
- **Dataset coverage is limited to a single publication** and not representative of the full
  scope of what's known, nor what likely happened.
- Be critical of trends you find, in light of all the limitations I have disclosed. For example: *Techniques used vs. age* chart trends upward -- how might you push back on that observation?

The most useful sections for you to check out are [The data](#the-data) and
[What Professor Susmann Tweaked](#what-professor-susmann-tweaked).

---

## The data

> Paige, J. and Perreault, C. 2023. A Dataset Describing the Manufacturing of Stone Tools Over
> 3 Million Years. *Journal of Open Archaeology Data*, 11: 12, pp. 1–7.
> DOI: <https://doi.org/10.5334/joad.114>

| | |
|---|---|
| Article DOI | [10.5334/joad.114](https://doi.org/10.5334/joad.114) |
| Dataset DOI | [10.5281/zenodo.7847839](https://doi.org/10.5281/zenodo.7847839) |
| Codebook DOI | [10.5281/zenodo.7847876](https://doi.org/10.5281/zenodo.7847876) |
| Licence | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

The paper is redistributed here as `Paige_Perreault_2023_DatasetManufacture.pdf` under that
licence. **Credit the authors in any reuse.** This teaching page is not affiliated with the
authors or with the *Journal of Open Archaeology Data*.

Each of the 155 rows is **one technology or set of technologies** reported in a publication by another author, and these were gathered by Paige and Perreault into one geolocated dataset. The dataset is **not** one artefact or site per row. Every row is coded for the presence or absence of the same
33 *procedural units* (manufacturing steps).

- 145 archaeological entries, drawn from 100 sites
- 5 non-human primate tool-making behaviours
- 5 technologies produced in controlled flintknapping experiments (i.e., experimental archaeology)
- Coverage: ~3.3 million years ago to the 19th century CE

Sections of the visualizer use a color-coding system to help highlight techniques relevant
to our course. In the "Chart" tab above, make sure you read the note underneath the graph.

---

## What Professor Susmann Tweaked

All are flagged in the app's *Citation & notes* tab, and none is the authors' work:

1. **Technology** (industry attribution) is not in the published dataset. Paige & Perreault code
   procedural units. Only four of the original 155 rows were associated with a particular industry. Dr. Susmann attributed the rest, whenever possible, referring to the original publications. They were based on the site, published age, and description of the artifacts. Students should recognize that this is for an **in-class demo only** and there are likely cases where multiple technologies were present at the location. Decisions had to be made for the purpose of this tool, and a best-fit was made when possible. If not possible, I skipped it. Since this dataset is not per site or per artifact, too many of them could not be associated cleanly with one technology-type, which is why 125 are in the "other" category. 

   | Value | n | What it means |
   |---|---|---|
   | Lomekwian | 2 | Lomekwi 3, 3.3 Ma. These are pre-Oldowan |
   | Oldowan | 11 | Bokol Dora 1, EG12/Gona, Lokalalei 2c, Kanjera, NY 18 Nyabusosi |
   | Oldowan (probable) | 2 | Olduvai Bed II BK — usually Developed Oldowan. Here, they are defined as having no bifacial retouch |
   | Acheulean | 12 | Peninj, Olorgesailie, Canteen Koppie, Gesher Benot Ya'aqov, Hugub, Boxgrove, Torre in Pietra M |
   | Acheulean (probable) | 3 | Garba IVd (the contested ~1.7 Ma early-Acheulean claim) and one experimental handaxe replication |
   | Other | 125 | Everything else |

   **`Other` is not always `unknown`.** It includes assemblages that contain bifaces without being
   Acheulean — the Acheulo-Yabrudian at Qesem Cave, the Fauresmith at Kathu Pan 1, and Nor
   Geghi 1. The full reasoning, entry by entry, is commented in `build/build_data.py`.

   One result falls straight out of the coding: **bifacial retouch is recorded in
   0 of the 15 Lomekwian and Oldowan entries, and in 10 of the 12 Acheulean ones.** Set *Chart* to
   *Technique frequency* and *Compare by* to *Technology* to see it.

2. **Country and region** are not in the published dataset. They were derived here by testing
   each site's coordinates against Natural Earth country boundaries (1:50m). Nineteen sites fall
   just offshore of that coastline and were assigned to the nearest country; those are marked
   `country_approx` in the CSV and *approx.* in the app.
3. **Some text was repaired.** A handful of cells in the workbook contained UTF-8 that had been
   decoded as cp1252 somewhere upstream (`â€™` where `’` was meant). The build re-encodes these
   where the round-trip is lossless and leaves the text otherwise untouched.

Site coordinates were give by Paige and Perreault. In this release of the workbook are **approximate** — they show the right
region but not an exact findspot. Students should consider why non-specific coordinates were used.

Ten entries (the primate and experimental ones) have no coordinates at all, so they never
appear on the map, though they do appear in the charts and the table.

### Reference photographs

Two Wikimedia Commons photographs are bundled in `assets/img/` and shown whenever a technology
is on screen — when you filter by Technology, chart by it, or colour the map by it. Both are
artefacts from the **type site** of their industry:

| Industry | Photograph | Credit | Licence |
|---|---|---|---|
| Oldowan | [Olduvai chopper](https://commons.wikimedia.org/wiki/File:Olduvai_Chopper.JPG), Olduvai Gorge, c. 1.8 Ma, British Museum | Archaeomoonwalker | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) |
| Acheulean | [Biface de St Acheul](https://commons.wikimedia.org/wiki/File:Biface_de_St_Acheul_MHNT.jpg), Saint-Acheul, c. 500–300 ka, Muséum de Toulouse | Didier Descouens | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |

Both licences require attribution, which is rendered beside every appearance of the image. The
files were downscaled to 760px for the web.

**There is no Lomekwian photograph.** No freely-licensed image of a Lomekwi 3 artefact exists on
Wikimedia (Commons was searched for *Lomekwi*, *Lomekwian*, *West Turkana* and *Harmand*); the
only published photographs are the copyrighted figures in Harmand et al. 2015. Since this is an open-access tool and not blocked by Brandeis' paywall, I have elected to link out to a page for students to explore a Lomekwi tool photograph. 

- [Becoming Human — Lithics: Lomekwi and Dikika](https://becominghuman.org/pathways-to-discovery/the-fossil-record/archaeology-tools-and-artifacts/lithics-lomekwi-and-dikika/)
  (Institute of Human Origins, ASU), which shows the artefacts and explains how Lomekwian
  knapping differs from Oldowan
- [Harmand et al. 2015, *Nature*](https://doi.org/10.1038/nature14464), the original paper

The `(probable)` values share their parent industry's photograph. In map popups the image is
labelled *reference photograph* and *not an artefact from this site*, because it illustrates the
industry rather than the entry.

### Reading two dimensions at once on the map

The map has **Colour points by** and **Shape points by**. Set them to different fields and each
point encodes both, so you can read an intersection directly — colour by Species and shape by
Technology, and an orange square is *Unattributed × Oldowan* while an orange diamond is
*Unattributed × Acheulean*. Both legends are drawn under the map.

Seven shapes are available (circle, square, triangle, diamond, cross, inverted triangle, and a
hexagon for the overflow), which is about the ceiling at map-marker size. Glyphs are assigned
from the whole dataset rather than from whatever survives the current filter, so a category
keeps the same colour and the same shape no matter how you narrow the query.

Shape also works as a fallback for colour: the pairing stays readable in greyscale, in print, and
for colour-blind readers.

---

## Publishing to GitHub Pages

This repository is already published at <https://nsusmann.github.io/anth5a_demo_toolmap/>,
served from the `main` branch root. Pushing to `main` redeploys it within a minute or two.

To set the same thing up from scratch elsewhere:

1. Create a repository on GitHub and push this folder to it.
2. In the repository, go to **Settings → Pages**.
3. Under *Build and deployment*, set **Source** to `Deploy from a branch`, pick the `main`
   branch and the `/ (root)` folder, and save.

The site is plain HTML, CSS and JavaScript with no build step. Leaflet and Chart.js load from
cdnjs with subresource-integrity hashes; map tiles come from Esri's keyless gray canvas service.
Nothing needs an API key and no one needs an account to view it.

`.nojekyll` is present so GitHub serves every file as-is.

### Running it locally

The page fetches `data/stone_tools.json`, so it needs to be served over http rather than opened
from the filesystem:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

### Rebuilding the data

Only needed if the source workbook changes. Requires `openpyxl` and a Natural Earth countries
file:

```bash
curl -L -o countries50.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
python build/build_data.py .
```

This regenerates `data/stone_tools.csv`, `data/stone_tools.json` and `stone_tools.kml`.

---

## Files

| Path | What it is |
|---|---|
| `index.html`, `assets/` | The site itself |
| `data/stone_tools.csv` | Tidied dataset, one row per entry, 33 technique columns, plus `technology` |
| `data/stone_tools.json` | The same data plus the codebook; what the page loads |
| `stone_tools.kml` | All 145 mapped entries for Google Earth or QGIS |
| `Paige_Perreault_2023_DatasetManufacture.pdf` | The published paper |
| `procedural units obfus.xlsx` | The source workbook, unmodified |
| `assets/img/` | Reference photographs of an Oldowan chopper and an Acheulean biface |
| `build/` | The scripts that regenerate the CSV, JSON and KML |

### The KML

`stone_tools.kml` opens in Google Earth, QGIS or ArcGIS. Placemarks are foldered by entry type
and then by country, and each carries the full record — age, species, technology description,
reference, and all 33 techniques as `ExtendedData` fields, so it can be styled or queried on any
of them.
---

Dr. Natalie Susmann created this tool with the help of Claude Code Opus 5 from September 11,
2026 – September 14, 2026.
