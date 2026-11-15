// Draws the home-screen icon (a little house on a sunset gradient) as PNGs,
// with no image libraries: pixels are computed here and packed with zlib.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      raw.set([r, g, b, a], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const top = [255, 179, 138]; // sunset accent
const bottom = [199, 90, 122]; // sunset second
const white = [255, 250, 246];

// Shape test in 0..1 coordinates: is (u, v) inside the house?
function inHouse(u, v) {
  const roof = v >= 0.22 && v <= 0.5 && Math.abs(u - 0.5) <= (v - 0.22) * (0.32 / 0.28);
  const body = v >= 0.48 && v <= 0.78 && u >= 0.28 && u <= 0.72;
  const door = v >= 0.6 && v <= 0.78 && u >= 0.44 && u <= 0.56;
  return (roof || body) && !door;
}

function draw(size, rounded) {
  const ss = 4;
  return png(size, (x, y) => {
    let hits = 0;
    let inside = 0;
    for (let i = 0; i < ss; i++)
      for (let j = 0; j < ss; j++) {
        const u = (x + (i + 0.5) / ss) / size;
        const v = (y + (j + 0.5) / ss) / size;
        const r = 0.2;
        const cx = Math.min(Math.max(u, r), 1 - r);
        const cy = Math.min(Math.max(v, r), 1 - r);
        const inBg = !rounded || (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
        if (inBg) inside++;
        if (inBg && inHouse(u, v)) hits++;
      }
    const t = y / size;
    const bg = mix(top, bottom, t);
    const col = mix(bg, white, hits / Math.max(inside, 1));
    return [...col.map(Math.round), Math.round((inside / (ss * ss)) * 255)];
  });
}

const out = new URL("../public/", import.meta.url);
writeFileSync(new URL("icon-192.png", out), draw(192, true));
writeFileSync(new URL("icon-512.png", out), draw(512, true));
// iPhone rounds the corners itself, so its icon is a full square.
writeFileSync(new URL("apple-touch-icon.png", out), draw(180, false));
console.log("icons written");
