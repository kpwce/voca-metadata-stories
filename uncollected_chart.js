import embed from "https://esm.sh/vega-embed@7";

const response = await fetch("./visualization_data/uncollected_for_viz.json");
const jsonData = await response.json();

const baseUrl = "https://voca.arizona.edu";
const href = (path) => (path ? baseUrl + path : null);

// Helper to convert string/boolean flags to pure boolean
const toBool = (v) => v === true || String(v).toUpperCase() === "TRUE";
const isTrue = (v) => toBool(v);

// Track and Essay Maps
const tracksByReading = new Map(jsonData.map((d) => [d.reading_link, d.tracks ?? []]));
const essayByReading = new Map(
  jsonData.map((d) => [
    d.reading_link,
    typeof d.essay === "object" && d.essay !== null
      ? d.essay.summary || d.essay.content
      : d.essay ?? d.commentary ?? null
  ])
);

// Normalize data flags to boolean values
const df = [...jsonData]
  .sort((a, b) => new Date(a.parsed_date) - new Date(b.parsed_date))
  .map(({ tracks, essay, commentary, ...d }) => ({
    ...d,
    contains_uncollected: toBool(d.contains_uncollected),
    contains_unpublished: toBool(d.contains_unpublished),
    contains_missing_citation: toBool(d.contains_missing_citation),
    has_essay: Boolean(essay || commentary || d.essay_link)
  }));

// --- Vega-Lite Specification (Uncollected Highlighted by Default) ---
const spec = {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json",
  data: { values: df },
  width: "container",
  height: 350,
  autosize: { type: "fit-x", contains: "padding" },
  params: [
    {
      name: "grid_zoom_pan",
      select: { type: "interval", encodings: ["x"] },
      bind: "scales"
    }
  ],
  transform: [
    { calculate: "datum.contains_uncollected", as: "is_highlighted" },
    { calculate: "datum.has_essay ? 'Essay Available' : 'No Essay'", as: "essay_status" },
    { window: [{ op: "count", as: "stack_index" }], groupby: ["parsed_date"], sort: [{ field: "reading_title" }] }
  ],
  mark: { type: "circle", strokeWidth: 2, cursor: "pointer" },
  encoding: {
    x: { field: "parsed_date", type: "temporal", title: "Date", axis: { format: "%Y", tickCount: 15 } },
    y: { field: "stack_index", type: "quantitative", title: "Readings on same date", axis: { tickMinStep: 1, orient: "left" } },

    // Uncollected = Large & Filled Blue; Others = Small & Hollow Gray
    size: { condition: { test: "datum.contains_uncollected", value: 140 }, value: 50 },
    fill: { condition: { test: "datum.contains_uncollected", value: "#1d4ed8" }, value: "#ffffff" },
    stroke: {
      condition: [
        { test: "datum.has_essay && datum.contains_uncollected", value: "#7c3aed" }, // Violet highlight for essays
        { test: "datum.contains_uncollected", value: "#1d4ed8" }
      ],
      value: "#767676"
    },
    strokeWidth: { condition: { test: "datum.has_essay", value: 3 }, value: 1.5 },
    order: { field: "is_highlighted", type: "ordinal" },
    tooltip: [
      { field: "reading_title", type: "nominal", title: "Reading" },
      { field: "reading_date", type: "nominal", title: "Date" },
      { field: "essay_status", type: "nominal", title: "Essay" }
    ]
  }
};

const chartEl = document.querySelector(".chart") || document.querySelector("#chart-container");
const tbody = document.querySelector(".rd-table tbody");
const dialog = document.querySelector("#track-dialog");
const dlgTitle = document.querySelector("#dlg-title");
const dlgBody = document.querySelector("#dlg-body");

if (dialog) {
  const closeBtn = document.querySelector(".dlg-close");
  if (closeBtn) closeBtn.onclick = () => dialog.close();
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
}

