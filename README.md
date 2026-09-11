# Stone Tool Manufacturing Explorer

An interactive teaching page for **Paige & Perreault (2023)**, a dataset describing how stone
tools were made across 3 million years of hominin evolution. Students can query the dataset by
species, country and manufacturing technique, and read the result as a chart, a map or a table.
No account or login is needed — it is a static site.

**Live site:** https://<your-github-username>.github.io/<repository-name>/

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

Each of the 155 rows is **one technology or one set of technologies** reported in a publication
— not one artefact and not one site. Every row is coded for the presence or absence of the same
33 *procedural units* (manufacturing steps).

- 145 archaeological entries, drawn from 100 sites
- 5 non-human primate tool-making behaviours
- 5 technologies produced in controlled flintknapping experiments
- Coverage: ~3.3 million years ago to the 19th century AD

---

## Files

| Path | What it is |
|---|---|
| `index.html`, `assets/` | The site itself |
| `data/stone_tools.csv` | Tidied dataset, one row per entry, 33 technique columns |
| `data/stone_tools.json` | The same data plus the codebook; what the page loads |
| `stone_tools.kml` | All 145 mapped entries for Google Earth or QGIS |
| `Paige_Perreault_2023_DatasetManufacture.pdf` | The published paper |
| `procedural units obfus.xlsx` | The source workbook, unmodified |
| `build/` | The scripts that regenerate the CSV, JSON and KML |

### The KML

`stone_tools.kml` opens in Google Earth, QGIS or ArcGIS. Placemarks are foldered by entry type
and then by country, and each carries the full record — age, species, technology description,
reference, and all 33 techniques as `ExtendedData` fields, so it can be styled or queried on any
of them.

---

## Two things the page adds to the published data

Both are flagged in the app's *Citation & notes* tab, and neither is the authors' work:

1. **Country and region** are not in the published dataset. They were derived here by testing
   each site's coordinates against Natural Earth country boundaries (1:50m). Nineteen sites fall
   just offshore of that coastline and were assigned to the nearest country; those are marked
   `country_approx` in the CSV and *approx.* in the app.
2. **Some text was repaired.** A handful of cells in the workbook contained UTF-8 that had been
   decoded as cp1252 somewhere upstream (`â€™` where `’` was meant). The build re-encodes these
   where the round-trip is lossless and leaves the text otherwise untouched.

Site coordinates in this release of the workbook are **approximate** — they show the right
region but not an exact findspot.

---

## Teaching notes

Worth saying out loud to a class, because the dataset rewards care:

- **"Technique" is not "tool type."** The 33 columns record *how* a tool was made — faceting a
  platform, striking a burin spall, retouching a tang — not named typologies like "handaxe" or
  "Levallois point." The *Technology described* field often names those, in the coder's words.
- **A 0 means "not reported," not "did not happen."** Richer and better-published assemblages
  show more techniques. The authors note that common practices such as bipolar percussion are
  probably under-represented.
- **Modern borders are a poor fit for deep prehistory.** Country is a search convenience, not an
  analytical unit.
- **Coverage follows the literature,** so it is patchy rather than a sample of everything that exists.
- The *Techniques used vs. age* chart trends upward. Some of that is real cumulative culture and
  some is preservation and reporting bias — a good argument to have in class.

---

## Publishing to GitHub Pages

1. Create a repository on GitHub and push this folder to it.
2. In the repository, go to **Settings → Pages**.
3. Under *Build and deployment*, set **Source** to `Deploy from a branch`, pick the `main`
   branch and the `/ (root)` folder, and save.
4. Wait a minute, then open `https://<username>.github.io/<repository>/`.

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
