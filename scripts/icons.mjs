import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#090b11"/><circle cx="256" cy="256" r="170" fill="#251822" stroke="#bd9b75" stroke-width="3"/><circle cx="256" cy="256" r="145" fill="none" stroke="#c09a69" stroke-width="2" stroke-dasharray="5 7"/><text x="256" y="320" font-family="serif" font-size="220" text-anchor="middle" fill="#e0b28a">♱</text></svg>`);
await mkdir('icons', { recursive: true });
for (const [name, size] of [['icon-192',192], ['icon-512',512], ['icon-maskable-512',512], ['apple-touch-icon',180], ['favicon-64',64]]) {
  await sharp(svg).resize(size,size).png().toFile(`icons/${name}.png`);
}