function showTracks(d, openEssayImmediately = false) {
  const tracks = tracksByReading.get(d.reading_link) ?? [];
  const essayContent = essayByReading.get(d.reading_link);

  dlgTitle.innerHTML = `<a href="${href(d.reading_link)}" target="_blank" rel="noopener">${d.reading_title}</a>`;

  const tracksListHtml = tracks.map((t) => {
    const categories = Array.isArray(t.track_classification)
      ? t.track_classification.join(", ")
      : (t.track_classification || "");
    
    const uncollectedStr = isTrue(t.uncollected) ? ' • <span class="badge warn">Uncollected</span>' : "";
    const unpublishedStr = isTrue(t.unpublished) ? ' • <span class="badge warn">Unpublished</span>' : "";
    const yearStr = t.citation_year ? ` • Published ${t.citation_year}` : "";
    const citationStr = t.citation ? `<div style="font-size:0.85rem; color:#666;">${t.citation}</div>` : "";

    return `
      <li style="margin-bottom:0.8rem;">
        <div><a href="${href(t.track_link)}" target="_blank" rel="noopener"><strong>${t.track_name}</strong></a></div>
        <div style="font-size:0.85rem; color:#555;">
          ${categories}${uncollectedStr}${unpublishedStr}${yearStr}
        </div>
        ${citationStr}
      </li>
    `;
  }).join("");

  dlgBody.innerHTML = `
    <p><strong>Date:</strong> ${d.reading_date} (${tracks.length} tracks)</p>
    <div id="essay-button-container"></div>
    <div id="essay-wrapper"></div>
    <h4 style="margin: 1rem 0 0.5rem 0;">Tracks Recorded:</h4>
    <ul style="padding-left:1.2rem; margin-top:0;">
      ${tracksListHtml}
    </ul>
  `;

  const essayBtnContainer = dlgBody.querySelector("#essay-button-container");
  const essayWrapper = dlgBody.querySelector("#essay-wrapper");

  const renderEssayContent = () => {
    essayWrapper.innerHTML = `
      <div class="essay-box">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
          <strong style="color:#7c3aed;">✨ Reading Essay / Commentary</strong>
          ${d.essay_link ? `<a href="${href(d.essay_link)}" target="_blank" rel="noopener" style="font-size:0.8rem; color:#7c3aed;">Full Essay ↗</a>` : ""}
        </div>
        <p style="margin:0;">${essayContent}</p>
      </div>
    `;
  };

  if (d.has_essay && !openEssayImmediately) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-sparkle-essay";
    btn.style.marginTop = "0.5rem";
    btn.innerHTML = `<span class="sparkle-icon">✨</span> Read Essay`;

    btn.onclick = () => {
      renderEssayContent();
      btn.remove();
    };

    essayBtnContainer.appendChild(btn);
  }

  if (openEssayImmediately && essayContent) {
    renderEssayContent();
  }

  dialog.showModal();
}

function renderTable() {
  tbody.innerHTML = "";

  df.forEach((d) => {
    const tracks = tracksByReading.get(d.reading_link) ?? [];
    const tr = document.createElement("tr");

    const essayCol = d.has_essay 
      ? `<button type="button" class="btn-sparkle-essay"><span class="sparkle-icon">✨</span> Read Essay</button>` 
      : `<span style="color:#aaa;">—</span>`;

    const titleCol = `
      <a href="${href(d.reading_link)}" target="_blank" rel="noopener" class="reading-title-link">${d.reading_title}</a>
      ${d.contains_uncollected ? `<span class="badge warn" style="margin-left:6px; font-size:0.75rem;">Uncollected</span>` : ""}
      ${d.has_essay ? `<span class="sparkle-icon" title="Essay Available">✨</span>` : ""}
    `;

    tr.innerHTML = `
      <td>${d.reading_date}</td>
      <td>${titleCol}</td>
      <td>${tracks.length}</td>
      <td>${essayCol}</td>
    `;

    tr.onclick = () => showTracks(d, false);

    const linkElem = tr.querySelector(".reading-title-link");
    if (linkElem) {
      linkElem.onclick = (e) => e.stopPropagation();
    }

    if (d.has_essay) {
      const essayBtn = tr.querySelector(".btn-sparkle-essay");
      if (essayBtn) {
        essayBtn.onclick = (e) => {
          e.stopPropagation();
          showTracks(d, true);
        };
      }
    }

    tbody.appendChild(tr);
  });
}

// Embed Vega-Lite timeline chart
embed(chartEl, spec, { actions: false }).then((result) => {
  result.view.addEventListener("click", (event, item) => {
    if (item?.datum?.reading_link) {
      showTracks(item.datum, false);
    }
  });

  window.addEventListener("beforeunload", () => {
    result.view.finalize();
  });
}).catch(console.error);

// Initial rendering of the main table
renderTable();