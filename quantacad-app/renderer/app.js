// ── QUANTACAD APP.JS ──────────────────────────────────────────────────────────
'use strict';

// ── STATE ─────────────────────────────────────────────────────────────────────
const state = {
  tool: 'select',
  zoom: 1,
  offset: { x: 60, y: 40 },
  isPanning: false,
  panStart: null,
  spaceDown: false,
  drawing: false,
  points: [],
  measurements: [],
  selectedId: null,
  history: [],        // for undo
  historyIdx: -1,
  snapGrid: true,
  snapAngle: false,
  unit: 'm',
  scale: 100,         // 1:100 = 100px per metre (before zoom)
  nextId: 1,
  nextItemNum: 1,
  activeTab: 0,
  calibrating: false,
  calPoints: [],
  calPixelDist: 0,
  currentDrawing: null,
  drawingImage: null,
  layers: defaultLayers(),
  groups: defaultGroups(),
  tabs: [{ id: 'empty', label: '+ Import Drawing', empty: true }],
  project: { name: 'INFRA-2024-07', id: 'QC-001' },
  activityLog: [],
};

function defaultLayers() {
  return [
    { id: 1, name: 'WALLS',       color: '#4f7cff', visible: true },
    { id: 2, name: 'FLOORS',      color: '#3ddba0', visible: true },
    { id: 3, name: 'WINDOWS',     color: '#ffb347', visible: true },
    { id: 4, name: 'DOORS',       color: '#ff6b35', visible: true },
    { id: 5, name: 'COLUMNS',     color: '#7c5cff', visible: true },
    { id: 6, name: 'ANNOTATIONS', color: '#5a6080', visible: true },
  ];
}

function defaultGroups() {
  return [
    { id: 'concrete',  name: 'Concrete Works',  color: '#4f7cff', items: [] },
    { id: 'masonry',   name: 'Masonry & Walls', color: '#3ddba0', items: [] },
    { id: 'openings',  name: 'Openings',        color: '#ffb347', items: [] },
    { id: 'finishes',  name: 'Finishes',        color: '#7c5cff', items: [] },
    { id: 'mep',       name: 'MEP',             color: '#ff6b35', items: [] },
    { id: 'civil',     name: 'Civil Works',     color: '#ff4f6e', items: [] },
  ];
}

// ── CANVAS ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const rulerH = document.getElementById('rulerH');
const rulerV = document.getElementById('rulerV');
const rHctx = rulerH.getContext('2d');
const rVctx = rulerV.getContext('2d');

function resizeCanvas() {
  const area = document.getElementById('canvasArea');
  const w = area.clientWidth - 20;
  const h = area.clientHeight - 20;
  canvas.width  = Math.max(w, 100);
  canvas.height = Math.max(h, 100);
  rulerH.width  = area.clientWidth - 20;
  rulerH.height = 20;
  rulerV.width  = 20;
  rulerV.height = area.clientHeight;
  render();
}

// ── COORDINATE HELPERS ───────────────────────────────────────────────────────
const w2s = (x, y) => [x * state.zoom + state.offset.x, y * state.zoom + state.offset.y];
const s2w = (x, y) => [(x - state.offset.x) / state.zoom, (y - state.offset.y) / state.zoom];

function snapPt(x, y) {
  if (!state.snapGrid) return [x, y];
  const g = 20;
  return [Math.round(x / g) * g, Math.round(y / g) * g];
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  if (state.drawingImage) drawBgImage();
  state.measurements.forEach(m => drawMeasurement(m));
  drawCurrentPath();
  drawRulers();
}

function drawGrid() {
  const step = 20 * state.zoom;
  ctx.strokeStyle = '#1e2230'; ctx.lineWidth = 1;
  const ox = state.offset.x % step, oy = state.offset.y % step;
  for (let x = ox; x < canvas.width; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = oy; y < canvas.height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  const major = step * 5;
  const mox = state.offset.x % major, moy = state.offset.y % major;
  ctx.strokeStyle = '#252840';
  for (let x = mox; x < canvas.width; x += major) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = moy; y < canvas.height; y += major) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  // Origin cross
  const [ox2, oy2] = w2s(0, 0);
  ctx.strokeStyle = '#2e3448'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ox2, 0); ctx.lineTo(ox2, canvas.height); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, oy2); ctx.lineTo(canvas.width, oy2); ctx.stroke();
}

function drawBgImage() {
  ctx.save();
  ctx.globalAlpha = 0.35;
  const [sx, sy] = w2s(0, 0);
  const iw = state.drawingImage.width * state.zoom * 0.5;
  const ih = state.drawingImage.height * state.zoom * 0.5;
  ctx.drawImage(state.drawingImage, sx, sy, iw, ih);
  ctx.restore();
}

function drawMeasurement(m) {
  const pts = m.points.map(p => w2s(p[0], p[1]));
  const isSelected = m.id === state.selectedId;

  if (m.type === 'area' || m.type === 'volume') {
    if (pts.length < 2) return;
    const color = m.type === 'volume' ? '#ff6b35' : '#4f7cff';
    const fill = m.type === 'volume' ? 'rgba(255,107,53,0.1)' : 'rgba(79,124,255,0.1)';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.closePath();
    ctx.fillStyle = isSelected ? (m.type === 'volume' ? 'rgba(255,107,53,0.25)' : 'rgba(79,124,255,0.22)') : fill;
    ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.stroke();
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    ctx.fillStyle = color; ctx.font = '11px DM Mono,monospace'; ctx.textAlign = 'center';
    ctx.fillText(m.label, cx, cy);
    pts.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI*2); ctx.fillStyle = color; ctx.fill(); });

  } else if (m.type === 'length') {
    ctx.strokeStyle = '#ffb347'; ctx.lineWidth = isSelected ? 2.5 : 2;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    pts.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.stroke();
    if (pts.length >= 2) {
      const last = pts[pts.length-1], prev = pts[pts.length-2];
      const mx = (last[0]+prev[0])/2, my = (last[1]+prev[1])/2 - 9;
      ctx.fillStyle = '#ffb347'; ctx.font = '11px DM Mono,monospace'; ctx.textAlign = 'center';
      ctx.fillText(m.label, mx, my);
    }
    pts.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI*2); ctx.fillStyle = '#ffb347'; ctx.fill(); });

  } else if (m.type === 'count') {
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, Math.PI*2);
      ctx.fillStyle = '#ffb347'; ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#111'; ctx.font = 'bold 8px DM Sans,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('●', p[0], p[1]); ctx.textBaseline = 'alphabetic';
    });
  }
  ctx.textAlign = 'left';
}

