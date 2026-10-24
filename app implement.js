/**
 * SafeRoute - Civic Road Safety Platform
 * Complete Client-Side Application Logic with LocalStorage Persistence,
 * Real Geolocation (Nominatim API), Real Leaflet Map, Camera Uploads, & Audio Chimes.
 */

// Initial Seed Data if LocalStorage is empty
const INITIAL_REPORTS = [
  {
    id: "rep-1",
    title: "Deep Crater in Left Bike Lane",
    category: "Pothole",
    severity: "Critical",
    description: "Pothole ~15cm deep causing two-wheelers to swerve into oncoming bus lane suddenly.",
    lat: 12.9719,
    lng: 77.5937,
    address: "Main Blvd, near Metro Pillar 142",
    ward: "Ward 7",
    photo: null,
    upvotes: 48,
    upvoted: false,
    status: "submitted",
    createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    slaHoursLeft: 18,
    assignedAgency: null
  },
  {
    id: "rep-2",
    title: "Complete Darkness at Zebra Crossing",
    category: "Broken Light",
    severity: "Medium",
    description: "High pedestrian zone near school. Vehicles cannot see children crossing at dusk.",
    lat: 12.9750,
    lng: 77.5990,
    address: "Oak Street & 3rd Junction",
    ward: "Ward 7",
    photo: null,
    upvotes: 23,
    upvoted: false,
    status: "in_progress",
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    slaHoursLeft: 24,
    assignedAgency: "Electricity Board (PowerCorp)"
  },
  {
    id: "rep-3",
    title: "Open Manhole Lid Missing",
    category: "Open Manhole",
    severity: "Critical",
    description: "Cast iron lid was stolen, temporarily marked with a tree branch.",
    lat: 12.9680,
    lng: 77.5890,
    address: "1st Cross Ave & Market Rd",
    ward: "Ward 7",
    photo: null,
    upvotes: 56,
    upvoted: true,
    status: "resolved",
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    slaHoursLeft: 0,
    assignedAgency: "Drainage & Sewerage Div"
  }
];

// --- State Management ---
class StateManager {
  static STORAGE_KEY = "saferoute_reports_v1";

  static getReports() {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(INITIAL_REPORTS));
      return [...INITIAL_REPORTS];
    }
    try {
      return JSON.parse(data);
    } catch (e) {
      return [...INITIAL_REPORTS];
    }
  }

  static saveReports(reports) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
  }

  static addReport(report) {
    const reports = this.getReports();
    reports.unshift(report);
    this.saveReports(reports);
    return reports;
  }

  static toggleUpvote(id) {
    const reports = this.getReports();
    const rep = reports.find(r => r.id === id);
    if (rep) {
      if (rep.upvoted) {
        rep.upvotes -= 1;
        rep.upvoted = false;
      } else {
        rep.upvotes += 1;
        rep.upvoted = true;
      }
      this.saveReports(reports);
    }
    return reports;
  }

  static updateStatus(id, newStatus, assignedAgency = null) {
    const reports = this.getReports();
    const rep = reports.find(r => r.id === id);
    if (rep) {
      rep.status = newStatus;
      if (assignedAgency) rep.assignedAgency = assignedAgency;
      this.saveReports(reports);
    }
    return reports;
  }
}

// --- Sound Synthesizer (Web Audio API) ---
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'submit') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'upvote') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch (err) {
    // AudioContext blocked or unsupported, silently ignore
  }
}

// --- Application Core & DOM Controller ---
let leafletMap = null;
let currentCoords = { lat: 12.9716, lng: 77.5946 };
let currentSelectedPhotoBase64 = null;
let activeCategory = "Pothole";

document.addEventListener("DOMContentLoaded", () => {
  renderFeed();
  renderKanban();
  setupEventListeners();
  autoFetchGeolocation();
});

