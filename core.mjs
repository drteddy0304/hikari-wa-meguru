// Versioned, browser-local contribution data. No image bytes, filenames or EXIF leave the device.
export const VERSION = 1;
export const DURATION = 12;
export const SCHEDULE = [
  ['2026-11-01T00:00:00+09:00', 0],
  ['2027-04-23T00:00:00+09:00', 1],
];
export const LINKS = { artist: null, music: null, ticket: null, album: null };
export const SHARE_TEXT = '私の撮った月の光が、CDの盤面デザインの一部に。\n山形りお「ひかりはめぐる」\n2027年4月24日（土）青山 月見ル君想フ\n#山形りお #ひかりはめぐる';
export const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
// One campaign phase per Japan calendar day, independent of submission count.
export function phaseAt(date = new Date()) {
  const day=86400000,offset=9*3600000;
  const current=Math.floor((+date+offset)/day);
  const start=Math.floor((Date.parse(SCHEDULE[0][0])+offset)/day);
  const end=Math.floor((Date.parse(SCHEDULE[1][0])+offset)/day);
  return clamp((current-start)/(end-start));
}
// A small personal addition in this video only; never persisted to the calendar.
export const personalPhase = phase => clamp(phase)+(1-clamp(phase))*.025;
export function random(seed) {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const luminance = (r, g, b) => (.2126 * r + .7152 * g + .0722 * b) / 255;

// Bright connected components are candidates, never a semantic claim that this is the moon.
export function detectMoon({ data, width, height }) {
  const values = [];
  for (let i = 0; i < data.length; i += 4) values.push(luminance(data[i], data[i + 1], data[i + 2]));
  const ordered = [...values].sort((a, b) => a - b);
  const threshold = Math.max(.32, ordered[Math.floor(ordered.length * .992)] * .72);
  const seen = new Uint8Array(values.length);
  let best = null;
  for (let i = 0; i < values.length; i++) {
    if (seen[i] || values[i] < threshold) continue;
    const stack = [i]; seen[i] = 1;
    let area = 0, sx = 0, sy = 0, weight = 0;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    while (stack.length) {
      const p = stack.pop(), x = p % width, y = Math.floor(p / width), v = values[p];
      area++; sx += x * v; sy += y * v; weight += v;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const n = ny * width + nx;
        if (!seen[n] && values[n] >= threshold) { seen[n] = 1; stack.push(n); }
      }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const compactness = area / (bw * bh), aspect = Math.min(bw, bh) / Math.max(bw, bh);
    const score = weight * compactness * Math.max(.1, aspect);
    if (area >= 2 && area < width * height * .4 && (!best || score > best.score)) best = {
      x: sx / weight / width, y: sy / weight / height,
      radius: clamp(Math.max(bw, bh) * .64 / Math.min(width, height), .015, .45), score,
    };
  }
  return best ? { x: best.x, y: best.y, radius: best.radius, found: true } : { x: .5, y: .5, radius: .12, found: false };
}

export function extractLight(image, selection) {
  const { data, width, height } = image;
  let hash = 2166136261;
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) hash = Math.imul(hash ^ data[i + c], 16777619);
  for (const v of [selection.x, selection.y, selection.radius]) hash = Math.imul(hash ^ Math.round(v * 10000), 16777619);
  const radius = selection.radius * Math.min(width, height), cx = selection.x * width, cy = selection.y * height;
  const candidates = [];
  for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(height, cy + radius); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(width, cx + radius); x++) {
      const dx = (x - cx) / radius, dy = (y - cy) / radius;
      if (dx * dx + dy * dy > 1) continue;
      const p = (y * width + x) * 4, rgb = [data[p], data[p + 1], data[p + 2]];
      candidates.push({ x: x / width, y: y / height, rgb, light: luminance(...rgb) });
    }
  }
  const sorted = candidates.map(p => p.light).sort((a,b) => a-b);
  const threshold = Math.max(.025, (sorted[Math.floor(sorted.length * .9)] || 0) * .28);
  const bright = candidates.filter(p => p.light >= threshold);
  if (!bright.length) throw new Error('この範囲には十分な光が見つかりません。月の位置や範囲を調整してください。');
  let total = 0, brightness = 0; const rgb = [0,0,0];
  for (const p of bright) { const w = p.light ** 2; total += w; brightness += p.light * w; for (let i=0;i<3;i++) rgb[i] += p.rgb[i] * w; }
  const meanRGB = rgb.map(v => Math.round(v / total));
  const rng = random(hash), samples = [];
  // Weighted sampling keeps actual source positions and colors in every light particle.
  const cdf = []; let sum = 0;
  for (const p of bright) { sum += p.light ** 2; cdf.push(sum); }
  for (let i=0;i<100;i++) {
    const target = rng() * sum; let lo=0, hi=cdf.length-1;
    while(lo<hi){const mid=(lo+hi)>>>1;if(cdf[mid]<target)lo=mid+1;else hi=mid;}
    const p=bright[lo]; samples.push({ x:p.x, y:p.y, rgb:p.rgb, light:p.light, delay:rng()*.22, angle:rng()*Math.PI*2, distance:Math.sqrt(rng())*.88, size:1+rng()*2.4 });
  }
  return { schemaVersion: VERSION, rendererVersion: 1, seed: hash >>> 0, selection: { ...selection }, meanRGB, brightness: brightness / total, coverage: bright.length / candidates.length, samples };
}

export function recordingType(Recorder = globalThis.MediaRecorder, { audio = false } = {}) {
  if (!Recorder || typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
  const candidates = audio
    ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm'];
  return candidates.find(type => Recorder.isTypeSupported(type)) || null;
}