function drawCurrentPath() {
  if (state.points.length === 0) return;
  const pts = state.points.map(p => w2s(p[0], p[1]));
  const color = state.tool === 'area' ? '#4f7cff' : state.tool === 'length' ? '#ffb347' : '#ff6b35';
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
  ctx.stroke(); ctx.setLineDash([]);
  pts.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(p[0], p[1], i===0?5:3.5, 0, Math.PI*2);
    ctx.fillStyle = i===0 ? '#ff4f6e' : '#fff'; ctx.fill();
  });
}

function drawRulers() {
  const area = document.getElementById('canvasArea');
  const w = area.clientWidth - 20, h = area.clientHeight;
  rulerH.width = w; rulerV.height = h;
  rHctx.clearRect(0, 0, w, 20);
  rVctx.clearRect(0, 0, 20, h);
  rHctx.fillStyle = '#1a1e2a'; rHctx.fillRect(0, 0, w, 20);
  rVctx.fillStyle = '#1a1e2a'; rVctx.fillRect(0, 0, 20, h);

  const step = getBestStep(state.zoom);
  rHctx.strokeStyle = '#2a2f42'; rHctx.fillStyle = '#5a6080';
  rHctx.font = '9px DM Mono,monospace'; rHctx.textAlign = 'center';
  const worldStart = s2w(0, 0), worldEnd = s2w(w, h);
  for (let wx = Math.floor(worldStart[0]/step)*step; wx < worldEnd[0]; wx += step) {
    const sx = wx * state.zoom + state.offset.x;
    if (sx < 0 || sx > w) continue;
    rHctx.beginPath(); rHctx.moveTo(sx, 14); rHctx.lineTo(sx, 20); rHctx.stroke();
    rHctx.fillText(formatRuler(wx, state.unit, state.scale), sx, 10);
  }
  rVctx.strokeStyle = '#2a2f42'; rVctx.fillStyle = '#5a6080';
  rVctx.font = '9px DM Mono,monospace'; rVctx.textAlign = 'right';
  for (let wy = Math.floor(worldStart[1]/step)*step; wy < worldEnd[1]; wy += step) {
    const sy = wy * state.zoom + state.offset.y;
    if (sy < 0 || sy > h) continue;
    rVctx.beginPath(); rVctx.moveTo(14, sy); rVctx.lineTo(20, sy); rVctx.stroke();
    rVctx.save(); rVctx.translate(10, sy); rVctx.rotate(-Math.PI/2);
    rVctx.fillText(formatRuler(wy, state.unit, state.scale), 0, 0); rVctx.restore();
  }
}

function getBestStep(zoom) {
  const steps = [5, 10, 20, 50, 100, 200, 500];
  for (const s of steps) { if (s * zoom >= 40) return s; }
  return 500;
}

function formatRuler(worldPx, unit, scale) {
  const real = worldPx / 100 * scale;
  if (unit === 'mm') return (real * 1000).toFixed(0);
  if (unit === 'ft') return (real * 3.28084).toFixed(1);
  if (unit === 'inch') return (real * 39.3701).toFixed(0);
  return real.toFixed(1);
}

// ── MOUSE ─────────────────────────────────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  const [wx, wy] = s2w(sx, sy);
  const [snx, sny] = snapPt(wx, wy);

  document.getElementById('sbX').textContent = formatReal(snx).toFixed(3);
  document.getElementById('sbY').textContent = formatReal(sny).toFixed(3);

  if (state.isPanning && state.panStart) {
    state.offset.x += sx - state.panStart.x;
    state.offset.y += sy - state.panStart.y;
    state.panStart = { x: sx, y: sy };
    render(); return;
  }

  if (state.calibrating && state.calPoints.length === 1) {
    const [p1sx, p1sy] = w2s(state.calPoints[0][0], state.calPoints[0][1]);
    state.calPixelDist = Math.sqrt((sx-p1sx)**2 + (sy-p1sy)**2);
    render();
    ctx.strokeStyle = '#4f7cff'; ctx.lineWidth = 1.5; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(p1sx, p1sy); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  if (state.drawing && state.points.length > 0) {
    const tip = document.getElementById('measureTip');
    tip.style.display = 'block';
    tip.style.left = (sx + 14) + 'px';
    tip.style.top = Math.max(0, sy - 22) + 'px';
    const last = state.points[state.points.length - 1];
    const dist = Math.sqrt((snx - last[0])**2 + (sny - last[1])**2);
    const real = (dist / 100 * state.scale).toFixed(2);
    const unit = state.unit;
    const disp = unit === 'mm' ? (real*1000).toFixed(0)+' mm' : unit === 'ft' ? (real*3.28084).toFixed(2)+' ft' : real+' m';
    document.getElementById('sbLive').textContent = disp;
    tip.textContent = disp;
    render();
    // rubber band
    const [px, py] = w2s(last[0], last[1]);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy); ctx.stroke(); ctx.setLineDash([]);
  }
});

