/* Querkles v2.4 – app.js
 * - Numbered Circles (1..5) + Classic Rings
 * - Poisson-Disk (Bridson) + quantized radius (5 sizes)
 * - Edge-weighted sampling لإبراز الملامح
 * - Density controls: direct, target-based, and nudges
 * - Export PNG/SVG/PDF (A6→A3) + Save settings
 */

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);

const file = $('file');
const btnProcess = $('btnProcess');
const btnSave = $('btnSaveSettings');
const btnExport = $('btnExport');
const modeClassic = $('modeClassic');

const exportName = $('exportName');
const c1 = $('c1'), c2 = $('c2'), c3 = $('c3'), c4 = $('c4'), c5 = $('c5');

const paperSize = $('paperSize');
const orientation = $('orientation');
const dpi = $('dpi');
const exportFormat = $('exportFormat');

const cSrc = $('src'); const ctxSrc = cSrc.getContext('2d', { willReadFrequently: true });
const cOut = $('out'); const ctxOut = cOut.getContext('2d');

/* ---------- State / Config ---------- */
let meta = { w: 0, h: 0 };
let imgData = null;
let lastCircles = []; // [{x,y,r,label,classic?}]
window.__lastCoverage = 0; // نخزّن آخر تغطية محسوبة

const CFG = {
    rMin: 3,        // أصغر دائرة (الظلال)
    rMax: 18,       // أكبر دائرة (المناطق الفاتحة)
    k: 18,          // محاولات Bridson لكل نقطة نشطة
    density: 0.87,  // ✨ كثافة افتراضية معاد ضبطها ~50% تغطية
    ringAlpha: 0.35,
    fillAlpha: 0.08
};

/* ---------- Utils ---------- */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const lerp = (a, b, t) => a + (b - a) * t;

const gray = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b; // 0..255
const bin5 = g => { const b = Math.min(4, Math.floor(g / 51)); return 5 - b; }; // 1..5 (أغمق=5)

function hexA(hex, a) {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
    if (!m) return `rgba(0,0,0,${a})`;
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    return `rgba(${r},${g},${b},${a})`;
}

/* A sizes */
const A = { A3: { w: 297, h: 420 }, A4: { w: 210, h: 297 }, A5: { w: 148, h: 210 }, A6: { w: 105, h: 148 } };
const mmToPx = (mm, d) => Math.round((mm / 25.4) * d);
function sizePx(sz, ori, d) {
    const mm = A[sz] || A.A4;
    const wmm = ori === 'landscape' ? mm.h : mm.w;
    const hmm = ori === 'landscape' ? mm.w : mm.h;
    return { w: mmToPx(wmm, d), h: mmToPx(hmm, d) };
}

/* ---------- Settings ---------- */
function saveSettings() {
    localStorage.setItem('qk_v24', JSON.stringify({
        name: exportName.value.trim() || 'querkles',
        pal: [c1.value, c2.value, c3.value, c4.value, c5.value],
        size: paperSize.value, ori: orientation.value,
        dpi: clamp(parseFloat(dpi.value) || 300, 150, 600),
        fmt: exportFormat.value, classic: !!modeClassic.checked,
        density: CFG.density
    }));
    alert('تم حفظ الإعدادات ✅');
}
function loadSettings() {
    try {
        const s = JSON.parse(localStorage.getItem('qk_v24') || '{}');
        if (s.name) exportName.value = s.name;
        if (s.pal?.length === 5) [c1.value, c2.value, c3.value, c4.value, c5.value] = s.pal;
        if (s.size) paperSize.value = s.size;
        if (s.ori) orientation.value = s.ori;
        if (s.dpi) dpi.value = clamp(s.dpi, 150, 600);
        if (s.fmt) exportFormat.value = s.fmt;
        if (typeof s.classic === 'boolean') modeClassic.checked = s.classic;
        if (typeof s.density === 'number') CFG.density = clamp(s.density, 0.5, 1.5);
    } catch (_) { }
}

/* ---------- Image ---------- */
file.addEventListener('change', e => {
    const f = e.target.files?.[0]; if (!f) return;
    const img = new Image();
    img.onload = () => {
        const maxW = 1400, s = Math.min(1, maxW / img.width);
        meta.w = Math.round(img.width * s); meta.h = Math.round(img.height * s);
        cSrc.width = meta.w; cSrc.height = meta.h;
        cOut.width = meta.w; cOut.height = meta.h;
        ctxSrc.drawImage(img, 0, 0, meta.w, meta.h);
        imgData = ctxSrc.getImageData(0, 0, meta.w, meta.h);
        ctxOut.drawImage(img, 0, 0, meta.w, meta.h);
    };
    img.src = URL.createObjectURL(f);
});

