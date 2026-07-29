// Generates the PWA icons without any image dependencies: raw RGBA pixel
// buffers encoded as PNG via zlib. Run: node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256).map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c;
    });
  }
  let c = -1;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
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

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // no filter
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function render(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  // Maskable icons need content inside the inner 80% safe zone.
  const scale = maskable ? 0.72 : 0.92;
  const ringR = c * 0.62 * scale;
  const ringW = size * 0.055;
  const corner = maskable ? 0 : size * 0.18;

  const put = (i, r, g, b, a = 255) => {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Rounded-corner mask for non-maskable icons.
      if (corner > 0) {
        const dx = Math.max(corner - x, x - (size - 1 - corner), 0);
        const dy = Math.max(corner - y, y - (size - 1 - corner), 0);
        if (dx * dx + dy * dy > corner * corner) {
          put(i, 0, 0, 0, 0);
          continue;
        }
      }
      // Background with a soft violet radial tint.
      const dcx = (x - c) / size;
      const dcy = (y - c) / size;
      const dist = Math.sqrt(dcx * dcx + dcy * dcy);
      const tint = Math.max(0, 1 - dist * 2.2);
      put(
        i,
        10 + Math.round(18 * tint),
        8 + Math.round(7 * tint),
        18 + Math.round(28 * tint),
      );

      // Magenta ring with glow.
      const dr = Math.abs(Math.hypot(x - c, y - c) - ringR);
      if (dr < ringW) {
        const t = 1 - dr / ringW;
        blend(i, 255, 61, 154, t);
      } else if (dr < ringW * 3) {
        const t = (1 - (dr - ringW) / (ringW * 2)) * 0.25;
        blend(i, 255, 61, 154, t);
      }

      // Cyan bolt: diagonal bar through the ring.
      const bx = x - c;
      const by = y - c;
      const along = (bx - by) / Math.SQRT2;
      const across = Math.abs((bx + by) / Math.SQRT2);
      const barHalf = size * 0.035;
      const barLen = ringR * 1.15;
      if (Math.abs(along) < barLen && across < barHalf) {
        const t = 1 - across / barHalf;
        blend(i, 41, 224, 255, Math.min(1, t * 1.4));
      } else if (Math.abs(along) < barLen && across < barHalf * 2.6) {
        const t = (1 - (across - barHalf) / (barHalf * 1.6)) * 0.3;
        blend(i, 41, 224, 255, Math.max(0, t));
      }
    }
  }

  function blend(i, r, g, b, a) {
    if (buf[i + 3] === 0) return;
    buf[i] = Math.round(buf[i] * (1 - a) + r * a);
    buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + g * a);
    buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + b * a);
  }

  return png(size, size, buf);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", render(192, false));
writeFileSync("public/icons/icon-512.png", render(512, false));
writeFileSync("public/icons/icon-512-maskable.png", render(512, true));
console.log("icons written");
