import embed from "https://esm.sh/vega-embed@7";

const response = await fetch("./visualization_data/uncollected_for_viz.json");
const jsonData = await response.json();

const baseUrl = "https://voca.arizona.edu";
const href = (path) => (path ? baseUrl + path : null);

const toBool = (v) => v === true || String(v).toUpperCase() === "TRUE";


const tracksByReading = new Map(jsonData.map((d) => [d.reading_link, d.tracks ?? []]));

const df = [...jsonData]
  .sort((a, b) => new Date(a.parsed_date) - new Date(b.parsed_date))
  .map(({ tracks, essay, commentary, ...d }) => ({
    ...d,
    contains_uncollected_or_unpublished: toBool(d.contains_uncollected_or_unpublished),
  }));

// vegalite
const spec = {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json",
  data: { values: df },
  width: "container",
  height: 350,
  autosize: { type: "fit-x", contains: "padding" },
  transform: [
    { calculate: "datum.contains_uncollected_or_unpublished", as: "is_highlighted" },
    { window: [{ op: "count", as: "stack_index" }], groupby: ["parsed_date"], sort: [{ field: "reading_title" }] }
  ],
  mark: { type: "circle", strokeWidth: 2, cursor: "pointer" },
  encoding: {
    x: { field: "parsed_date", type: "temporal", title: "Date", axis: { format: "%Y", tickCount: 15 } },
    y: { field: "stack_index", type: "quantitative", title: "Readings on same date", axis: { tickMinStep: 1, orient: "left" } },
    size: { condition: { test: "datum.contains_uncollected_or_unpublished", value: 140 }, value: 50 },
    fill: { condition: { test: "datum.contains_uncollected_or_unpublished", value: "#1d4ed8" }, value: "#ffffff" },
    stroke: {
      condition: { test: "datum.contains_uncollected_or_unpublished", value: "#1d4ed8" },
      value: "#767676"
    },
    order: { field: "is_highlighted", type: "ordinal" },
    tooltip: [
      { field: "reading_title", type: "nominal", title: "Reading" },
      { field: "reading_date", type: "nominal", title: "Date" }
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

// tracks modal to get breakdown of reading
function showTracks(d) {
  const tracks = tracksByReading.get(d.reading_link) ?? [];

  dlgTitle.innerHTML = `<a href="${href(d.reading_link)}" target="_blank" rel="noopener">${d.reading_title}</a>`;

  const tracksTableRows = tracks.map((t) => {
    const categories = Array.isArray(t.track_classification)
      ? t.track_classification.join(", ")
      : (t.track_classification || "");
    
    const uncollectedStr = toBool(t.is_uncollected_or_unpublished) ? ' <span class="badge warn">Uncollected / Unpublished</span>' : "";
    const yearStr = t.citation_year ? ` (${t.citation_year})` : "";
    const citationHtml = t.citation ? `<div style="font-size:0.85rem; color:#666; margin-top:2px;">${t.citation}</div>` : "";

    return `
      <tr>
        <td>
          <a href="${href(t.track_link)}" target="_blank" rel="noopener"><strong>${t.track_name}</strong></a>${uncollectedStr}${yearStr}
          ${citationHtml}
        </td>
        <td>${categories || "—"}</td>
      </tr>
    `;
  }).join("");

  dlgBody.innerHTML = `
    <p><strong>Date:</strong> ${d.reading_date} (${tracks.length} tracks)</p>
    <h4 style="margin: 1rem 0 0.5rem 0;">Tracks Recorded:</h4>
    <div class="rd-table-container">
      <table class="rd-table">
        <thead>
          <tr>
            <th>Track Name</th>
            <th>Classification</th>
          </tr>
        </thead>
        <tbody>
          ${tracksTableRows}
        </tbody>
      </table>
    </div>
  `;
  dialog.showModal();
}

function renderTable() {
  tbody.innerHTML = "";

  df.forEach((d) => {
    const tracks = tracksByReading.get(d.reading_link) ?? [];
    const tr = document.createElement("tr");

    const titleCol = `
      <a href="${href(d.reading_link)}" target="_blank" rel="noopener" class="reading-title-link">${d.reading_title}</a>
      ${d.contains_uncollected_or_unpublished ? `<span class="badge warn" style="margin-left:6px; font-size:0.75rem;">Uncollected</span>` : ""}`;

    tr.innerHTML = `
      <td>${d.reading_date}</td>
      <td>${titleCol}</td>
      <td>${tracks.length}</td>
    `;

    tr.onclick = () => showTracks(d);
    tbody.appendChild(tr);
  });
}

embed(chartEl, spec, { actions: false }).then((result) => {
  result.view.addEventListener("click", (event, item) => {
    if (item?.datum?.reading_link) {
      showTracks(item.datum);
    }
  });

  window.addEventListener("beforeunload", () => {
    result.view.finalize();
  });
}).catch(console.error);

renderTable();