/* ---------- Sampling (bilinear + mean) ---------- */
function sampleGray(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const x2 = clamp(xi + 1, 0, meta.w - 1), y2 = clamp(yi + 1, 0, meta.h - 1);
    const fx = x - xi, fy = y - yi;
    const idx = (xx, yy) => ((yy * meta.w + xx) << 2);
    const d = imgData.data;
    const i00 = idx(xi, yi), i10 = idx(x2, yi), i01 = idx(xi, y2), i11 = idx(x2, y2);
    const g00 = gray(d[i00], d[i00 + 1], d[i00 + 2]);
    const g10 = gray(d[i10], d[i10 + 1], d[i10 + 2]);
    const g01 = gray(d[i01], d[i01 + 1], d[i01 + 2]);
    const g11 = gray(d[i11], d[i11 + 1], d[i11 + 2]);
    const gx0 = g00 * (1 - fx) + g10 * fx, gx1 = g01 * (1 - fx) + g11 * fx;
    return gx0 * (1 - fy) + gx1 * fy;
}
function meanGray(x, y, r, rings = 2, samples = 10) {
    let sum = 0, cnt = 0;
    for (let ring = 1; ring <= rings; ring++) {
        const rr = (r * ring) / (rings + 0.3);
        for (let i = 0; i < samples; i++) {
            const t = (i / samples) * Math.PI * 2;
            const px = clamp(x + Math.cos(t) * rr, 0, meta.w - 1);
            const py = clamp(y + Math.sin(t) * rr, 0, meta.h - 1);
            sum += sampleGray(px, py); cnt++;
        }
    }
    sum += sampleGray(x, y) * samples; cnt += samples; // وزن للمركز
    return sum / cnt;
}

/* ---------- Quantized radius (5 أحجام) ---------- */
function quantizedRadiusAt(x, y) {
    const tone = sampleGray(x, y) / 255;     // 0=أسود .. 1=أبيض
    // Radii من الأغمق (صغير) للأفتح (كبير) – عدّلها لو حبيت
    const radii = [CFG.rMin, CFG.rMin + 3, 9, 13, CFG.rMax];
    const bin = 5 - Math.min(4, Math.floor((tone * 255) / 51)); // 1..5
    return radii[bin - 1];
}

/* ---------- Edge weight (يبين الحواف) ---------- */
function edgeWeight(x, y) {
    const g1 = sampleGray(clamp(x + 1, 0, meta.w - 1), y);
    const g2 = sampleGray(clamp(x - 1, 0, meta.w - 1), y);
    const g3 = sampleGray(x, clamp(y + 1, 0, meta.h - 1));
    const g4 = sampleGray(x, clamp(y - 1, 0, meta.h - 1));
    const gx = Math.abs(g1 - g2), gy = Math.abs(g3 - g4);
    const mag = Math.min(255, Math.hypot(gx, gy));
    return clamp(mag / 128, 0.0, 1.0); // 0..1
}

/* ---------- Poisson-Disk (Bridson) ---------- */
function generatePoisson() {
    const w = meta.w, h = meta.h; if (!w) { alert('حمّل صورة أول'); return []; }

    const cell = CFG.rMin / Math.SQRT2;
    const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
    const grid = new Array(cols * rows).fill(-1);
    const gidx = (x, y) => Math.floor(x / cell) + Math.floor(y / cell) * cols;

    const pts = [], active = [];
    function add(x, y) {
        const r = quantizedRadiusAt(x, y);
        const id = pts.length;
        pts.push({ x, y, r });
        grid[gidx(x, y)] = id;
        active.push(id);
        return id;
    }

    add(rand(0, w), rand(0, h)); // seed

    while (active.length) {
        const ai = irand(0, active.length - 1);
        const p = pts[active[ai]];
        let placed = false;

        for (let t = 0; t < CFG.k; t++) {
            const base = p.r;
            const R = rand(base, base * 2.5);
            const a = rand(0, Math.PI * 2);
            const x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R;
            if (x <= 0 || y <= 0 || x >= w || y >= h) continue;

            const rNew = quantizedRadiusAt(x, y);
            const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
            const search = Math.floor(rNew / cell) + 2;
            let ok = true;

            for (let yy = gy - search; yy <= gy + search && ok; yy++) {
                if (yy < 0 || yy >= rows) continue;
                for (let xx = gx - search; xx <= gx + search; xx++) {
                    if (xx < 0 || xx >= cols) continue;
                    const qid = grid[xx + yy * cols];
                    if (qid === -1) continue;
                    const q = pts[qid];
                    const dx = x - q.x, dy = y - q.y;
                    const minD = (rNew + q.r) * 1.04;
                    if (dx * dx + dy * dy < minD * minD) { ok = false; break; }
                }
            }
            if (!ok) continue;

            const tone = sampleGray(x, y) / 255;
            const ew = edgeWeight(x, y);
            // قبول متزن: أغمق ⇒ احتمال أعلى، ومع الحواف يزيد
            const accept = Math.random() < clamp((1.05 - tone) * (0.7 + 0.6 * ew) * CFG.density, 0.35, 0.95);
            if (!accept) continue;

            add(x, y); placed = true; break;
        }
        if (!placed) active.splice(ai, 1);
    }
    return pts;
}

