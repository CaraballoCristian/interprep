import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

/**
 * Dependency-free PNG icon generator. Draws the Interprep "I" mark at 2x and
 * downsamples for smooth edges, then writes regular and maskable icons.
 */

const BACKGROUND = [15, 23, 42, 255]; // #0f172a
const ACCENT = [56, 189, 248, 255]; // #38bdf8
const OUTPUT_DIR = join(process.cwd(), "public", "icons");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }
  const index = (y * size + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function fillRect(pixels, size, left, top, width, height, color) {
  for (let y = Math.floor(top); y < Math.ceil(top + height); y += 1) {
    for (let x = Math.floor(left); x < Math.ceil(left + width); x += 1) {
      setPixel(pixels, size, x, y, color);
    }
  }
}

function insideRoundedRect(x, y, size, radius) {
  const min = radius;
  const max = size - radius;
  if ((x >= min && x <= max) || (y >= min && y <= max)) {
    return x >= 0 && y >= 0 && x <= size && y <= size;
  }
  const cx = x < min ? min : max;
  const cy = y < min ? min : max;
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

/** Renders at `scale`x so the final downsample anti-aliases every edge. */
function render(size, maskable, scale = 2) {
  const hi = size * scale;
  const pixels = Buffer.alloc(hi * hi * 4, 0);
  const radius = maskable ? 0 : hi * 0.22;

  for (let y = 0; y < hi; y += 1) {
    for (let x = 0; x < hi; x += 1) {
      if (maskable || insideRoundedRect(x, y, hi, radius)) {
        setPixel(pixels, hi, x, y, BACKGROUND);
      }
    }
  }

  const inset = hi * (maskable ? 0.26 : 0.22);
  const area = hi - inset * 2;
  const center = hi / 2;
  const barWidth = area * 0.62;
  const barHeight = area * 0.18;
  const stemWidth = area * 0.2;

  fillRect(pixels, hi, center - barWidth / 2, inset, barWidth, barHeight, ACCENT);
  fillRect(pixels, hi, center - stemWidth / 2, inset, stemWidth, area, ACCENT);
  fillRect(
    pixels,
    hi,
    center - barWidth / 2,
    inset + area - barHeight,
    barWidth,
    barHeight,
    ACCENT,
  );

  const output = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const index = ((y * scale + dy) * hi + (x * scale + dx)) * 4;
          const alpha = pixels[index + 3] / 255;
          r += pixels[index] * alpha;
          g += pixels[index + 1] * alpha;
          b += pixels[index + 2] * alpha;
          a += pixels[index + 3];
        }
      }

      const samples = scale * scale;
      const alpha = a / samples;
      const index = (y * size + x) * 4;
      output[index] = alpha === 0 ? 0 : Math.round(r / (a / 255));
      output[index + 1] = alpha === 0 ? 0 : Math.round(g / (a / 255));
      output[index + 2] = alpha === 0 ? 0 : Math.round(b / (a / 255));
      output[index + 3] = Math.round(alpha);
    }
  }

  return encodePng(size, output);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const files = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["maskable-192.png", 192, true],
  ["maskable-512.png", 512, true],
];

for (const [name, size, maskable] of files) {
  const png = render(size, maskable);
  writeFileSync(join(OUTPUT_DIR, name), png);
  console.log(`wrote public/icons/${name} (${png.length} bytes)`);
}