canvas.addEventListener('mousedown', e => {
  const r = canvas.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;

  if (e.button === 1 || state.spaceDown) {
    e.preventDefault();
    state.isPanning = true; state.panStart = { x: sx, y: sy }; return;
  }
  if (state.tool === 'pan') { state.isPanning = true; state.panStart = { x: sx, y: sy }; return; }
  if (e.button === 2) return;

  const [wx, wy] = s2w(sx, sy);
  const [snx, sny] = snapPt(wx, wy);

  // Calibration
  if (state.calibrating) {
    state.calPoints.push([snx, sny]);
    if (state.calPoints.length === 1) {
      document.getElementById('calStep').textContent = 'Step 2: Click the second point';
    } else if (state.calPoints.length === 2) {
      const p1 = state.calPoints[0], p2 = state.calPoints[1];
      const px = Math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2);
      state.calPixelDist = px * state.zoom;
      document.getElementById('calStep').textContent = `Distance: ${px.toFixed(1)} px — Enter real distance:`;
      document.getElementById('calInputRow').style.display = 'flex';
    }
    return;
  }

  if (['length','area','volume'].includes(state.tool)) {
    state.drawing = true; state.points.push([snx, sny]);
  } else if (state.tool === 'count') {
    const m = { id: state.nextId++, type: 'count', points: [[snx, sny]], label: 'Count' };
    pushMeasurement(m); toast('Count point placed', 'success');
  } else if (state.tool === 'select') {
    hitTest(snx, sny);
  }
});

canvas.addEventListener('dblclick', e => {
  if (!state.drawing || state.points.length < 2) return;
  finalizeMeasurement();
});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (state.drawing) {
    if (state.points.length >= 2) finalizeMeasurement();
    else { state.drawing = false; state.points = []; document.getElementById('measureTip').style.display = 'none'; render(); }
  }
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const cx = e.clientX - r.left, cy = e.clientY - r.top;
  zoomAt(e.deltaY < 0 ? 1.1 : 0.91, cx, cy);
}, { passive: false });

document.addEventListener('mouseup', () => { state.isPanning = false; state.panStart = null; });

canvas.addEventListener('mouseleave', () => {
  document.getElementById('measureTip').style.display = 'none';
  document.getElementById('sbLive').textContent = '—';
});

// ── KEYBOARD ─────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  const k = e.key;
  if (k === ' ') { e.preventDefault(); state.spaceDown = true; canvas.style.cursor = 'grab'; return; }
  if (k === 'Escape') { setTool('select'); state.drawing = false; state.points = []; document.getElementById('measureTip').style.display = 'none'; render(); return; }
  if (k === 'l' || k === 'L') setTool('length');
  if (k === 'r' || k === 'R') setTool('area');
  if (k === 'c' || k === 'C') setTool('count');
  if (k === 'v' || k === 'V') setTool('volume');
  if (k === 'g' || k === 'G') toggleSnap('grid');
  if (k === 'k' || k === 'K') startCalibrate();
  if (k === 'Enter' && state.drawing && state.points.length >= 2) finalizeMeasurement();
  if ((k === 'Delete' || k === 'Backspace') && state.selectedId !== null) deleteSelected();
  if (e.ctrlKey || e.metaKey) {
    if (k === 'z') { e.preventDefault(); undo(); }
    if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    if (k === 's') { e.preventDefault(); saveProject(); }
    if (k === 'n') { e.preventDefault(); newProject(); }
    if (k === 'o') { e.preventDefault(); openProjectDialog(); }
    if (k === 'i') { e.preventDefault(); importDrawingDialog(); }
    if (k === 'e') { e.preventDefault(); exportReport(); }
    if (k === '0') { e.preventDefault(); fitView(); }
    if (k === '=') { e.preventDefault(); zoomBy(1.2); }
    if (k === '-') { e.preventDefault(); zoomBy(0.83); }
    if (k === '/') { e.preventDefault(); document.getElementById('shortcutsOverlay').classList.add('show'); }
  }
});

document.addEventListener('keyup', e => {
  if (e.key === ' ') {
    state.spaceDown = false;
    canvas.style.cursor = state.tool === 'select' ? 'default' : state.tool === 'pan' ? 'grab' : 'crosshair';
  }
});

// ── MEASURE LOGIC ─────────────────────────────────────────────────────────────
function finalizeMeasurement() {
  state.drawing = false;
  document.getElementById('measureTip').style.display = 'none';
  document.getElementById('sbLive').textContent = '—';
  const pts = [...state.points];
  let label = '', type = state.tool;

  if (type === 'length') {
    let total = 0;
    for (let i = 1; i < pts.length; i++)
      total += Math.sqrt((pts[i][0]-pts[i-1][0])**2 + (pts[i][1]-pts[i-1][1])**2);
    const real = (total / 100 * state.scale).toFixed(2);
    label = real + ' m';
  } else if (type === 'area') {
    const area = Math.abs(shoelace(pts));
    const realArea = (area / 10000 * state.scale * state.scale).toFixed(2);
    label = realArea + ' m²';
  } else if (type === 'volume') {
    const area = Math.abs(shoelace(pts));
    const realVol = (area / 10000 * state.scale * state.scale * 0.2).toFixed(3);
    label = realVol + ' m³';
  }

  const m = { id: state.nextId++, type, points: pts, label };
  pushMeasurement(m);
  state.points = [];
  addToRegisterRow(m, null, 0);
  logActivity('Measured ' + type, label);
  toast('Measurement added: ' + label, 'success');
  updateItemCount();
  render();
}

function shoelace(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i+1) % pts.length;
    s += pts[i][0]*pts[j][1] - pts[j][0]*pts[i][1];
  }
  return s / 2;
}

function pushMeasurement(m) {
  // Save to history
  if (state.historyIdx < state.history.length - 1) state.history.splice(state.historyIdx + 1);
  state.history.push(JSON.parse(JSON.stringify(state.measurements)));
  state.historyIdx = state.history.length - 1;
  state.measurements.push(m);
  render();
}

function formatReal(worldPx) {
  const real = worldPx / 100 * state.scale;
  if (state.unit === 'mm') return real * 1000;
  if (state.unit === 'ft') return real * 3.28084;
  if (state.unit === 'inch') return real * 39.3701;
  return real;
}

