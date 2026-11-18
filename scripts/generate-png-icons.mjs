import fs from 'fs';
import zlib from 'zlib';

function createSolidPNG(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 2; // Truecolor (RGB)
  ihdrData[10] = 0; // Compression (deflate)
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdr = makeChunk('IHDR', ihdrData);

  // Raw image data: for each row, 1 filter byte (0) + width * 3 bytes (R, G, B)
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      // Decorative border
      const isBorder = x < 8 || x >= width - 8 || y < 8 || y >= height - 8;
      if (isBorder) {
        rawData[pixelOffset] = 217;     // Gold R
        rawData[pixelOffset + 1] = 119; // Gold G
        rawData[pixelOffset + 2] = 6;   // Gold B
      } else {
        rawData[pixelOffset] = r;
        rawData[pixelOffset + 1] = g;
        rawData[pixelOffset + 2] = b;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressedData);

  // IEND
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

// Standard CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Emerald color: #14532d -> rgb(20, 83, 45)
fs.writeFileSync('public/pwa-192x192.png', createSolidPNG(192, 192, 20, 83, 45));
fs.writeFileSync('public/pwa-512x512.png', createSolidPNG(512, 512, 20, 83, 45));
fs.writeFileSync('public/pwa-maskable-512x512.png', createSolidPNG(512, 512, 20, 83, 45));
fs.writeFileSync('public/apple-touch-icon.png', createSolidPNG(180, 180, 20, 83, 45));
fs.writeFileSync('public/favicon.ico', createSolidPNG(32, 32, 20, 83, 45));

console.log('PNG Icons successfully generated!');