/* ---------- Drawing ---------- */
function drawNumbered(points) {
    const pal = [c1.value, c2.value, c3.value, c4.value, c5.value];
    ctxOut.fillStyle = '#fff'; ctxOut.fillRect(0, 0, meta.w, meta.h);

    const out = [];
    for (const p of points) {
        const g = meanGray(p.x, p.y, p.r, 2, 10);
        const label = bin5(g);

        // دائرة
        ctxOut.beginPath();
        ctxOut.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctxOut.strokeStyle = '#111';
        ctxOut.lineWidth = 0.9;
        ctxOut.stroke();

        // رقم
        ctxOut.fillStyle = '#000';
        ctxOut.font = `${Math.max(9, Math.round(p.r * 0.9))}px ui-sans-serif`;
        ctxOut.textAlign = 'center'; ctxOut.textBaseline = 'middle';
        ctxOut.fillText(String(label), p.x, p.y + 0.5);

        // تعبئة خفيفة تساعد التلوين
        ctxOut.globalAlpha = CFG.fillAlpha;
        ctxOut.beginPath(); ctxOut.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctxOut.fillStyle = pal[label - 1]; ctxOut.fill();
        ctxOut.globalAlpha = 1;

        out.push({ x: p.x, y: p.y, r: p.r, label });
    }
    return out;
}

function drawClassic(points) {
    const pal = [c1.value, c2.value, c3.value, c4.value, c5.value];
    ctxOut.fillStyle = '#fff'; ctxOut.fillRect(0, 0, meta.w, meta.h);

    const out = [];
    for (const p of points) {
        const g = meanGray(p.x, p.y, p.r, 2, 8);
        const bin = bin5(g); // 1..5
        const layers = 3 + Math.round((6 - 3) * (1 - g / 255)); // أغمق ⇒ طبقات أكثر

        for (let k = 0; k < layers; k++) {
            const rr = p.r * (1 + k * 0.35);
            ctxOut.beginPath();
            ctxOut.arc(p.x, p.y, rr, 0, Math.PI * 2);
            ctxOut.lineWidth = Math.max(1, rr * 0.06);
            ctxOut.strokeStyle = hexA(pal[bin - 1], clamp(CFG.ringAlpha - k * 0.05, 0.06, 0.9));
            ctxOut.stroke();
            out.push({ x: p.x, y: p.y, r: rr, label: bin, classic: true });
        }
    }
    return out;
}