// Switch Top View: Citizen Mobile vs Municipal Authority Portal
function switchView(viewName) {
  const citizenView = document.getElementById("citizen-view");
  const authorityView = document.getElementById("authority-view");
  const citizenBtn = document.getElementById("view-citizen-btn");
  const authorityBtn = document.getElementById("view-authority-btn");

  if (viewName === "citizen") {
    citizenView.classList.remove("hidden");
    authorityView.classList.add("hidden");
    citizenBtn.className = "flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all bg-slate-800 text-white shadow-sm border border-slate-700";
    authorityBtn.className = "flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-slate-400 hover:text-white";
  } else {
    citizenView.classList.add("hidden");
    authorityView.classList.remove("hidden");
    authorityBtn.className = "flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all bg-slate-800 text-white shadow-sm border border-slate-700";
    citizenBtn.className = "flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all text-slate-400 hover:text-white";
    renderKanban();
  }
}

// Switch Mobile Tabs: Community Feed vs Hazard Map
function switchMobileTab(tabName) {
  const feedContainer = document.getElementById("mobile-feed-container");
  const mapContainer = document.getElementById("mobile-map-container");
  const feedTabBtn = document.getElementById("mobile-tab-feed");
  const mapTabBtn = document.getElementById("mobile-tab-map");

  if (tabName === "feed") {
    feedContainer.classList.remove("hidden");
    mapContainer.classList.add("hidden");
    feedTabBtn.className = "flex-1 py-1.5 text-center font-semibold text-white border-b-2 border-amber-500";
    mapTabBtn.className = "flex-1 py-1.5 text-center font-medium text-slate-400 border-b-2 border-transparent";
  } else {
    feedContainer.classList.add("hidden");
    mapContainer.classList.remove("hidden");
    mapTabBtn.className = "flex-1 py-1.5 text-center font-semibold text-white border-b-2 border-amber-500";
    feedTabBtn.className = "flex-1 py-1.5 text-center font-medium text-slate-400 border-b-2 border-transparent";
    initLeafletMap();
  }
}

// Real HTML5 Geolocation with OpenStreetMap Reverse Geocoding
function autoFetchGeolocation() {
  const statusSpan = document.getElementById("modal-address");
  if (!navigator.geolocation) {
    if (statusSpan) statusSpan.innerText = "Location: Downtown Central (Default)";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentCoords.lat}&lon=${currentCoords.lng}`);
        const data = await res.json();
        const readable = data.address?.road || data.address?.suburb || data.address?.city || "Current Location";
        if (statusSpan) {
          statusSpan.innerText = `${readable} (GPS ±${Math.round(pos.coords.accuracy || 5)}m)`;
        }
      } catch (e) {
        if (statusSpan) {
          statusSpan.innerText = `GPS: ${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}`;
        }
      }
      if (leafletMap) {
        leafletMap.setView([currentCoords.lat, currentCoords.lng], 14);
      }
    },
    (err) => {
      console.warn("Geolocation permission skipped or unavailable, using fallback coordinates.");
    },
    { timeout: 7000 }
  );
}

// Initialize Leaflet Map (Zero API Key needed)
function initLeafletMap() {
  if (leafletMap) {
    setTimeout(() => leafletMap.invalidateSize(), 200);
    refreshMapMarkers();
    return;
  }

  const mapEl = document.getElementById("leaflet-map");
  if (!mapEl) return;

  leafletMap = L.map("leaflet-map", { zoomControl: false }).setView([currentCoords.lat, currentCoords.lng], 14);

  // High performance OpenStreetMap Dark style tiles
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(leafletMap);

  L.control.zoom({ position: "bottomright" }).addTo(leafletMap);

  refreshMapMarkers();
}

function refreshMapMarkers() {
  if (!leafletMap) return;

  // Clear existing pins
  leafletMap.eachLayer((layer) => {
    if (layer instanceof L.Marker) {
      leafletMap.removeLayer(layer);
    }
  });

  const reports = StateManager.getReports();

  reports.forEach((rep) => {
    let pinClass = "pin-medium";
    let iconChar = "💡";

    if (rep.status === "resolved") {
      pinClass = "pin-resolved";
      iconChar = "✓";
    } else if (rep.severity === "Critical") {
      pinClass = "pin-critical";
      iconChar = "!";
    } else if (rep.category === "Pothole") {
      iconChar = "🕳️";
    }

    const customIcon = L.divIcon({
      className: `hazard-pin ${pinClass}`,
      html: `<span>${iconChar}</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker([rep.lat, rep.lng], { icon: customIcon }).addTo(leafletMap);
    marker.bindPopup(`
      <div class="text-xs space-y-1">
        <p class="font-bold text-white">${rep.category}: ${rep.title}</p>
        <p class="text-slate-300">${rep.description}</p>
        <p class="text-amber-400 font-semibold">📍 ${rep.address}</p>
        <div class="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-700">
          <span>👍 ${rep.upvotes} Upvotes</span>
          <span class="capitalize text-emerald-400 font-bold">${rep.status.replace("_", " ")}</span>
        </div>
      </div>
    `);
  });
}