function hitTest(wx, wy) {
  // Simple bounding box hit test
  for (let i = state.measurements.length - 1; i >= 0; i--) {
    const m = state.measurements[i];
    if (m.type === 'count') {
      for (const p of m.points) {
        if (Math.abs(p[0]-wx) < 15 && Math.abs(p[1]-wy) < 15) {
          selectMeasurement(m.id); return;
        }
      }
    } else if (m.type === 'area' || m.type === 'volume') {
      if (pointInPoly(wx, wy, m.points)) { selectMeasurement(m.id); return; }
    } else if (m.type === 'length') {
      for (let j = 1; j < m.points.length; j++) {
        if (distToSeg(wx, wy, m.points[j-1], m.points[j]) < 8) { selectMeasurement(m.id); return; }
      }
    }
  }
  state.selectedId = null;
  document.getElementById('propsContent').innerHTML = '<div class="no-sel">No item selected.<br>Click a measurement on the canvas or takeoff list.</div>';
  render();
}

function pointInPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length-1; i < pts.length; j=i++) {
    const xi=pts[i][0], yi=pts[i][1], xj=pts[j][0], yj=pts[j][1];
    if ((yi>py) !== (yj>py) && px < ((xj-xi)*(py-yi))/(yj-yi)+xi) inside = !inside;
  }
  return inside;
}

