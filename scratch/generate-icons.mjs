import fs from 'fs';
import path from 'path';

// Minimal 1x1 valid PNG base64 that can be written or scaled
// Let's create an uncompressed / basic PNG generator for 16x16, 48x48, 128x128
// A simple PNG consists of 8-byte signature + IHDR chunk + IDAT chunk + IEND chunk.
// Alternatively, since sharp is installed in backend (or canvas), let's check if sharp is available.

async function createIcons() {
  const iconsDir = path.resolve('extension/public/icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // Create SVG icons and convert to PNG or write SVG if supported
  // Chrome manifest requires PNG for icons.
  // We can write a solid PNG buffer for 16x16, 48x48, 128x128 using a minimal PNG encoder or sharp.
  let sharpModule;
  try {
    sharpModule = (await import('sharp')).default;
  } catch (e) {
    try {
      sharpModule = (await import(path.resolve('node_modules/sharp/lib/index.js'))).default;
    } catch (e2) {
      console.log('Sharp not found in root, will check backend');
    }
  }

  const sizes = [16, 48, 128];

  for (const size of sizes) {
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" rx="${Math.floor(size / 5)}" fill="#6366f1"/>
        <text x="50%" y="54%" font-family="Arial, sans-serif" font-weight="bold" font-size="${Math.floor(size * 0.55)}" fill="#ffffff" dominant-baseline="middle" text-anchor="middle">V</text>
      </svg>
    `;

    if (sharpModule) {
      await sharpModule(Buffer.from(svg))
        .png()
        .toFile(path.join(iconsDir, `icon-${size}.png`));
      console.log(`Generated icon-${size}.png with Sharp`);
    }
  }
}

createIcons().catch(console.error);
