// Generates brand app icons (flat-color rounded square + lightning bolt) as raw PNGs.
// No external deps: builds the PNG byte stream by hand using Node's built-in zlib.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BRAND = [0x25, 0x63, 0xeb]; // #2563eb
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c, crcTable = crc32.table;
  if (!crcTable) {
    crcTable = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgbaBuffer) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // add filter byte 0 per scanline
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgbaBuffer.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function roundedRectMask(x, y, w, h, r, px, py) {
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

// Point-in-polygon (ray casting)
function pointInPolygon(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1];
    const xj = pts[j][0], yj = pts[j][1];
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Bolt polygon in unit square (0..1, y-down)
const BOLT = [
  [0.58, 0.06], [0.28, 0.56], [0.47, 0.56],
  [0.40, 0.94], [0.74, 0.42], [0.53, 0.42],
];

function generate(size, { maskable = false, cornerRadius = 0.22, boltScale = 0.62 } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const r = maskable ? 0 : cornerRadius * size;
  // safe-zone scale for maskable: bolt occupies smaller area within full bleed background
  const scale = maskable ? boltScale * 0.7 : boltScale;
  const offset = (1 - scale) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const inRounded = maskable || roundedRectMask(0, 0, size, size, r, x + 0.5, y + 0.5);
      if (!inRounded) {
        buf[idx] = 0; buf[idx + 1] = 0; buf[idx + 2] = 0; buf[idx + 3] = 0;
        continue;
      }
      const ux = (x / size - offset) / scale;
      const uy = (y / size - offset) / scale;
      let color = BRAND;
      if (ux >= 0 && ux <= 1 && uy >= 0 && uy <= 1 && pointInPolygon(BOLT, ux, uy)) {
        color = WHITE;
      }
      buf[idx] = color[0]; buf[idx + 1] = color[1]; buf[idx + 2] = color[2]; buf[idx + 3] = 255;
    }
  }
  return encodePNG(size, size, buf);
}

const outDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180, opts: { cornerRadius: 0 } },
  { name: 'maskable-icon-512.png', size: 512, opts: { maskable: true } },
  { name: 'favicon-32.png', size: 32, opts: { cornerRadius: 0.28 } },
];

for (const t of targets) {
  const png = generate(t.size, t.opts || {});
  fs.writeFileSync(path.join(outDir, t.name), png);
  console.log('wrote', t.name, png.length, 'bytes');
}