// Render Mobile Feed Cards
function renderFeed() {
  const container = document.getElementById("hazard-feed-list");
  if (!container) return;

  const reports = StateManager.getReports();
  container.innerHTML = "";

  reports.forEach((rep) => {
    const card = document.createElement("div");
    card.className = "bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm space-y-2.5 transition-all hover:border-slate-700";

    const badgeSeverity = rep.severity === "Critical" 
      ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
      : "bg-amber-500/20 text-amber-400 border-amber-500/30";

    let statusLabel = "Under Review";
    let statusClass = "bg-amber-500/20 text-amber-400";
    if (rep.status === "in_progress") {
      statusLabel = "Work In Progress";
      statusClass = "bg-sky-500/20 text-sky-400";
    } else if (rep.status === "resolved") {
      statusLabel = "Resolved ✓";
      statusClass = "bg-emerald-500/20 text-emerald-400";
    }

    const photoHtml = rep.photo
      ? `<img src="${rep.photo}" class="w-full h-full object-cover" alt="hazard">`
      : `<svg class="w-7 h-7 text-amber-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg><span class="text-[11px] text-slate-400 mt-0.5">Verified</span>`;

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span class="text-xs px-2 py-0.5 rounded-md font-bold border ${badgeSeverity}">${rep.category}</span>
          <span class="text-xs text-slate-400">${timeAgo(rep.createdAt)}</span>
        </div>
        <span class="text-xs ${statusClass} font-medium px-2 py-0.5 rounded-full">${statusLabel}</span>
      </div>

      <div class="flex gap-3">
        <div class="w-20 h-20 rounded-lg bg-slate-800 border border-slate-700 flex flex-col items-center justify-center text-slate-400 shrink-0 overflow-hidden relative">
          ${photoHtml}
        </div>
        <div class="flex-1 space-y-1">
          <p class="text-xs font-semibold text-white">${rep.title}</p>
          <p class="text-xs text-slate-300 line-clamp-2">${rep.description}</p>
          <p class="text-xs text-slate-400 flex items-center gap-1">
            <svg class="w-3 h-3 text-rose-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" /></svg>
            ${rep.address}
          </p>
        </div>
      </div>

      <div class="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
        <button onclick="handleUpvote('${rep.id}')" class="flex items-center space-x-1.5 ${rep.upvoted ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-amber-400'} transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"/></svg>
          <span>I saw this too (<span class="vote-count font-bold">${rep.upvotes}</span>)</span>
        </button>
        <span class="text-xs text-sky-400 font-medium">${rep.assignedAgency || rep.ward}</span>
      </div>
    `;

    container.appendChild(card);
  });
}

// Handle Upvote action
function handleUpvote(id) {
  StateManager.toggleUpvote(id);
  playSound('upvote');
  renderFeed();
  renderKanban();
  if (leafletMap) refreshMapMarkers();
}

// Render Municipal Authority Kanban Columns
function renderKanban() {
  const colNew = document.getElementById("kanban-new");
  const colProgress = document.getElementById("kanban-progress");
  const colResolved = document.getElementById("kanban-resolved");

  if (!colNew || !colProgress || !colResolved) return;

  const reports = StateManager.getReports();

  colNew.innerHTML = "";
  colProgress.innerHTML = "";
  colResolved.innerHTML = "";

  let countNew = 0;
  let countProgress = 0;
  let countResolved = 0;

  reports.forEach((rep) => {
    if (rep.status === "submitted") {
      countNew++;
      colNew.appendChild(createKanbanCard(rep, "submitted"));
    } else if (rep.status === "in_progress") {
      countProgress++;
      colProgress.appendChild(createKanbanCard(rep, "in_progress"));
    } else if (rep.status === "resolved") {
      countResolved++;
      colResolved.appendChild(createKanbanCard(rep, "resolved"));
    }
  });

  // Update column counters
  const badgeNew = document.getElementById("count-new");
  const badgeProgress = document.getElementById("count-progress");
  const badgeResolved = document.getElementById("count-resolved");
  if (badgeNew) badgeNew.innerText = countNew;
  if (badgeProgress) badgeProgress.innerText = countProgress;
  if (badgeResolved) badgeResolved.innerText = countResolved;
}

function createKanbanCard(rep, status) {
  const div = document.createElement("div");
  div.className = "p-3 bg-slate-900 border border-slate-750 rounded-xl space-y-2 text-xs shadow-xs";

  if (status === "submitted") {
    div.innerHTML = `
      <div class="flex justify-between items-start">
        <span class="font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded">${rep.category}</span>
        <span class="text-xs text-slate-400">👍 ${rep.upvotes} Upvotes</span>
      </div>
      <p class="font-semibold text-white">${rep.title}</p>
      <p class="text-xs text-slate-300 line-clamp-2">${rep.description}</p>
      <p class="text-xs text-slate-400">📍 ${rep.address}</p>
      <div class="pt-2 flex items-center justify-between border-t border-slate-800">
        <span class="text-xs text-amber-400 font-medium">SLA: ${rep.slaHoursLeft}h left</span>
        <button onclick="dispatchCrew('${rep.id}')" class="px-2.5 py-1 bg-sky-500 text-white rounded-lg text-xs font-bold hover:bg-sky-400 transition-transform active:scale-95">
          Dispatch Crew
        </button>
      </div>
    `;
  } else if (status === "in_progress") {
    div.innerHTML = `
      <div class="flex justify-between items-start">
        <span class="font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">${rep.category}</span>
        <span class="text-xs text-sky-400">${rep.assignedAgency || 'Assigned'}</span>
      </div>
      <p class="font-semibold text-white">${rep.title}</p>
      <p class="text-xs text-slate-300">${rep.description}</p>
      <p class="text-xs text-slate-400">📍 ${rep.address}</p>
      <div class="pt-2 flex items-center justify-between border-t border-slate-800">
        <span class="text-xs text-slate-400">Assigned: Rapid Response</span>
        <button onclick="markIssueResolved('${rep.id}')" class="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-400 transition-transform active:scale-95">
          Mark Resolved ✓
        </button>
      </div>
    `;
  } else {
    div.innerHTML = `
      <div class="flex justify-between items-start">
        <span class="font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">Fixed: ${rep.category}</span>
        <span class="text-xs text-emerald-400 font-bold">100% SLA</span>
      </div>
      <p class="font-semibold text-white">${rep.title}</p>
      <p class="text-xs text-slate-300">${rep.description}</p>
      <div class="pt-1 flex items-center justify-between text-xs text-slate-400">
        <span>Verified by Ward Inspector</span>
        <span class="text-emerald-400 font-semibold">Closed</span>
      </div>
    `;
  }

  return div;
}

// Municipal Actions
function dispatchCrew(id) {
  StateManager.updateStatus(id, "in_progress", "Ward 7 Paving Unit #3");
  playSound("submit");
  renderFeed();
  renderKanban();
  if (leafletMap) refreshMapMarkers();
}

function markIssueResolved(id) {
  StateManager.updateStatus(id, "resolved");
  playSound("submit");
  renderFeed();
  renderKanban();
  if (leafletMap) refreshMapMarkers();
}

// Modal and Form Controls
function openReportModal() {
  const modal = document.getElementById("report-modal");
  if (modal) modal.classList.remove("hidden");
  autoFetchGeolocation();
}

function closeReportModal() {
  const modal = document.getElementById("report-modal");
  if (modal) modal.classList.add("hidden");
}

function selectCategory(btn, cat) {
  activeCategory = cat;
  document.querySelectorAll(".cat-pill").forEach((b) => {
    b.className = "cat-pill p-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-left flex items-center space-x-2";
  });
  btn.className = "cat-pill p-2 rounded-xl border border-amber-500 bg-amber-500/20 text-amber-400 font-semibold text-left flex items-center space-x-2";
}

// Real Photo Reader using HTML5 File API
function setupEventListeners() {
  const fileInput = document.getElementById("real-photo-input");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          currentSelectedPhotoBase64 = event.target.result;
          document.getElementById("photo-placeholder").classList.add("hidden");
          const preview = document.getElementById("photo-preview");
          preview.classList.remove("hidden");
          preview.innerHTML = `
            <div class="flex items-center space-x-2 text-emerald-400 font-semibold">
              <span>✓ Photo Captured (${(file.size / 1024).toFixed(0)} KB)</span>
            </div>
          `;
        };
        reader.readAsDataURL(file);
      }
    });
  }
}

// Submit New Citizen Report
function submitNewReport() {
  const notesInput = document.getElementById("report-description-input");
  const notes = notesInput ? notesInput.value.trim() : "";
  const addressText = document.getElementById("modal-address")?.innerText || "Main Street, Ward 7";

  const newReport = {
    id: "rep-" + Date.now(),
    title: `${activeCategory} Reported by Commuter`,
    category: activeCategory,
    severity: activeCategory === "Pothole" || activeCategory === "Open Manhole" ? "Critical" : "Medium",
    description: notes || `Citizen report flagged for immediate inspection.`,
    lat: currentCoords.lat + (Math.random() - 0.5) * 0.005,
    lng: currentCoords.lng + (Math.random() - 0.5) * 0.005,
    address: addressText,
    ward: "Ward 7",
    photo: currentSelectedPhotoBase64,
    upvotes: 1,
    upvoted: true,
    status: "submitted",
    createdAt: new Date().toISOString(),
    slaHoursLeft: 24,
    assignedAgency: null
  };

  StateManager.addReport(newReport);
  playSound("submit");

  // Reset form
  if (notesInput) notesInput.value = "";
  currentSelectedPhotoBase64 = null;
  const photoPreview = document.getElementById("photo-preview");
  const photoPlaceholder = document.getElementById("photo-placeholder");
  if (photoPreview) photoPreview.classList.add("hidden");
  if (photoPlaceholder) photoPlaceholder.classList.remove("hidden");

  // Update views
  renderFeed();
  renderKanban();
  if (leafletMap) refreshMapMarkers();

  // Increment user profile count
  const statElem = document.getElementById("user-reports-stat");
  if (statElem) statElem.innerText = parseInt(statElem.innerText || "0") + 1;

  closeReportModal();
  switchMobileTab("feed");
}

// Export CSV for Municipal Ward Audit
function exportAuditCSV() {
  const reports = StateManager.getReports();
  let csv = "ID,Category,Severity,Status,Upvotes,Address,Latitude,Longitude,CreatedAt\n";
  reports.forEach(r => {
    csv += `"${r.id}","${r.category}","${r.severity}","${r.status}",${r.upvotes},"${r.address}",${r.lat},${r.lng},"${r.createdAt}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `road_hazards_audit_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Utility: time ago formatter
function timeAgo(dateString) {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