function distToSeg(px, py, a, b) {
  const dx = b[0]-a[0], dy = b[1]-a[1];
  const lenSq = dx*dx + dy*dy;
  let t = ((px-a[0])*dx + (py-a[1])*dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((px-(a[0]+t*dx))**2 + (py-(a[1]+t*dy))**2);
}

function selectMeasurement(id) {
  state.selectedId = id;
  const m = state.measurements.find(m => m.id === id);
  if (m) showMeasurementProps(m);
  render();
  document.querySelectorAll('.ti-row').forEach(r => r.classList.remove('selected'));
  const row = document.querySelector(`[data-mid="${id}"]`);
  if (row) row.classList.add('selected');
}

function showMeasurementProps(m) {
  switchRightTab('props');
  let area = '—', perim = '—', vol = '—';
  if (m.type === 'area' || m.type === 'volume') {
    const a = Math.abs(shoelace(m.points));
    const realA = (a / 10000 * state.scale * state.scale).toFixed(2);
    area = realA + ' m²';
    vol = (a / 10000 * state.scale * state.scale * 0.2).toFixed(3) + ' m³';
    let p = 0;
    for (let i = 0; i < m.points.length; i++) {
      const j = (i+1) % m.points.length;
      p += Math.sqrt((m.points[j][0]-m.points[i][0])**2 + (m.points[j][1]-m.points[i][1])**2);
    }
    perim = (p / 100 * state.scale).toFixed(2) + ' m';
  } else if (m.type === 'length') {
    let total = 0;
    for (let i = 1; i < m.points.length; i++)
      total += Math.sqrt((m.points[i][0]-m.points[i-1][0])**2 + (m.points[i][1]-m.points[i-1][1])**2);
    area = (total / 100 * state.scale).toFixed(2) + ' m';
  }

  document.getElementById('propsContent').innerHTML = `
    <div class="prop-section">
      <div class="prop-section-title">Measurement</div>
      <div class="prop-row"><span class="prop-key">ID</span><span class="prop-val blue">#${m.id}</span></div>
      <div class="prop-row"><span class="prop-key">Type</span><span class="prop-val">${m.type.charAt(0).toUpperCase()+m.type.slice(1)}</span></div>
      <div class="prop-row"><span class="prop-key">Value</span><span class="prop-val green">${m.label}</span></div>
      <div class="prop-row"><span class="prop-key">Points</span><span class="prop-val">${m.points.length}</span></div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Dimensions</div>
      <div class="prop-row"><span class="prop-key">Area / Length</span><span class="prop-val yellow">${area}</span></div>
      ${m.type !== 'length' && m.type !== 'count' ? `<div class="prop-row"><span class="prop-key">Perimeter</span><span class="prop-val yellow">${perim}</span></div>` : ''}
      ${m.type === 'area' ? `<div class="prop-row"><span class="prop-key">Volume (0.2m)</span><span class="prop-val yellow">${vol}</span></div>` : ''}
      <div class="prop-row"><span class="prop-key">Scale</span><span class="prop-val blue">1:${state.scale}</span></div>
      <div class="prop-row"><span class="prop-key">Unit</span><span class="prop-val">${state.unit}</span></div>
    </div>`;
}

// ── UNDO / REDO ───────────────────────────────────────────────────────────────
function undo() {
  if (state.drawing) { state.points.pop(); render(); return; }
  if (state.historyIdx < 0) { toast('Nothing to undo', 'warn'); return; }
  state.measurements = JSON.parse(JSON.stringify(state.history[state.historyIdx]));
  state.historyIdx--;
  render(); rebuildTakeoff(); rebuildRegister();
  toast('Undone');
}

function redo() {
  if (state.historyIdx >= state.history.length - 1) { toast('Nothing to redo', 'warn'); return; }
  state.historyIdx++;
  state.measurements = JSON.parse(JSON.stringify(state.history[state.historyIdx]));
  render(); rebuildTakeoff(); rebuildRegister();
  toast('Redone');
}

function deleteSelected() {
  if (state.selectedId === null) { toast('Nothing selected', 'warn'); return; }
  state.history.push(JSON.parse(JSON.stringify(state.measurements)));
  state.historyIdx = state.history.length - 1;
  state.measurements = state.measurements.filter(m => m.id !== state.selectedId);
  // Remove from register
  const row = document.querySelector(`[data-mid="${state.selectedId}"]`);
  if (row) row.closest('tr')?.remove();
  const tiRow = document.querySelector(`.ti-row[data-mid="${state.selectedId}"]`);
  if (tiRow) tiRow.remove();
  state.selectedId = null;
  render(); updateItemCount();
  toast('Deleted');
}

// ── TOOLS ─────────────────────────────────────────────────────────────────────
function setTool(tool) {
  state.tool = tool;
  if (!state.calibrating) {
    state.drawing = false; state.points = [];
  }
  document.querySelectorAll('.tool-btn[id^="tool"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('tool' + tool.charAt(0).toUpperCase() + tool.slice(1));
  if (btn) btn.classList.add('active');
  canvas.style.cursor = tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair';
  document.getElementById('sbStatus').textContent = tool === 'select' ? 'Ready' : tool.charAt(0).toUpperCase()+tool.slice(1)+' tool active';
  render();
}

function toggleSnap(type) {
  if (type === 'grid') {
    state.snapGrid = !state.snapGrid;
    document.getElementById('snapGrid').classList.toggle('active', state.snapGrid);
    toast('Grid snap ' + (state.snapGrid ? 'ON' : 'OFF'));
  } else if (type === 'angle') {
    state.snapAngle = !state.snapAngle;
    document.getElementById('snapAngle').classList.toggle('active', state.snapAngle);
    toast('Angle snap ' + (state.snapAngle ? 'ON' : 'OFF'));
  }
}

// ── ZOOM ─────────────────────────────────────────────────────────────────────
function zoomAt(factor, cx, cy) {
  cx = cx ?? canvas.width / 2; cy = cy ?? canvas.height / 2;
  const prev = state.zoom;
  state.zoom = Math.min(10, Math.max(0.08, state.zoom * factor));
  state.offset.x = cx - (cx - state.offset.x) * (state.zoom / prev);
  state.offset.y = cy - (cy - state.offset.y) * (state.zoom / prev);
  const pct = Math.round(state.zoom * 100) + '%';
  document.getElementById('zoomVal').textContent = pct;
  document.getElementById('sbZoom').textContent = pct;
  render();
}

function zoomBy(f) { zoomAt(f); }

function fitView() {
  state.zoom = 1; state.offset = { x: 60, y: 40 };
  document.getElementById('zoomVal').textContent = '100%';
  document.getElementById('sbZoom').textContent = '100%';
  render();
}

// ── SCALE / CALIBRATE ─────────────────────────────────────────────────────────
function updateScale() {
  const val = document.getElementById('scaleInput').value.trim();
  const match = val.match(/1\s*:\s*(\d+)/);
  if (match) {
    state.scale = parseInt(match[1]);
    document.getElementById('sbScale').textContent = val;
    toast('Scale set to ' + val, 'success');
  } else toast('Use format 1:100', 'warn');
}

function changeUnit() {
  state.unit = document.getElementById('unitSelect').value;
  toast('Unit: ' + state.unit);
}

function startCalibrate() {
  state.calibrating = true;
  state.calPoints = [];
  document.getElementById('calibrateOverlay').style.display = 'flex';
  document.getElementById('calStep').textContent = 'Step 1: Click the first known point';
  document.getElementById('calInputRow').style.display = 'none';
  setTool('select');
}

function applyCalibration() {
  const dist = parseFloat(document.getElementById('calDist').value);
  const unit = document.getElementById('calUnit').value;
  if (!dist || dist <= 0) { toast('Enter a valid distance', 'warn'); return; }
  const realMetres = unit === 'mm' ? dist/1000 : unit === 'ft' ? dist*0.3048 : dist;
  const p1 = state.calPoints[0], p2 = state.calPoints[1];
  const px = Math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2);
  // px pixels = realMetres → px px per metre → scale = px * (100 / zoom) / realMetres
  const newScale = Math.round(px / (realMetres * 100 / state.zoom * state.zoom));
  // Simpler: pixel per real = px / realMetres → at 100px/unit:  scale = px_per_metre / 1
  state.scale = Math.round((px / state.zoom) / realMetres);
  document.getElementById('scaleInput').value = '1:' + state.scale;
  document.getElementById('sbScale').textContent = '1:' + state.scale;
  cancelCalibrate();
  toast('Scale calibrated: 1:' + state.scale, 'success');
  logActivity('Calibrated scale', '1:' + state.scale);
}

function cancelCalibrate() {
  state.calibrating = false;
  state.calPoints = [];
  document.getElementById('calibrateOverlay').style.display = 'none';
}

// ── UI PANELS ─────────────────────────────────────────────────────────────────
function switchLeftTab(tab) {
  ['drawings','layers'].forEach((t, i) => {
    document.getElementById('ltab'+(i+1)).classList.toggle('active', t === tab);
  });
  document.getElementById('paneDrawings').style.display = tab === 'drawings' ? '' : 'none';
  document.getElementById('paneLayers').style.display = tab === 'layers' ? '' : 'none';
}

function switchRightTab(tab) {
  const tabs = ['takeoff','props','cost'];
  tabs.forEach((t, i) => document.getElementById('rtab'+(i+1)).classList.toggle('active', t === tab));
  document.getElementById('rpTakeoff').style.display = tab === 'takeoff' ? '' : 'none';
  document.getElementById('rpProps').style.display = tab === 'props' ? '' : 'none';
  document.getElementById('rpCost').style.display = tab === 'cost' ? '' : 'none';
  if (tab === 'cost') renderCostPanel();
}

function switchBpTab(tab) {
  const tabs = ['register','log','dims'];
  tabs.forEach((t, i) => document.getElementById('bptab'+(i+1)).classList.toggle('active', t === tab));
  document.getElementById('bpRegister').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('bpLog').style.display = tab === 'log' ? '' : 'none';
  document.getElementById('bpDims').style.display = tab === 'dims' ? '' : 'none';
}

// ── DRAWING TREE ──────────────────────────────────────────────────────────────
const drawingTree = [
  { folder: 'Architectural', drawings: [
    { id: 'A-001', name: 'A-001 Ground Floor', done: true },
    { id: 'A-002', name: 'A-002 First Floor', count: 3 },
    { id: 'A-003', name: 'A-003 Roof Plan', count: 1 },
    { id: 'A-004', name: 'A-004 Elevations' },
  ]},
  { folder: 'MEP', drawings: [
    { id: 'M-001', name: 'M-001 HVAC Plan' },
    { id: 'E-001', name: 'E-001 Electrical' },
    { id: 'P-001', name: 'P-001 Plumbing' },
  ]},
  { folder: 'Civil', drawings: [
    { id: 'C-001', name: 'C-001 Site Plan', done: true },
    { id: 'C-002', name: 'C-002 Foundation' },
  ]},
];

function buildDrawingTree() {
  const el = document.getElementById('drawingTree');
  el.innerHTML = '';
  drawingTree.forEach(folder => {
    const fDiv = document.createElement('div');
    fDiv.className = 'tree-folder';
    fDiv.innerHTML = `<span class="fi">📁</span>${folder.folder}`;
    el.appendChild(fDiv);
    const childDiv = document.createElement('div');
    childDiv.className = 'tree-children';
    folder.drawings.forEach(d => {
      const item = document.createElement('div');
      item.className = 'tree-item' + (d.id === 'A-001' ? ' active' : '');
      item.innerHTML = `<span>📄</span>${d.name}${d.done ? '<span class="tree-badge done">✓</span>' : d.count ? `<span class="tree-badge">${d.count}</span>` : ''}`;
      item.onclick = () => {
        document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        state.currentDrawing = d.id;
        document.getElementById('sbDrawing').textContent = d.name;
        document.getElementById('titleProject').textContent = state.project.name + ' — ' + d.name;
        addCanvasTab(d);
        toast('Opened: ' + d.name);
      };
      childDiv.appendChild(item);
    });
    el.appendChild(childDiv);
  });
}

function addCanvasTab(drawing) {
  const tabs = document.getElementById('canvasTabs');
  if (document.getElementById('ctab-' + drawing.id)) {
    document.querySelectorAll('.canvas-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('ctab-' + drawing.id).classList.add('active');
    return;
  }
  document.querySelectorAll('.canvas-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('emptyTabAdd')?.remove();
  const tab = document.createElement('div');
  tab.className = 'canvas-tab active';
  tab.id = 'ctab-' + drawing.id;
  tab.innerHTML = `${drawing.name} <span class="tab-x" onclick="closeTab('${drawing.id}', event)">✕</span>`;
  tab.onclick = (e) => { if (!e.target.classList.contains('tab-x')) { document.querySelectorAll('.canvas-tab').forEach(t=>t.classList.remove('active')); tab.classList.add('active'); } };
  tabs.appendChild(tab);
  document.getElementById('emptyState').style.display = 'none';
}

function closeTab(id, e) {
  e.stopPropagation();
  document.getElementById('ctab-' + id)?.remove();
  if (!document.querySelector('.canvas-tab')) document.getElementById('emptyState').style.display = 'flex';
}

function buildLayerList() {
  const el = document.getElementById('layerList');
  el.innerHTML = '';
  state.layers.forEach(l => {
    const row = document.createElement('div');
    row.className = 'layer-row';
    row.innerHTML = `<div class="layer-dot-box" style="background:${l.color}"></div>${l.name}<span class="layer-vis ${l.visible ? 'on' : ''}" onclick="toggleLayer(${l.id})">👁</span>`;
    el.appendChild(row);
  });
}

function toggleLayer(id) {
  const l = state.layers.find(l => l.id === id);
  if (l) { l.visible = !l.visible; buildLayerList(); }
}

function addLayer() {
  const name = prompt('Layer name:');
  if (!name) return;
  const colors = ['#4f7cff','#3ddba0','#ffb347','#ff6b35','#7c5cff','#ff4f6e'];
  state.layers.push({ id: Date.now(), name: name.toUpperCase(), color: colors[state.layers.length % colors.length], visible: true });
  buildLayerList();
  toast('Layer added: ' + name);
}

// ── TAKEOFF / REGISTER ────────────────────────────────────────────────────────
function rebuildTakeoff() {
  // Simplified rebuild
  renderCostPanel();
}

function rebuildRegister() {
  // Simplified
}

function renderTakeoffGroups() {
  const el = document.getElementById('takeoffGroups');
  el.innerHTML = '';
  state.groups.forEach(g => {
    if (g.items.length === 0 && !['concrete','masonry','openings','finishes'].includes(g.id)) return;
    const wrap = document.createElement('div');
    wrap.className = 'tg-wrap fade-up';
    const total = g.items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0).toFixed(2);
    const unit = g.items.length > 0 ? (g.items[0].unit || '') : '';
    wrap.innerHTML = `<div class="tg-header" onclick="this.nextSibling.style.display=this.nextSibling.style.display==='none'?'':'none'"><div class="tg-left"><div class="tg-swatch" style="background:${g.color}"></div>${g.name}</div><span class="tg-total">${g.items.length > 0 ? total+' '+unit : '—'}</span></div><div id="grp-${g.id}"></div>`;
    el.appendChild(wrap);
    renderGroupItems(g);
  });
}

function renderGroupItems(g) {
  const el = document.getElementById('grp-' + g.id);
  if (!el) return;
  el.innerHTML = '';
  g.items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'ti-row';
    row.dataset.mid = item.id;
    row.innerHTML = `<span>${item.desc}</span><span class="ti-val">${item.qty}</span><span class="ti-unit">${item.unit}</span><button class="ti-del" onclick="event.stopPropagation();removeTakeoffItem('${g.id}','${item.id}')">✕</button>`;
    row.onclick = () => { document.querySelectorAll('.ti-row').forEach(r=>r.classList.remove('selected')); row.classList.add('selected'); };
    el.appendChild(row);
  });
}