/* ---------- Export ---------- */
function exportPNGPrint(W, H) {
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
    const t = tmp.getContext('2d'); t.imageSmoothingQuality = 'high';
    t.fillStyle = '#fff'; t.fillRect(0, 0, W, H);
    t.drawImage(cOut, 0, 0, cOut.width, cOut.height, 0, 0, W, H);
    const a = document.createElement('a');
    a.href = tmp.toDataURL('image/png');
    a.download = `${(exportName.value || 'querkles')}-${paperSize.value}-${orientation.value}-${dpi.value}dpi.png`;
    a.click();
}
function exportSVG(W, H) {
    const pal = [c1.value, c2.value, c3.value, c4.value, c5.value];
    const sx = W / meta.w, sy = H / meta.h;
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
        `<rect width="100%" height="100%" fill="#ffffff"/>`];
    for (const c of lastCircles) {
        const x = (c.x * sx).toFixed(2), y = (c.y * sy).toFixed(2);
        const r = (c.r * ((sx + sy) / 2)).toFixed(2);
        if (c.classic) {
            const sw = Math.max(1, c.r * 0.06 * sx).toFixed(2);
            const col = pal[(c.label || 1) - 1];
            parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${col}" stroke-opacity="${CFG.ringAlpha}" stroke-width="${sw}"/>`);
        } else {
            parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#111" stroke-width="0.9"/>`);
            const fs = Math.max(9, Math.floor(c.r * 0.9)).toFixed(0);
            parts.push(`<text x="${x}" y="${y}" font-family="ui-sans-serif,Arial" font-size="${fs}" text-anchor="middle" dominant-baseline="central" fill="#000">${c.label}</text>`);
            const col = pal[(c.label || 1) - 1];
            parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" opacity="${CFG.fillAlpha}"/>`);
        }
    }
    parts.push(`</svg>`);
    const blob = new Blob([parts.join('')], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${(exportName.value || 'querkles')}-${paperSize.value}-${orientation.value}.svg`;
    a.click(); URL.revokeObjectURL(url);
}
function exportPDF(W, H) {
    const pal = [c1.value, c2.value, c3.value, c4.value, c5.value];
    const sx = W / meta.w, sy = H / meta.h;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#fff"/>`;
    for (const c of lastCircles) {
        const x = (c.x * sx).toFixed(2), y = (c.y * sy).toFixed(2);
        const r = (c.r * ((sx + sy) / 2)).toFixed(2);
        if (c.classic) {
            const sw = Math.max(1, c.r * 0.06 * sx).toFixed(2);
            const col = pal[(c.label || 1) - 1];
            svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${col}" stroke-opacity="${CFG.ringAlpha}" stroke-width="${sw}"/>`;
        } else {
            svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#111" stroke-width="0.9"/>`;
            const fs = Math.max(9, Math.floor(c.r * 0.9)).toFixed(0);
            svg += `<text x="${x}" y="${y}" font-family="ui-sans-serif,Arial" font-size="${fs}" text-anchor="middle" dominant-baseline="central" fill="#000">${c.label}</text>`;
        }
    }
    svg += `</svg>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Print</title><style>html,body{margin:0}</style></head><body>${svg}</body></html>`;
    const w = window.open('', '_blank'); if (!w) { alert('فعّل Pop-ups للطباعة'); return; }
    w.document.open(); w.document.write(html); w.document.close(); w.onload = () => w.print();
}

/* ---------- Actions ---------- */
btnProcess.addEventListener('click', () => {
    if (!meta.w || !imgData) { alert('حمّل صورة أول'); return; }

    const points = generatePoisson();
    lastCircles = modeClassic.checked ? drawClassic(points) : drawNumbered(points);

    const total = lastCircles.length;
    let area = 0; for (const c of lastCircles) area += Math.PI * c.r * c.r;
    const cov = +((area / (meta.w * meta.h)) * 100).toFixed(2);
    window.__lastCoverage = cov;
    console.log({ total, coverage: cov + '%' });
    alert(`Total: ${total}\nCoverage: ${cov}%\nDensity: ${CFG.density}`);
});
btnSave.addEventListener('click', saveSettings);
btnExport.addEventListener('click', () => {
    if (!meta.w || !lastCircles.length) { alert('حوّل (Convert) قبل التصدير'); return; }
    const { w, h } = sizePx(paperSize.value, orientation.value, clamp(parseFloat(dpi.value) || 300, 150, 600));
    const f = exportFormat.value;
    if (f === 'svg') exportSVG(w, h);
    else if (f === 'pdf') exportPDF(w, h);
    else exportPNGPrint(w, h);
});

/* ---------- Density helpers (جديدة) ---------- */
// اضبط الـ density تلقائياً عشان تحقق نسبة تغطية مستهدفة (٪)
function setDensityForTarget(targetPercent) {
    const currentCov = window.__lastCoverage || 60;      // احتياطي
    const currentDen = CFG.density;
    const newDen = clamp(currentDen * (targetPercent / currentCov), 0.5, 1.5);
    CFG.density = +newDen.toFixed(2);
    console.log(`Density → ${CFG.density} (target ${targetPercent}%)`);
    alert(`Density = ${CFG.density} (target ${targetPercent}%) — اضغط Convert من جديد`);
}
// زيادات/نقصات خفيفة إذا حسّيت التفاصيل قلت/زادت
function nudgeDensityUp(step = 0.05) {
    CFG.density = +clamp(CFG.density + step, 0.5, 1.5).toFixed(2);
    console.log(`Density up → ${CFG.density}`); alert(`Density ↑ = ${CFG.density} — اضغط Convert`);
}
function nudgeDensityDown(step = 0.05) {
    CFG.density = +clamp(CFG.density - step, 0.5, 1.5).toFixed(2);
    console.log(`Density down → ${CFG.density}`); alert(`Density ↓ = ${CFG.density} — اضغط Convert`);
}

// ملاحظات: 0.70–0.85 يعطيك تغطية كتاب تلوين كلاسيكي (~35–45%)

/* ---------- Init ---------- */
loadSettings();

// 🛈 للاستخدام السريع من الكونسول:
// setDensityForTarget(50)  → يضبط كثافة تقرّبك من 50%
// nudgeDensityUp() / nudgeDensityDown() → تغييرات طفيفة
