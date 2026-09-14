/* =====================================================================
   Stone Tool Manufacturing Explorer
   Data: Paige & Perreault 2023, J. Open Archaeology Data 11(12), CC BY 4.0
   ================================================================== */
(function () {
  "use strict";

  var DATA = null, META = null, PUS = [], PU_BY_KEY = {};
  var chart = null, map = null, markerLayer = null, mapReady = false;
  var tableSort = { key: "ka_old", dir: -1 };

  var state = {
    species: [], technology: [], country: [], continent: [], technique: [], type: [],
    techMode: "any", ageMin: null, ageMax: null, search: ""
  };

  var $ = function (id) { return document.getElementById(id); };
  var css = function (name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  };
  var SERIES = function () {
    return [1, 2, 3, 4, 5, 6, 7, 8].map(function (i) { return css("--series-" + i); });
  };

  /* ---------- age scale: log slider 0-100 -> ka ---------- */
  var AGE_MIN_KA = 0, AGE_MAX_KA = 3400;
  function sliderToKa(v) {
    v = Number(v);
    if (v <= 0) return 0;
    // log scale from 0.01 ka to 3400 ka, so the Holocene is not squashed
    return Math.round(Math.pow(10, (v / 100) * (Math.log10(AGE_MAX_KA) + 2) - 2) * 1000) / 1000;
  }
  function fmtKa(v) {
    if (v === null || v === undefined) return "?";
    if (v >= 1000) return (v / 1000).toFixed(2).replace(/\.?0+$/, "") + " Ma";
    if (v >= 10) return Math.round(v) + " ka";
    if (v >= 1) return (Math.round(v * 10) / 10) + " ka";
    if (v === 0) return "present";
    return (Math.round(v * 1000) / 1000) + " ka";
  }
  function ageLabel(r) {
    if (r.ka_old === null || r.ka_young === null) return "not reported";
    if (r.ka_old === r.ka_young) return fmtKa(r.ka_old);
    return fmtKa(r.ka_old) + " – " + fmtKa(r.ka_young);
  }

  /* ================================ boot ================================ */
  // Reuse the ?v= stamp on our own <script> tag so a redeploy never serves a stale
  // page against a cached dataset.
  var VERSION = (function () {
    var el = document.currentScript ||
             document.querySelector('script[src*="assets/app.js"]');
    var m = el && /[?&]v=([^&]+)/.exec(el.getAttribute("src") || "");
    return m ? m[1] : "";
  })();

  fetch("data/stone_tools.json" + (VERSION ? "?v=" + VERSION : ""))
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (json) {
      DATA = json.records;
      META = json.meta;
      PUS = META.procedural_units;
      PUS.forEach(function (p) { PU_BY_KEY[p.key] = p; });
      buildFilters();
      buildCodebook();
      wireUp();
      if (typeof Chart === "undefined") {
        $("chartSub").textContent =
          "The charting library could not be loaded from the CDN, so the Chart tab is " +
          "unavailable. The Map and Table tabs still work.";
      }
      render();
      // The map is the default view, so it initialises during first paint.
      // Nudge Leaflet once layout has settled in case it measured too early.
      if (map) {
        requestAnimationFrame(function () { map.invalidateSize(); });
        setTimeout(function () { map.invalidateSize(); fitMap(); }, 250);
      }
    })
    .catch(function (err) {
      $("chartSub").textContent =
        "Could not load data/stone_tools.json (" + err.message +
        "). If you opened this file directly from disk, serve the folder over http instead " +
        "(for example: python -m http.server).";
    });

  /* ============================== filters =============================== */
  function uniq(key, opts) {
    opts = opts || {};
    var counts = {};
    DATA.forEach(function (r) {
      var v = r[key];
      if (v === null || v === "") { if (!opts.keepNull) return; v = "(none)"; }
      counts[v] = (counts[v] || 0) + 1;
    });
    var keys = Object.keys(counts);
    if (opts.order) {
      keys.sort(function (a, b) { return opts.order.indexOf(a) - opts.order.indexOf(b); });
    } else {
      keys.sort(function (a, b) {
        return opts.byCount ? (counts[b] - counts[a] || a.localeCompare(b)) : a.localeCompare(b);
      });
    }
    return keys.map(function (v) { return { value: v, n: counts[v] }; });
  }

  function fillSelect(el, items, labeller) {
    el.innerHTML = "";
    items.forEach(function (it) {
      var o = document.createElement("option");
      o.value = it.value;
      o.textContent = (labeller ? labeller(it) : it.value) + "  (" + it.n + ")";
      el.appendChild(o);
    });
  }

  function buildFilters() {
    fillSelect($("fSpecies"), uniq("species", { byCount: true }));
    fillSelect($("fTechnology"), uniq("technology", { order: META.technology_order }));
    fillSelect($("fCountry"), uniq("country", { byCount: true }));
    fillSelect($("fContinent"), uniq("continent", { byCount: true }));
    fillSelect($("fType"), uniq("entry_type", { byCount: true }));

    var techSel = $("fTechnique");
    techSel.innerHTML = "";
    META.groups.forEach(function (g) {
      var og = document.createElement("optgroup");
      og.label = g;
      PUS.filter(function (p) { return p.group === g; }).forEach(function (p) {
        var n = DATA.reduce(function (a, r) { return a + (r[p.key] === 1 ? 1 : 0); }, 0);
        var ind = META.technique_industry[p.key];
        var o = document.createElement("option");
        o.value = p.key;
        o.textContent = p.label + "  (" + n + ")";
        o.title = p.definition + (ind ? "  |  First appears in the " + ind : "");
        o.style.color = industryColour(ind);
        og.appendChild(o);
      });
      techSel.appendChild(og);
    });

    // a written key, so colour is never the only carrier of meaning
    var ti = META.technique_industry;
    var countFor = function (name) {
      return Object.keys(ti).filter(function (k) { return ti[k] === name; }).length;
    };
    $("techKey").innerHTML =
      META.industry_sequence.map(function (name) {
        return '<span><i style="background:' + industryColour(name) + '"></i>' +
               esc(name) + " (" + countFor(name) + ")</span>";
      }).join("") +
      '<span><i style="background:' + css("--series-other") + '"></i>later / none (' +
      countFor(null) + ")</span>";
  }

  // Industry a technique first appears in, across Lomekwian -> Oldowan -> Acheulean.
  // Slots 1-3 are the trio validated for all-pairs CVD separation; techniques that
  // appear only in later assemblages take the neutral grey.
  function industryColour(name) {
    return { "Lomekwian": css("--series-1"),
             "Oldowan":   css("--series-2"),
             "Acheulean": css("--series-3") }[name] || css("--series-other");
  }

  function readSelect(el) {
    return Array.prototype.filter.call(el.options, function (o) { return o.selected; })
      .map(function (o) { return o.value; });
  }

  function applyFilters() {
    var s = state;
    var q = s.search.trim().toLowerCase();
    return DATA.filter(function (r) {
      if (s.species.length && s.species.indexOf(r.species) < 0) return false;
      if (s.technology.length && s.technology.indexOf(r.technology) < 0) return false;
      if (s.country.length && s.country.indexOf(r.country) < 0) return false;
      if (s.continent.length && s.continent.indexOf(r.continent) < 0) return false;
      if (s.type.length && s.type.indexOf(r.entry_type) < 0) return false;

      if (s.technique.length) {
        if (s.techMode === "all") {
          for (var i = 0; i < s.technique.length; i++) {
            if (r[s.technique[i]] !== 1) return false;
          }
        } else {
          var any = s.technique.some(function (k) { return r[k] === 1; });
          if (!any) return false;
        }
      }

      if (s.ageMin !== null || s.ageMax !== null) {
        if (r.ka_old === null || r.ka_young === null) return false;
        var lo = s.ageMin === null ? -Infinity : s.ageMin;
        var hi = s.ageMax === null ? Infinity : s.ageMax;
        // keep when the entry's own range overlaps the window
        if (r.ka_old < lo || r.ka_young > hi) return false;
      }

      if (q) {
        var hay = (r.site + " " + r.source + " " + r.description + " " +
                   (r.country || "")).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  /* =============================== wiring =============================== */
  function wireUp() {
    [["fSpecies", "species"], ["fTechnology", "technology"],
     ["fCountry", "country"], ["fContinent", "continent"],
     ["fTechnique", "technique"], ["fType", "type"]].forEach(function (pair) {
      $(pair[0]).addEventListener("change", function () {
        state[pair[1]] = readSelect(this);
        render();
      });
    });

    $("fSearch").addEventListener("input", debounce(function () {
      state.search = this.value; render();
    }, 180));

    ["modeAny", "modeAll"].forEach(function (id) {
      $(id).addEventListener("click", function () {
        state.techMode = this.dataset.mode;
        $("modeAny").classList.toggle("is-on", state.techMode === "any");
        $("modeAll").classList.toggle("is-on", state.techMode === "all");
        render();
      });
    });

    var aMin = $("ageMin"), aMax = $("ageMax");
    function onAge() {
      if (Number(aMin.value) > Number(aMax.value)) {
        if (this === aMin) aMax.value = aMin.value; else aMin.value = aMax.value;
      }
      var lo = sliderToKa(aMin.value), hi = sliderToKa(aMax.value);
      var full = Number(aMin.value) === 0 && Number(aMax.value) === 100;
      state.ageMin = full ? null : lo;
      state.ageMax = full ? null : hi;
      $("ageOut").textContent = full ? "all ages" : fmtKa(lo) + " – " + fmtKa(hi) + " ago";
      render();
    }
    aMin.addEventListener("input", onAge);
    aMax.addEventListener("input", onAge);

    $("resetBtn").addEventListener("click", function () {
      ["fSpecies", "fTechnology", "fCountry", "fContinent", "fTechnique", "fType"].forEach(function (id) {
        Array.prototype.forEach.call($(id).options, function (o) { o.selected = false; });
      });
      $("fSearch").value = "";
      aMin.value = 0; aMax.value = 100;
      $("ageOut").textContent = "all ages";
      state = { species: [], technology: [], country: [], continent: [], technique: [], type: [],
                techMode: state.techMode, ageMin: null, ageMax: null, search: "" };
      render();
    });

    // tabs
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (btn) {
      btn.addEventListener("click", function () {
        Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) {
          b.classList.remove("is-on"); b.setAttribute("aria-selected", "false");
        });
        Array.prototype.forEach.call(document.querySelectorAll(".view"), function (v) {
          v.hidden = true;
        });
        btn.classList.add("is-on");
        btn.setAttribute("aria-selected", "true");
        var view = $(btn.getAttribute("aria-controls"));
        view.hidden = false;
        if (btn.id === "tab-map") { ensureMap(); setTimeout(function () { map.invalidateSize(); }, 30); }
        render();
      });
    });

    ["chartKind", "chartBreak", "chartSort"].forEach(function (id) {
      $(id).addEventListener("change", render);
    });
    ["mapColour", "mapShape", "mapSize"].forEach(function (id) {
      $(id).addEventListener("change", render);
    });
    $("fitBtn").addEventListener("click", fitMap);

    $("downloadChart").addEventListener("click", function () {
      if (!chart) return;
      var a = document.createElement("a");
      a.download = "stone-tools-chart.png";
      a.href = chart.toBase64Image("image/png", 1);
      a.click();
    });
    $("downloadCsv").addEventListener("click", downloadCsv);

    // table sorting
    Array.prototype.forEach.call(document.querySelectorAll("#dataTable th[data-sort]"), function (th) {
      th.addEventListener("click", function () {
        var k = th.dataset.sort;
        if (tableSort.key === k) tableSort.dir *= -1;
        else { tableSort.key = k; tableSort.dir = (k === "ka_old" || k === "pu_count") ? -1 : 1; }
        render();
      });
    });

    // citation copying
    Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (btn) {
      btn.addEventListener("click", function () { copyCitation(btn.dataset.copy); });
    });

    // codebook modal
    $("openCodebook").addEventListener("click", function () { $("codebookModal").showModal(); });
    $("closeCodebook").addEventListener("click", function () { $("codebookModal").close(); });

    // theme
    $("themeToggle").addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var next;
      if (cur === "dark") next = "light";
      else if (cur === "light") next = "dark";
      else next = window.matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("stExplorerTheme", next); } catch (e) { /* ignore */ }
      if (map) swapBasemap();
      render();
    });
    try {
      var saved = localStorage.getItem("stExplorerTheme");
      if (saved) document.documentElement.setAttribute("data-theme", saved);
    } catch (e) { /* ignore */ }
  }

  function debounce(fn, ms) {
    var t; return function () {
      var self = this, args = arguments;
      clearTimeout(t); t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /* =============================== render =============================== */
  function render() {
    var rows = applyFilters();

    $("resultCount").innerHTML = "Showing <strong>" + rows.length + "</strong> of " +
      DATA.length + " entries";

    drawTechFigures(rows);

    var active = document.querySelector(".tab.is-on").id;
    if (active === "tab-chart") { if (typeof Chart !== "undefined") drawChart(rows); }
    else if (active === "tab-map") drawMap(rows);
    else if (active === "tab-table") drawTable(rows);
  }

  /* =================== technology reference photographs =================== */
  // Which technologies is the current view actually about? Whatever the user has
  // filtered to; otherwise whatever the active view is keyed on.
  function technologiesInPlay(rows) {
    if (state.technology.length) return state.technology.slice();

    var active = document.querySelector(".tab.is-on").id;
    var keyed = false;
    if (active === "tab-chart") {
      keyed = $("chartKind").value === "technology" || $("chartBreak").value === "technology";
    } else if (active === "tab-map") {
      keyed = $("mapColour").value === "technology";
    }
    if (!keyed) return [];

    // show the industries actually present in the filtered rows, in scheme order
    var present = {};
    rows.forEach(function (r) { present[r.technology] = true; });
    return META.technology_order.filter(function (t) {
      return present[t] && t !== "Other";
    });
  }

  function drawTechFigures(rows) {
    var panel = $("techFigures");
    var wanted = technologiesInPlay(rows);
    // collapse "(probable)" onto the parent industry so the photo is not repeated
    var seen = {}, cards = [];
    wanted.forEach(function (t) {
      var src = META.technology_image_of[t];
      if (!src || seen[src]) return;
      seen[src] = true;
      cards.push(src);
    });

    if (!cards.length) { panel.hidden = true; panel.innerHTML = ""; return; }

    panel.innerHTML = cards.map(function (name) {
      var info = META.technology_images[name];
      var n = rows.filter(function (r) {
        return META.technology_image_of[r.technology] === name;
      }).length;

      var visual = info.image
        ? '<img class="tf-img" src="' + esc(info.image) + '" alt="' + esc(info.alt) + '" loading="lazy">'
        : '<div class="tf-none">' + esc(info.caption) + "</div>";

      var credit;
      if (info.image) {
        credit = 'Photo: ' + esc(info.credit) + ', <a href="' + esc(info.source) +
                 '" target="_blank" rel="noopener">Wikimedia Commons</a>, ' +
                 '<a href="' + esc(info.licence_url) + '" target="_blank" rel="noopener">' +
                 esc(info.licence) + "</a>";
      } else {
        // no usable photograph: point at pages that show the artefacts instead
        credit = (info.links || []).map(function (l) {
          return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
                 esc(l.text) + "</a>";
        }).join("<br>");
      }

      return '<figure class="tech-fig">' + visual +
        '<figcaption><span class="tf-name">' + esc(name) +
        ' <span class="tf-n">' + n + (n === 1 ? " entry" : " entries") + "</span></span>" +
        (info.image ? '<p class="tf-cap">' + esc(info.caption) + "</p>" : "") +
        '<p class="tf-credit">' + credit + "</p></figcaption></figure>";
    }).join("");
    panel.hidden = false;
  }

  function describeQuery() {
    var bits = [];
    if (state.species.length) bits.push(state.species.join(", "));
    if (state.technology.length) bits.push(state.technology.join(", "));
    if (state.country.length) bits.push(state.country.join(", "));
    if (state.continent.length) bits.push(state.continent.join(", "));
    if (state.type.length) bits.push(state.type.join(", "));
    if (state.technique.length) {
      bits.push((state.techMode === "all" ? "all of: " : "any of: ") +
        state.technique.map(function (k) { return PU_BY_KEY[k].label; }).join(", "));
    }
    if (state.ageMin !== null) bits.push(fmtKa(state.ageMin) + "–" + fmtKa(state.ageMax) + " ago");
    if (state.search) bits.push('matching "' + state.search + '"');
    return bits.length ? bits.join(" · ") : "All 155 entries, no filters applied";
  }

  /* =============================== charts =============================== */
  function groupValue(r, key) {
    var v = r[key];
    return (v === null || v === "") ? "Unknown" : v;
  }

  // Technology is an ordered scheme (Lomekwian -> Oldowan -> ... -> Other), so its
  // categories keep that order everywhere instead of being ranked by count.
  function orderFor(key) {
    return key === "technology" ? META.technology_order : null;
  }

  function sortCats(keys, key, counts) {
    var ord = orderFor(key);
    if (ord) {
      return keys.slice().sort(function (a, b) { return ord.indexOf(a) - ord.indexOf(b); });
    }
    return keys.slice().sort(function (a, b) {
      return counts[b] - counts[a] || a.localeCompare(b);
    });
  }

  function topGroups(rows, key, max) {
    var c = {};
    rows.forEach(function (r) { var v = groupValue(r, key); c[v] = (c[v] || 0) + 1; });
    var keys = sortCats(Object.keys(c), key, c);
    if (keys.length <= max) return { keys: keys, other: false };
    return { keys: keys.slice(0, max - 1), other: true };
  }

  function drawChart(rows) {
    var kind = $("chartKind").value;
    var brk = $("chartBreak").value;
    var sort = $("chartSort").value;

    $("breakdownCtl").classList.toggle("is-off", kind === "scatter" || kind === "ages");
    $("sortCtl").classList.toggle("is-off", kind !== "techniques");

    $("chartSub").textContent = describeQuery();

    if (chart) { chart.destroy(); chart = null; }
    var canvas = $("chart");
    var box = canvas.parentNode;
    var old = box.querySelector(".empty");
    if (old) old.remove();

    if (!rows.length) {
      canvas.style.display = "none";
      var p = document.createElement("div");
      p.className = "empty";
      p.textContent = "No entries match this query. Try removing a filter, or switch the technique combiner from “all” to “any”.";
      box.appendChild(p);
      $("chartTitle").textContent = "No results";
      $("chartNote").textContent = "";
      return;
    }
    canvas.style.display = "";

    var cfg;
    if (kind === "techniques") cfg = cfgTechniques(rows, brk, sort);
    else if (kind === "scatter") cfg = cfgScatter(rows);
    else if (kind === "ages") cfg = cfgAges(rows);
    else cfg = cfgCategory(rows, kind, brk);

    $("chartTitle").textContent = cfg.title;
    $("chartNote").textContent = cfg.note;

    // Horizontal bar charts need room per bar, or a breakdown squeezes them to
    // hairlines. Give each bar ~5px and each category group a little padding.
    var cats = (cfg.config.data.labels || []).length;
    var series = cfg.config.data.datasets.length;
    if (cfg.config.options.indexAxis === "y" && cats) {
      box.style.height = Math.max(420, Math.min(2600, cats * (series * 5 + 12) + 90)) + "px";
    } else {
      box.style.height = "";
    }

    chart = new Chart(canvas.getContext("2d"), cfg.config);
  }

  function baseScaleOpts() {
    return {
      grid: { color: css("--grid"), drawTicks: false, lineWidth: 1 },
      border: { color: css("--axis") },
      ticks: { color: css("--text-secondary"), font: { size: 11.5, family: css("--sans") } },
      title: { color: css("--text-secondary"), font: { size: 11.5, weight: "600" } }
    };
  }

  function legendOpts(show) {
    return {
      display: !!show,
      position: "top",
      align: "start",
      labels: {
        color: css("--text-secondary"), boxWidth: 10, boxHeight: 10,
        usePointStyle: true, pointStyle: "circle", padding: 14,
        font: { size: 12, family: css("--sans") }
      }
    };
  }

  function tooltipOpts() {
    return {
      backgroundColor: css("--surface-1"),
      titleColor: css("--text-primary"),
      bodyColor: css("--text-secondary"),
      borderColor: css("--border-strong"),
      borderWidth: 1, padding: 10, cornerRadius: 6,
      titleFont: { size: 12.5, family: css("--sans") },
      bodyFont: { size: 12.5, family: css("--sans") },
      displayColors: true, boxWidth: 9, boxHeight: 9, usePointStyle: true
    };
  }

  /* --- technique frequency ------------------------------------------- */
  function cfgTechniques(rows, brk, sort) {
    var order = PUS.slice();
    if (sort === "freq") {
      order.sort(function (a, b) {
        return rows.reduce(function (s, r) { return s + r[b.key]; }, 0) -
               rows.reduce(function (s, r) { return s + r[a.key]; }, 0) ||
               a.n - b.n;
      });
    } else if (sort === "group") {
      order.sort(function (a, b) {
        return META.groups.indexOf(a.group) - META.groups.indexOf(b.group) || a.n - b.n;
      });
    } else {
      order.sort(function (a, b) { return a.n - b.n; });
    }

    var labels = order.map(function (p) { return p.label; });
    var palette = SERIES();
    var datasets, note, legend = false;

    if (brk) {
      var g = topGroups(rows, brk, 8);
      var buckets = {};
      g.keys.forEach(function (k) { buckets[k] = []; });
      if (g.other) buckets["Other"] = [];
      rows.forEach(function (r) {
        var v = groupValue(r, brk);
        (buckets[v] || buckets["Other"]).push(r);
      });
      datasets = Object.keys(buckets).filter(function (k) { return buckets[k].length; })
        .map(function (k, i) {
          var set = buckets[k];
          return {
            label: k + " (n=" + set.length + ")",
            data: order.map(function (p) {
              return set.length ? round1(100 * set.reduce(function (s, r) { return s + r[p.key]; }, 0) / set.length) : 0;
            }),
            backgroundColor: k === "Other" ? css("--series-other") : palette[i % 8],
            borderWidth: 0, borderRadius: 4, borderSkipped: false,
            barPercentage: 0.86, categoryPercentage: 0.8
          };
        });
      legend = true;
      note = "Each bar is the share of entries in that group recording the technique. " +
             "Groups have very different sample sizes (shown in the legend), so read the " +
             "percentages alongside the n.";
    } else {
      datasets = [{
        label: "% of entries",
        data: order.map(function (p) {
          return round1(100 * rows.reduce(function (s, r) { return s + r[p.key]; }, 0) / rows.length);
        }),
        backgroundColor: order.map(function (p) {
          return industryColour(META.technique_industry[p.key]);
        }),
        borderWidth: 0, borderRadius: 4, borderSkipped: false,
        barPercentage: 0.82, categoryPercentage: 0.9
      }];
      note = "Percentage of the " + rows.length + " filtered entries in which each technique was " +
             "recorded as present. A low bar can mean the technique was rare, or simply that it " +
             "is rarely reported. Bars are coloured by the earliest industry the technique is " +
             "recorded in: blue Lomekwian, orange Oldowan, aqua Acheulean, grey for techniques " +
             "that appear only in later assemblages.";
    }

    var counts = {};
    order.forEach(function (p) {
      counts[p.label] = rows.reduce(function (s, r) { return s + r[p.key]; }, 0);
    });

    return {
      title: "Technique frequency" + (brk ? " by " + prettyKey(brk) : ""),
      note: note,
      config: {
        type: "bar",
        data: { labels: labels, datasets: datasets },
        options: {
          indexAxis: "y",
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 220 },
          layout: { padding: { right: 18, top: 4 } },
          plugins: {
            legend: legendOpts(legend),
            tooltip: Object.assign(tooltipOpts(), {
              callbacks: {
                label: function (ctx) {
                  var extra = brk ? "" : "  (" + counts[ctx.label] + " of " + rows.length + " entries)";
                  return " " + (brk ? ctx.dataset.label.replace(/ \(n=\d+\)$/, "") + ": " : "") +
                         ctx.parsed.x + "%" + extra;
                },
                afterBody: function (items) {
                  var p = PUS.filter(function (x) { return x.label === items[0].label; })[0];
                  if (!p) return "";
                  var i = META.technique_industry[p.key];
                  return "\n" + (i ? "First appears in the " + i
                                   : "Not in the Lomekwian, Oldowan or Acheulean") +
                         "\n\n" + wrapText(p.definition, 46);
                }
              }
            })
          },
          scales: {
            x: Object.assign(baseScaleOpts(), {
              beginAtZero: true, max: 100,
              title: { display: true, text: "% of entries recording the technique",
                       color: css("--text-secondary"), font: { size: 11.5, weight: "600" } },
              ticks: Object.assign(baseScaleOpts().ticks, {
                callback: function (v) { return v + "%"; }
              })
            }),
            y: Object.assign(baseScaleOpts(), {
              grid: { display: false },
              ticks: Object.assign(baseScaleOpts().ticks, { autoSkip: false, font: { size: 11 } })
            })
          }
        }
      }
    };
  }

  /* --- simple category counts ---------------------------------------- */
  function cfgCategory(rows, kind, brk) {
    var key = { country: "country", species: "species", technology: "technology" }[kind] || "continent";
    var counts = {};
    rows.forEach(function (r) { var v = groupValue(r, key); counts[v] = (counts[v] || 0) + 1; });
    var labels = sortCats(Object.keys(counts), key, counts);

    var palette = SERIES();
    var datasets, legend = false;

    if (brk && brk !== key) {
      var g = topGroups(rows, brk, 8);
      var series = g.keys.concat(g.other ? ["Other"] : []);
      datasets = series.map(function (sname, i) {
        return {
          label: sname,
          data: labels.map(function (lab) {
            return rows.filter(function (r) {
              var gv = groupValue(r, brk);
              if (sname === "Other") { return groupValue(r, key) === lab && g.keys.indexOf(gv) < 0; }
              return groupValue(r, key) === lab && gv === sname;
            }).length;
          }),
          backgroundColor: sname === "Other" ? css("--series-other") : palette[i % 8],
          borderWidth: 2, borderColor: css("--surface-1"),
          borderRadius: 4, borderSkipped: false,
          barPercentage: 0.86, categoryPercentage: 0.86
        };
      });
      legend = true;
    } else {
      datasets = [{
        label: "entries",
        data: labels.map(function (l) { return counts[l]; }),
        backgroundColor: css("--series-1"),
        borderWidth: 0, borderRadius: 4, borderSkipped: false,
        barPercentage: 0.82, categoryPercentage: 0.9
      }];
    }

    var titleMap = { country: "Entries by country", species: "Entries by species",
                     technology: "Entries by technology", continent: "Entries by region" };
    var noteMap = {
      country: "Country was derived here from site coordinates and is not part of the published " +
               "dataset; modern borders are a rough guide only for deep prehistory.",
      species: "“Unattributed” marks entries the original publications did not assign to a " +
               "hominin species — common for older or fragmentary assemblages.",
      continent: "Dataset coverage is limited to a single publication and not representative of " +
                 "the full scope of what's known, nor what likely happened.",
      technology: "Industry attribution is not in the published dataset — it was added for this " +
                  "page from site, age and the coder's description, and only four rows name an " +
                  "industry themselves. “Other” is not “unknown”: it holds every " +
                  "entry outside the Oldowan–Acheulean sequence, including biface-bearing " +
                  "assemblages such as Qesem and Kathu Pan 1."
    };

    return {
      title: titleMap[kind] + (legend ? " and " + prettyKey(brk) : ""),
      note: noteMap[kind],
      config: {
        type: "bar",
        data: { labels: labels, datasets: datasets },
        options: {
          indexAxis: "y",
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 220 },
          layout: { padding: { right: 18, top: 4 } },
          plugins: {
            legend: legendOpts(legend),
            tooltip: Object.assign(tooltipOpts(), {
              callbacks: {
                label: function (ctx) {
                  return " " + (legend ? ctx.dataset.label + ": " : "") + ctx.parsed.x +
                         (ctx.parsed.x === 1 ? " entry" : " entries");
                }
              }
            })
          },
          scales: {
            x: Object.assign(baseScaleOpts(), {
              beginAtZero: true, stacked: legend,
              title: { display: true, text: "number of entries",
                       color: css("--text-secondary"), font: { size: 11.5, weight: "600" } },
              ticks: Object.assign(baseScaleOpts().ticks, { precision: 0 })
            }),
            y: Object.assign(baseScaleOpts(), {
              stacked: legend, grid: { display: false },
              ticks: Object.assign(baseScaleOpts().ticks, { autoSkip: false })
            })
          }
        }
      }
    };
  }

  /* --- scatter: techniques vs age ------------------------------------- */
  function cfgScatter(rows) {
    // 3 series only: the all-pairs validated cap
    var TYPES = ["Archaeological", "Primate", "Experimental"];
    var palette = SERIES();
    var withAge = rows.filter(function (r) { return r.ka_mid !== null; });

    var datasets = TYPES.map(function (t, i) {
      var pts = withAge.filter(function (r) { return r.entry_type === t; }).map(function (r) {
        return { x: Math.max(r.ka_mid, 0.01), y: r.pu_count, r: r };
      });
      return {
        label: t + " (n=" + pts.length + ")",
        data: pts,
        backgroundColor: palette[i],
        borderColor: css("--surface-1"), borderWidth: 2,
        pointRadius: 5, pointHoverRadius: 8
      };
    }).filter(function (d) { return d.data.length; });

    return {
      title: "Number of techniques recorded against age",
      note: "Each point is one entry; the x position is the midpoint of its published date range " +
            "(log scale) and the y position is how many of the 33 techniques were recorded. " +
            "An upward trend is partly real and partly an artefact of better preservation, " +
            "richer assemblages and fuller reporting for recent sites. " +
            (rows.length - withAge.length > 0
              ? (rows.length - withAge.length) + " filtered entries have no date and are not plotted."
              : ""),
      config: {
        type: "scatter",
        data: { datasets: datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 220 },
          layout: { padding: { right: 18, top: 4 } },
          plugins: {
            legend: legendOpts(true),
            tooltip: Object.assign(tooltipOpts(), {
              callbacks: {
                title: function (items) { return items[0].raw.r.site; },
                label: function (ctx) {
                  var r = ctx.raw.r;
                  return [" " + r.pu_count + " of 33 techniques",
                          " " + ageLabel(r),
                          " " + (r.country || "no coordinates") + " · " + r.species,
                          " " + r.source];
                }
              }
            })
          },
          scales: {
            x: Object.assign(baseScaleOpts(), {
              type: "logarithmic", reverse: true,
              title: { display: true, text: "age, thousands of years ago (log scale, older to the right)",
                       color: css("--text-secondary"), font: { size: 11.5, weight: "600" } },
              ticks: Object.assign(baseScaleOpts().ticks, {
                callback: function (v) {
                  var ok = [0.01, 0.1, 1, 10, 100, 1000];
                  return ok.indexOf(v) >= 0 ? fmtKa(v) : "";
                }
              })
            }),
            y: Object.assign(baseScaleOpts(), {
              beginAtZero: true, suggestedMax: 26,
              title: { display: true, text: "techniques recorded (of 33)",
                       color: css("--text-secondary"), font: { size: 11.5, weight: "600" } }
            })
          }
        }
      }
    };
  }

  /* --- age histogram --------------------------------------------------- */
  function cfgAges(rows) {
    var edges = [0, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 3400];
    var withAge = rows.filter(function (r) { return r.ka_mid !== null; });
    var counts = edges.slice(0, -1).map(function (lo, i) {
      var hi = edges[i + 1];
      return withAge.filter(function (r) { return r.ka_mid >= lo && r.ka_mid < hi; }).length;
    });
    var labels = edges.slice(0, -1).map(function (lo, i) {
      return fmtKa(lo) + "–" + fmtKa(edges[i + 1]);
    });

    return {
      title: "Age distribution of filtered entries",
      note: "Bins are widened towards the past (roughly logarithmic) because the dataset spans " +
            "3.3 million years. Most entries fall in the late Holocene, as the authors note. " +
            (rows.length - withAge.length > 0
              ? (rows.length - withAge.length) + " filtered entries have no date and are not counted."
              : ""),
      config: {
        type: "bar",
        data: {
          labels: labels,
          datasets: [{
            label: "entries",
            data: counts,
            backgroundColor: css("--series-1"),
            borderWidth: 0, borderRadius: 4, borderSkipped: false,
            barPercentage: 0.9, categoryPercentage: 0.92
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 220 },
          layout: { padding: { right: 18, top: 4 } },
          plugins: {
            legend: legendOpts(false),
            tooltip: Object.assign(tooltipOpts(), {
              callbacks: {
                label: function (ctx) {
                  return " " + ctx.parsed.y + (ctx.parsed.y === 1 ? " entry" : " entries");
                }
              }
            })
          },
          scales: {
            x: Object.assign(baseScaleOpts(), {
              grid: { display: false },
              title: { display: true, text: "age of entry midpoint (younger to older)",
                       color: css("--text-secondary"), font: { size: 11.5, weight: "600" } },
              ticks: Object.assign(baseScaleOpts().ticks, { maxRotation: 55, minRotation: 40 })
            }),
            y: Object.assign(baseScaleOpts(), {
              beginAtZero: true,
              title: { display: true, text: "number of entries",
                       color: css("--text-secondary"), font: { size: 11.5, weight: "600" } },
              ticks: Object.assign(baseScaleOpts().ticks, { precision: 0 })
            })
          }
        }
      }
    };
  }

  function prettyKey(k) {
    return { species: "species", technology: "technology", entry_type: "entry type",
             continent: "region", country: "country",
             single_chain: "scope of entry" }[k] || k;
  }
  function round1(v) { return Math.round(v * 10) / 10; }
  function wrapText(s, n) {
    var out = [], line = "";
    s.split(" ").forEach(function (w) {
      if ((line + " " + w).trim().length > n) { out.push(line.trim()); line = w; }
      else line += " " + w;
    });
    if (line.trim()) out.push(line.trim());
    return out.join("\n");
  }

  /* ================================ map ================================ */
  // Esri's gray canvas basemaps: no API key, and a neutral backdrop for point data.
  var tileLayer = null;
  function isDark() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function tileUrl() {
    return "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_" +
           (isDark() ? "Dark" : "Light") + "_Gray_Base/MapServer/tile/{z}/{y}/{x}";
  }
  function swapBasemap() {
    if (tileLayer) map.removeLayer(tileLayer);
    tileLayer = L.tileLayer(tileUrl(), {
      maxZoom: 16, minZoom: 1,
      attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, DeLorme, ' +
                   'NAVTEQ, HERE, and the GIS user community'
    }).addTo(map);
    tileLayer.bringToBack();
  }

  function ensureMap() {
    if (mapReady) return;
    map = L.map("map", { worldCopyJump: true, scrollWheelZoom: true })
           .setView([15, 15], 2);
    swapBasemap();
    markerLayer = L.layerGroup().addTo(map);
    mapReady = true;
  }

  /* --- shape as a second encoding channel -------------------------------
     Colour carries one dimension, shape another, so the map can be read as a
     cross-tabulation: "H. sapiens AND Acheulean" is one colour and one shape.
     Six shapes is the practical ceiling at this size; the rest fold into a
     seventh "other" glyph. Shape doubles as the CVD fallback for colour. */
  var SHAPES = ["circle", "square", "triangle", "diamond", "cross", "triangle-down", "hexagon"];

  // paths drawn in a 24x24 box centred on (12,12)
  function shapePath(shape) {
    switch (shape) {
      case "square":        return '<rect x="4.5" y="4.5" width="15" height="15" rx="2"/>';
      case "triangle":      return '<path d="M12 3.2 21 19.4H3z"/>';
      case "triangle-down": return '<path d="M12 20.8 3 4.6h18z"/>';
      case "diamond":       return '<path d="M12 2.6 21.4 12 12 21.4 2.6 12z"/>';
      case "cross":         return '<path d="M9.2 2.8h5.6v6.4h6.4v5.6h-6.4v6.4H9.2v-6.4H2.8V9.2h6.4z"/>';
      case "hexagon":       return '<path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z"/>';
      default:              return '<circle cx="12" cy="12" r="8.6"/>';
    }
  }

  function shapeSvg(shape, fill, px, stroke) {
    return '<svg width="' + px + '" height="' + px + '" viewBox="0 0 24 24" ' +
           'style="display:block;overflow:visible">' +
           '<g fill="' + fill + '" stroke="' + stroke + '" stroke-width="2" ' +
           'stroke-linejoin="round" vector-effect="non-scaling-stroke">' +
           shapePath(shape) + "</g></svg>";
  }

  function shapeFor(value, keys) {
    var i = keys.indexOf(value);
    return i < 0 || i >= SHAPES.length ? SHAPES[SHAPES.length - 1] : SHAPES[i];
  }

  function colourFor(value, keys) {
    var palette = SERIES();
    var i = keys.indexOf(value);
    return i < 0 || i >= 8 ? css("--series-other") : palette[i];
  }

  function drawMap(rows) {
    ensureMap();
    markerLayer.clearLayers();

    var colourKey = $("mapColour").value;
    var shapeKey = $("mapShape").value;
    var sizeBy = $("mapSize").value;
    var mapped = rows.filter(function (r) { return r.lat !== null; });

    // Assign colour and shape from the WHOLE dataset, not the filtered rows, so a
    // filter never repaints or re-shapes the survivors: an entity keeps its glyph.
    var allMapped = DATA.filter(function (r) { return r.lat !== null; });
    var colourKeys = catKeys(allMapped, colourKey, 8);
    var shapeKeys = shapeKey ? catKeys(allMapped, shapeKey, SHAPES.length) : [];
    var ring = css("--surface-1");

    mapped.forEach(function (r) {
      var fill = colourFor(groupValue(r, colourKey), colourKeys);
      var px = sizeBy === "pu_count" ? Math.round(13 + (r.pu_count / 25) * 15) : 16;
      var m;

      if (!shapeKey) {
        m = L.circleMarker([r.lat, r.lon], {
          radius: px / 2, fillColor: fill, color: ring,
          weight: 2, opacity: 1, fillOpacity: 0.85
        });
      } else {
        var shape = shapeFor(groupValue(r, shapeKey), shapeKeys);
        m = L.marker([r.lat, r.lon], {
          icon: L.divIcon({
            className: "shape-marker",
            html: shapeSvg(shape, fill, px, ring),
            iconSize: [px, px],
            iconAnchor: [px / 2, px / 2]
          }),
          keyboard: false
        });
      }

      m.bindPopup(popupHtml(r), { maxWidth: 340 });
      m.bindTooltip(r.site, { direction: "top", offset: [0, -4] });
      markerLayer.addLayer(m);
    });

    drawMapLegend(mapped, colourKey, colourKeys, shapeKey, shapeKeys);

    var hidden = rows.length - mapped.length;
    $("mapNote").textContent =
      mapped.length + " of " + rows.length + " filtered entries are plotted." +
      (hidden ? " " + hidden + " have no coordinates in the dataset (primate and experimental entries) " +
                "and cannot be mapped." : "") +
      (shapeKey ? " Colour shows " + prettyKey(colourKey) + " and shape shows " +
                  prettyKey(shapeKey) + ", so each point reads as both at once." : "") +
      " Site coordinates in this release are approximate.";

    fitMap();
  }

  // the categories of `key` present in `rows`, in display order, capped at `max`
  function catKeys(rows, key, max) {
    var counts = {};
    rows.forEach(function (r) { var v = groupValue(r, key); counts[v] = (counts[v] || 0) + 1; });
    return sortCats(Object.keys(counts), key, counts).slice(0, max);
  }

  function drawMapLegend(mapped, colourKey, colourKeys, shapeKey, shapeKeys) {
    var legend = $("mapLegend");
    var counts = {};
    mapped.forEach(function (r) { var v = groupValue(r, colourKey); counts[v] = (counts[v] || 0) + 1; });

    var html = '<div class="legend-row"><span class="legend-lead">' +
               esc(cap(prettyKey(colourKey))) + "</span>";
    colourKeys.forEach(function (k) {
      if (!counts[k]) return;
      html += '<span><i style="background:' + colourFor(k, colourKeys) + '"></i>' +
              esc(k) + " (" + counts[k] + ")</span>";
    });
    var otherN = Object.keys(counts).reduce(function (a, k) {
      return a + (colourKeys.indexOf(k) < 0 ? counts[k] : 0);
    }, 0);
    if (otherN) {
      html += '<span><i style="background:' + css("--series-other") + '"></i>other (' +
              otherN + ")</span>";
    }
    html += "</div>";

    if (shapeKey) {
      var sCounts = {};
      mapped.forEach(function (r) {
        var v = groupValue(r, shapeKey); sCounts[v] = (sCounts[v] || 0) + 1;
      });
      var ink = css("--text-secondary"), bg = css("--surface-1");
      html += '<div class="legend-row"><span class="legend-lead">' +
              esc(cap(prettyKey(shapeKey))) + "</span>";
      shapeKeys.forEach(function (k) {
        if (!sCounts[k]) return;
        html += "<span>" + shapeSvg(shapeFor(k, shapeKeys), ink, 13, bg) +
                esc(k) + " (" + sCounts[k] + ")</span>";
      });
      var sOther = Object.keys(sCounts).reduce(function (a, k) {
        return a + (shapeKeys.indexOf(k) < 0 ? sCounts[k] : 0);
      }, 0);
      if (sOther) {
        html += "<span>" + shapeSvg(SHAPES[SHAPES.length - 1], ink, 13, bg) +
                "other (" + sOther + ")</span>";
      }
      html += "</div>";
    }
    legend.innerHTML = html;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function fitMap() {
    if (!mapReady || !markerLayer) return;
    var layers = markerLayer.getLayers();
    if (!layers.length) return;
    var g = L.featureGroup(layers);
    map.fitBounds(g.getBounds().pad(0.15), { maxZoom: 8, animate: false });
  }

  function popupHtml(r) {
    var present = PUS.filter(function (p) { return r[p.key] === 1; })
                     .map(function (p) { return p.label; });
    var rowsHtml = [
      ["Country", (r.country || "—") + (r.country_approx ? " (approx.)" : "")],
      ["Age", ageLabel(r)],
      ["Species", r.species],
      ["Technology", r.technology + " †"],
      ["Entry type", r.entry_type],
      ["Scope", r.single_chain],
      ["Techniques", r.pu_count + " of 33"]
    ].map(function (p) {
      return "<dt>" + esc(p[0]) + "</dt><dd>" + esc(p[1]) + "</dd>";
    }).join("");

    return '<div class="pop"><h3>' + esc(r.site) + "</h3>" +
      '<p class="pop-sub">' + esc(r.source) + "</p>" +
      "<dl>" + rowsHtml + "</dl>" +
      (r.description ? '<p class="pop-tech"><b>Technology described</b>' + esc(r.description) + "</p>" : "") +
      '<p class="pop-tech"><b>Procedural units present</b>' +
      (present.length ? esc(present.join(", ")) : "none recorded") + "</p>" +
      techThumb(r) +
      '<p class="pop-foot">† Technology is an interpretation added for this page, not part ' +
      "of the published dataset.</p></div>";
  }

  // A reference photograph of the industry - not this artefact. Say so.
  function techThumb(r) {
    var name = META.technology_image_of[r.technology];
    var info = name && META.technology_images[name];
    if (!info) return "";
    if (!info.image) {
      var links = (info.links || []).map(function (l) {
        return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
               esc(l.text) + "</a>";
      }).join("<br>");
      if (!links) return "";
      return '<p class="pop-tech"><b>' + esc(name) + "</b>" +
        '<span class="td-sub">' + esc(info.caption) + "</span>" +
        '<span class="td-sub">' + links + "</span></p>";
    }
    return '<p class="pop-tech"><b>' + esc(name) + " (reference photograph)</b>" +
      '<img class="pop-thumb" src="' + esc(info.image) + '" alt="' + esc(info.alt) + '" loading="lazy">' +
      '<span class="td-sub">' + esc(info.caption) + " Photo: " + esc(info.credit) + ", " +
      esc(info.licence) + ". Not an artefact from this site.</span></p>";
  }

  /* =============================== table =============================== */
  function drawTable(rows) {
    var sorted = rows.slice().sort(function (a, b) {
      var k = tableSort.key, x = a[k], y = b[k];
      if (x === null) return 1;
      if (y === null) return -1;
      if (typeof x === "string") return tableSort.dir * x.localeCompare(y);
      return tableSort.dir * (x - y);
    });

    Array.prototype.forEach.call(document.querySelectorAll("#dataTable th[data-sort]"), function (th) {
      if (th.dataset.sort === tableSort.key) {
        th.setAttribute("aria-sort", tableSort.dir === 1 ? "ascending" : "descending");
      } else {
        th.removeAttribute("aria-sort");
      }
    });

    var tb = document.querySelector("#dataTable tbody");
    tb.innerHTML = "";
    sorted.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td><strong>" + esc(r.site) + "</strong>" +
          (r.single_chain === "Whole assemblage" ? '<span class="tag">assemblage</span>' : "") +
          '<span class="td-sub">' + esc(r.description || "") + "</span></td>" +
        "<td>" + esc(r.country || "—") +
          (r.country_approx ? '<span class="tag">approx.</span>' : "") +
          '<span class="td-sub">' + esc(r.continent || "no coordinates") + "</span></td>" +
        "<td>" + esc(r.species) + '<span class="td-sub">' + esc(r.entry_type) + "</span></td>" +
        "<td>" + esc(r.technology) + "</td>" +
        '<td class="num">' + esc(ageLabel(r)) + "</td>" +
        '<td class="num">' + r.pu_count + "</td>" +
        "<td>" + esc(r.source) + "</td>";
      tb.appendChild(tr);
    });

    $("tableNote").textContent = rows.length + " entries · click a column heading to sort";
  }

  function downloadCsv() {
    var rows = applyFilters();
    var cols = ["id", "site", "source", "description", "species", "technology",
                "entry_type", "single_chain",
                "country", "continent", "country_approx", "lat", "lon",
                "ka_young", "ka_old", "date_citation", "pu_count"]
               .concat(PUS.map(function (p) { return p.key; }));
    var lines = [cols.join(",")];
    rows.forEach(function (r) {
      lines.push(cols.map(function (c) {
        var v = r[c];
        if (v === null || v === undefined) return "";
        v = String(v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(","));
    });
    var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "stone-tools-filtered.csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ============================= codebook ============================== */
  function buildCodebook() {
    var html = "";
    META.groups.forEach(function (g) {
      html += '<h3 class="cb-group">' + esc(g) + "</h3>";
      PUS.filter(function (p) { return p.group === g; }).forEach(function (p) {
        var n = DATA.reduce(function (a, r) { return a + (r[p.key] === 1 ? 1 : 0); }, 0);
        html += '<div class="cb-item"><h4><span>' + p.n + "</span>" + esc(p.label) + "</h4>" +
                "<p>" + esc(p.definition) + "</p>" +
                '<span class="cb-n">present in ' + n + " of 155 entries</span></div>";
      });
    });
    $("codebook").innerHTML = html;
    $("codebookModalBody").innerHTML = html;
  }

  /* ============================= citations ============================= */
  function copyCitation(which) {
    var c = META.citation;
    var text;
    if (which === "apa") {
      text = "Paige, J., & Perreault, C. (2023). A Dataset Describing the Manufacturing of " +
             "Stone Tools Over 3 Million Years. Journal of Open Archaeology Data, 11(12), 1–7. " +
             "https://doi.org/" + c.doi;
    } else if (which === "bibtex") {
      text = "@article{paige2023stonetools,\n" +
             "  author  = {Paige, Jonathan and Perreault, Charles},\n" +
             "  title   = {A Dataset Describing the Manufacturing of Stone Tools Over 3 Million Years},\n" +
             "  journal = {Journal of Open Archaeology Data},\n" +
             "  year    = {2023},\n  volume  = {11},\n  number  = {12},\n  pages   = {1--7},\n" +
             "  doi     = {" + c.doi + "},\n" +
             "  url     = {https://doi.org/" + c.doi + "}\n}";
    } else {
      text = ["TY  - JOUR", "AU  - Paige, Jonathan", "AU  - Perreault, Charles",
              "TI  - A Dataset Describing the Manufacturing of Stone Tools Over 3 Million Years",
              "JO  - Journal of Open Archaeology Data", "PY  - 2023", "VL  - 11", "IS  - 12",
              "SP  - 1", "EP  - 7", "DO  - " + c.doi,
              "UR  - https://doi.org/" + c.doi, "ER  - "].join("\n");
    }

    var done = function (ok) {
      $("copyStatus").textContent = ok
        ? which.toUpperCase() + " citation copied to the clipboard."
        : "Could not copy automatically — the citation is shown above.";
      setTimeout(function () { $("copyStatus").textContent = ""; }, 4000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
  }

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