function removeTakeoffItem(gid, iid) {
  const g = state.groups.find(g => g.id === gid);
  if (g) { g.items = g.items.filter(i => i.id !== iid); renderGroupItems(g); }
  const tr = document.querySelector(`#registerBody tr[data-iid="${iid}"]`);
  if (tr) tr.remove();
  toast('Item removed');
}

function openAddItemModal() {
  document.getElementById('modalOverlay').classList.add('show');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

function submitItem() {
  const desc  = document.getElementById('fDesc').value.trim() || 'New Item';
  const type  = document.getElementById('fType').value;
  const unit  = document.getElementById('fUnit').value;
  const qty   = parseFloat(document.getElementById('fQty').value) || 0;
  const rate  = parseFloat(document.getElementById('fRate').value) || 0;
  const gname = document.getElementById('fGroup').value;
  const notes = document.getElementById('fNotes').value;

  const item = { id: 'I' + state.nextItemNum++, desc, type, unit, qty, rate, notes };
  let g = state.groups.find(g => g.name === gname);
  if (!g && gname !== 'New Group…') { g = state.groups[0]; }
  if (g) { g.items.push(item); renderGroupItems(g); }

  addToRegisterRow(null, item, rate * qty);
  logActivity('Added item', desc + ' — ' + qty + ' ' + unit);
  toast('Added: ' + desc, 'success');
  closeModal();
  renderCostPanel();
  updateItemCount();
  ['fDesc','fQty','fRate','fNotes'].forEach(id => document.getElementById(id).value = '');
}

function addToRegisterRow(measurement, item, total) {
  const tbody = document.getElementById('registerBody');
  const tr = document.createElement('tr');
  const num = String(state.nextItemNum).padStart(3, '0');
  if (measurement) {
    const badgeClass = { area: 'badge-area', length: 'badge-length', count: 'badge-count', volume: 'badge-volume' }[measurement.type] || 'badge-area';
    tr.dataset.mid = measurement.id;
    tr.innerHTML = `
      <td class="dim-val">${num}</td>
      <td>Canvas Measurement</td>
      <td><span class="badge ${badgeClass}">${measurement.type.charAt(0).toUpperCase()+measurement.type.slice(1)}</span></td>
      <td style="color:var(--text3);font-size:11px">—</td>
      <td style="color:var(--text3);font-size:11px">${state.currentDrawing || '—'}</td>
      <td class="num">${measurement.label.split(' ')[0]}</td>
      <td>${measurement.label.split(' ')[1] || ''}</td>
      <td class="num">—</td>
      <td class="cost">—</td>
      <td style="color:var(--text3);font-size:11px">Live</td>
      <td><button class="ti-del" onclick="this.closest('tr').remove()">✕</button></td>`;
  } else if (item) {
    tr.dataset.iid = item.id;
    const badgeClass = { area: 'badge-area', length: 'badge-length', count: 'badge-count', volume: 'badge-volume' }[item.type.toLowerCase()] || 'badge-area';
    tr.innerHTML = `
      <td class="dim-val">${num}</td>
      <td>${item.desc}</td>
      <td><span class="badge ${badgeClass}">${item.type}</span></td>
      <td style="color:var(--text3);font-size:11px">—</td>
      <td style="color:var(--text3);font-size:11px">${state.currentDrawing || '—'}</td>
      <td class="num">${item.qty}</td>
      <td>${item.unit}</td>
      <td class="num">${item.rate.toLocaleString('en-IN')}</td>
      <td class="cost">${total.toLocaleString('en-IN')}</td>
      <td style="color:var(--text3);font-size:11px">${item.notes || ''}</td>
      <td><button class="ti-del" onclick="this.closest('tr').remove()">✕</button></td>`;
  }
  tbody.prepend(tr);
}

function renderCostPanel() {
  const allItems = state.groups.flatMap(g => g.items);
  const grandTotal = allItems.reduce((s, i) => s + (i.qty * i.rate || 0), 0);
  const gst = grandTotal * 0.18;
  const withGst = grandTotal + gst;

  const fmt = n => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  document.getElementById('costContent').innerHTML = `
    <div class="cost-total-box">
      <div class="ct-label">Total Project Cost (excl. GST)</div>
      <div class="ct-amount">${fmt(grandTotal)}</div>
      <div class="ct-sub">+ GST @18% ${fmt(gst)} &nbsp;→&nbsp; Total ${fmt(withGst)}</div>
    </div>
    <div class="cost-card">
      <div class="cost-card-title">Breakdown by Trade</div>
      ${state.groups.map(g => {
        const tot = g.items.reduce((s,i) => s + (i.qty*i.rate||0), 0);
        const pct = grandTotal ? Math.round(tot/grandTotal*100) : 0;
        return `<div class="cb-row">
          <div class="cb-label"><div style="width:8px;height:8px;border-radius:2px;background:${g.color}"></div>${g.name.split(' ')[0]}</div>
          <div class="cb-bar-bg"><div class="cb-bar" style="width:${pct}%;background:${g.color}"></div></div>
          <div class="cb-val">${fmt(tot)}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="cost-card">
      <div class="cost-card-title">Cost Metrics</div>
      <div class="prop-row"><span class="prop-key">Total Items</span><span class="prop-val">${allItems.length}</span></div>
      <div class="prop-row"><span class="prop-key">Canvas Measurements</span><span class="prop-val">${state.measurements.length}</span></div>
      <div class="prop-row"><span class="prop-key">Drawings Loaded</span><span class="prop-val">${document.querySelectorAll('.canvas-tab').length}</span></div>
    </div>
    <button class="btn-primary" style="width:100%;padding:9px;font-size:13px;margin-top:6px" onclick="exportReport()">⬇ Export Cost Report</button>`;
}

// ── ACTIVITY LOG ──────────────────────────────────────────────────────────────
function logActivity(action, details) {
  const now = new Date();
  const time = now.toTimeString().split(' ')[0];
  state.activityLog.unshift({ time, action, details });
  const tbody = document.getElementById('logBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `<td class="dim-val">${time}</td><td>${action}</td><td style="color:var(--text3);font-size:11px">${details}</td>`;
  tbody.prepend(tr);
}

// ── IMPORT / EXPORT ───────────────────────────────────────────────────────────
async function importDrawingDialog() {
  if (!window.electronAPI) {
    toast('Running in browser — drag & drop image files onto the canvas', 'warn'); return;
  }
  const files = await window.electronAPI.importDrawing();
  if (!files) return;
  files.forEach(f => {
    if (['.png','.jpg','.jpeg','.tiff','.webp'].includes(f.ext)) {
      const img = new Image();
      img.onload = () => { state.drawingImage = img; document.getElementById('emptyState').style.display = 'none'; render(); };
      img.src = 'file://' + f.path;
    }
    const d = { id: f.name.replace(/\.[^.]+$/, ''), name: f.name };
    addCanvasTab(d);
    state.currentDrawing = d.id;
    document.getElementById('sbDrawing').textContent = f.name;
    logActivity('Imported drawing', f.name);
    toast('Imported: ' + f.name, 'success');
  });
}

// Drag & drop onto canvas
document.getElementById('canvasArea').addEventListener('dragover', e => { e.preventDefault(); });
document.getElementById('canvasArea').addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => { state.drawingImage = img; document.getElementById('emptyState').style.display = 'none'; render(); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    const d = { id: file.name, name: file.name };
    addCanvasTab(d);
    state.currentDrawing = d.id;
    document.getElementById('sbDrawing').textContent = file.name;
    logActivity('Drag-dropped drawing', file.name);
    toast('Loaded: ' + file.name, 'success');
  } else toast('Supported: PNG, JPG, TIFF images', 'warn');
});

async function saveProject() {
  const data = {
    projectName: state.project.name,
    scale: state.scale,
    unit: state.unit,
    measurements: state.measurements,
    groups: state.groups,
    activityLog: state.activityLog,
    savedAt: new Date().toISOString(),
  };
  if (window.electronAPI) {
    const path = await window.electronAPI.saveProject(data);
    if (path) toast('Saved: ' + path.split('/').pop(), 'success');
  } else {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = state.project.name + '.qcad'; a.click();
    toast('Downloaded project file', 'success');
  }
  logActivity('Saved project', state.project.name);
}

async function openProjectDialog() {
  if (window.electronAPI) {
    const data = await window.electronAPI.openProject();
    if (data) loadProject(data);
  } else toast('Use File > Open in the desktop app', 'warn');
}

function loadProject(data) {
  if (data.scale) state.scale = data.scale;
  if (data.unit) state.unit = data.unit;
  if (data.measurements) state.measurements = data.measurements;
  if (data.groups) state.groups = data.groups;
  if (data.projectName) { state.project.name = data.projectName; document.getElementById('titleProject').textContent = data.projectName; }
  render(); renderTakeoffGroups(); renderCostPanel();
  toast('Project loaded', 'success');
}

function newProject() {
  if (!confirm('Start a new project? Unsaved changes will be lost.')) return;
  state.measurements = [];
  state.groups = defaultGroups();
  state.history = []; state.historyIdx = -1;
  state.drawingImage = null;
  state.selectedId = null;
  document.getElementById('registerBody').innerHTML = '';
  document.getElementById('canvasTabs').innerHTML = '';
  document.getElementById('emptyState').style.display = 'flex';
  render(); renderTakeoffGroups(); renderCostPanel();
  toast('New project started');
}

async function exportReport() {
  const allItems = state.groups.flatMap(g => g.items);
  let csv = 'No,Description,Type,Qty,Unit,Unit Rate,Total\n';
  allItems.forEach((item, i) => {
    csv += `${i+1},"${item.desc}",${item.type},${item.qty},${item.unit},${item.rate},${item.qty*item.rate}\n`;
  });
  state.measurements.forEach((m, i) => {
    csv += `M${i+1},"Canvas: ${m.type}",${m.type},${m.label.split(' ')[0]},${m.label.split(' ')[1]||''},—,—\n`;
  });
  if (window.electronAPI) {
    const path = await window.electronAPI.exportReport({ type: 'csv', content: csv });
    if (path) toast('Exported: ' + path.split('/').pop(), 'success');
  } else {
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'QuantaCAD_Report.csv'; a.click();
    toast('Report downloaded', 'success');
  }
  logActivity('Exported report', 'CSV');
}

function exportCSV() { exportReport(); }

function showCostSummary() { switchRightTab('cost'); }

// ── MENU EVENTS FROM MAIN PROCESS ─────────────────────────────────────────────
if (window.electronAPI) {
  window.electronAPI.onMenu(cmd => {
    const map = {
      'new-project': newProject, 'save': saveProject, 'export-pdf': exportReport,
      'export-xlsx': exportReport, 'undo': undo, 'redo': redo, 'delete': deleteSelected,
      'zoom-in': () => zoomBy(1.2), 'zoom-out': () => zoomBy(0.83), 'fit': fitView,
      'snap-grid': () => toggleSnap('grid'), 'calibrate': startCalibrate,
      'tool-select': () => setTool('select'), 'tool-length': () => setTool('length'),
      'tool-area': () => setTool('area'), 'tool-count': () => setTool('count'),
      'tool-volume': () => setTool('volume'),
      'report-cost': showCostSummary,
      'shortcuts': () => document.getElementById('shortcutsOverlay').classList.add('show'),
      'settings': () => toast('Project settings coming soon'),
    };
    if (map[cmd]) map[cmd]();
  });

  // Window controls
  document.getElementById('btnMin').addEventListener('click', () => window.electronAPI.minimize());
  document.getElementById('btnMax').addEventListener('click', () => window.electronAPI.maximize());
  document.getElementById('btnClose').addEventListener('click', async () => {
    const { response } = await window.electronAPI.showMessage({ type: 'question', title: 'Exit QuantaCAD', message: 'Save project before exiting?', buttons: ['Save & Exit', "Don't Save", 'Cancel'] });
    if (response === 0) { await saveProject(); window.electronAPI.close(); }
    else if (response === 1) window.electronAPI.close();
  });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function updateItemCount() {
  const total = state.measurements.length + state.groups.flatMap(g => g.items).length;
  document.getElementById('sbItems').textContent = total;
}

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── SPLITTER DRAG ─────────────────────────────────────────────────────────────
const splitter = document.getElementById('splitterH');
let draggingSplitter = false, splitterStartY = 0, splitterStartH = 0;
splitter.addEventListener('mousedown', e => {
  draggingSplitter = true; splitterStartY = e.clientY;
  splitterStartH = document.getElementById('bottomPanel').clientHeight;
  document.body.style.cursor = 'ns-resize';
});
document.addEventListener('mousemove', e => {
  if (!draggingSplitter) return;
  const delta = splitterStartY - e.clientY;
  const newH = Math.max(80, Math.min(400, splitterStartH + delta));
  document.getElementById('bottomPanel').style.height = newH + 'px';
});
document.addEventListener('mouseup', () => { draggingSplitter = false; document.body.style.cursor = ''; });

// ── INIT ──────────────────────────────────────────────────────────────────────
window.addEventListener('resize', resizeCanvas);

buildDrawingTree();
buildLayerList();
renderTakeoffGroups();
logActivity('Application started', 'QuantaCAD v1.0.0');
resizeCanvas();
