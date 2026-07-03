// Generates the PWA icons (arc-reactor mark) as PNGs with zero dependencies:
// raw RGBA pixel buffers encoded through node's zlib. Run: npm run icons
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(pixels, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const BG = hex("#080a0f"), NAVY = hex("#12151d"), BLUE = hex("#6d8bff"), GLOW = hex("#c3b5ff");

function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const R = size * 0.5, r1 = size * 0.36, r2 = size * 0.27, r3 = size * 0.13;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx + 0.5, y - cy + 0.5);
      let col = BG, alpha = 255;
      if (d < R) col = NAVY;
      // outer ring
      if (Math.abs(d - r1) < size * 0.022) col = mix(BLUE, NAVY, 0.35);
      // segmented middle ring
      if (Math.abs(d - r2) < size * 0.035) {
        const ang = Math.atan2(y - cy, x - cx);
        const seg = ((ang + Math.PI) / (2 * Math.PI)) * 10;
        col = seg % 1 < 0.72 ? BLUE : NAVY;
      }
      // core with glow falloff
      if (d < r3) col = mix(GLOW, [255, 255, 255], Math.max(0, 1 - d / r3) * 0.8);
      else if (d < r3 * 1.7) col = mix(col, BLUE, Math.max(0, 1 - (d - r3) / (r3 * 0.7)) * 0.6);
      const o = (y * size + x) * 4;
      px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = alpha;
    }
  }
  return px;
}

mkdirSync("public/icons", { recursive: true });
for (const [size, name] of [[512, "icon-512.png"], [192, "icon-192.png"], [180, "apple-touch-icon.png"]]) {
  writeFileSync(`public/icons/${name}`, encodePNG(draw(size), size, size));
  console.log(`wrote public/icons/${name}`);
}
