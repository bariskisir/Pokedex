/** Records the real closed-to-open device interaction as a looping, globally paletted README GIF. */
import { writeFile } from 'node:fs/promises';
import { chromium, expect, type Page } from '@playwright/test';
import gifenc from 'gifenc';
import { PNG } from 'pngjs';

const { GIFEncoder, applyPalette, quantize } = gifenc;

interface Frame {
  pixels: Uint8Array;
  delay: number;
}
const width = 960;
const height = 800;
const frames: Frame[] = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(process.env.POKEDEX_URL ?? 'http://127.0.0.1:5173');
  await page
    .locator('.profile-heading h2')
    .filter({ hasText: 'pikachu' })
    .waitFor({ state: 'attached', timeout: 60_000 });
  await page.locator('.artwork-stage img').evaluate(decodeArtwork);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  await page.mouse.move(5, 5);
  frames.push(await capture(page, 1400));
  await page.getByRole('button', { name: 'Open Pokédex', exact: true }).evaluate(clickCover);
  await expect(page.locator('.pokedex-device')).toHaveAttribute('data-phase', 'opening');
  await captureTransition(page, 1150);
  await page.clock.runFor(1200);
  await expect(page.locator('.pokedex-device')).toHaveAttribute('data-phase', 'open');
  frames.push(await capture(page, 2200));
} finally {
  await browser.close();
}

const samples: number[] = [];
for (const frame of frames) {
  for (let offset = 0; offset < frame.pixels.length; offset += 256) {
    samples.push(
      frame.pixels[offset] ?? 0,
      frame.pixels[offset + 1] ?? 0,
      frame.pixels[offset + 2] ?? 0,
      255,
    );
  }
}
const palette = quantize(new Uint8Array(samples), 256);
const gif = GIFEncoder();
for (const frame of frames)
  gif.writeFrame(applyPalette(frame.pixels, palette), width, height, {
    palette,
    delay: frame.delay,
    repeat: 0,
  });
gif.finish();
const bytes = gif.bytes();
await writeFile(new URL('../app.gif', import.meta.url), bytes);
console.log(
  `Recorded app.gif: ${frames.length} frames, ${width} × ${height}, ${(bytes.length / 1024 / 1024).toFixed(2)} MiB.`,
);

/** Captures rendered pixels from the actual page without adding or painting synthetic UI. */
async function capture(page: Page, delay: number): Promise<Frame> {
  const image = PNG.sync.read(await page.screenshot({ animations: 'allow' }));
  return { pixels: image.data, delay };
}

/** Samples the real CSS animations at a fixed twenty frames per second without dropped frames. */
async function captureTransition(page: Page, duration: number): Promise<void> {
  for (let elapsed = 0; elapsed <= duration; elapsed += 50) {
    await page.evaluate(seekAnimations, elapsed);
    frames.push(await capture(page, 50));
  }
}

/** Activates the real cover handler while the recording clock is paused. */
function clickCover(element: HTMLElement | SVGElement): void {
  if (element instanceof HTMLElement) element.click();
}

/** Freezes browser animations at an exact timestamp for reproducible frame capture. */
function seekAnimations(elapsed: number): void {
  for (const animation of document.getAnimations()) {
    animation.pause();
    animation.currentTime = elapsed;
  }
}

/** Waits for the real Pokémon artwork to be decoded before recording begins. */
async function decodeArtwork(element: HTMLElement | SVGElement): Promise<void> {
  if (element instanceof HTMLImageElement) await element.decode();
}
