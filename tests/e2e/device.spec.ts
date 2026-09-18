/** Tests lid mechanics, powered-screen accessibility, physical controls, and synthesized audio. */
import { expect, test } from '@playwright/test';
import { mockApi } from './routes';

/** Verifies powered lamps, standby restoration, and motion-safe illumination. */
test('illuminates the sensor and status lamps only in the matching device state', async function testLights({
  page,
}) {
  const housing = page.locator('.sensor-housing');
  await expect(housing).toHaveAttribute('data-status', 'standby');
  await page.getByRole('button', { name: 'Open Pokédex', exact: true }).click();
  await expect(housing).toHaveAttribute('data-status', 'booting');
  await expect(housing).toHaveAttribute('data-status', 'ready');
  /** Reads the rendered light overlay rather than only its state attributes. */
  function lightStyle(element: Element) {
    const style = getComputedStyle(element, '::after');
    return { animation: style.animationName, opacity: style.opacity };
  }
  expect((await page.locator('.sensor-lens').evaluate(lightStyle)).animation).toBe(
    'sensor-breathe',
  );
  /** Waits for the green lamp's physical fade-in to finish. */
  async function greenOpacity(): Promise<number> {
    return Number((await page.locator('.led-green').evaluate(lightStyle)).opacity);
  }
  await expect.poll(greenOpacity).toBeGreaterThan(0.8);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect((await page.locator('.sensor-lens').evaluate(lightStyle)).animation).toBe('none');
  expect(Number((await page.locator('.sensor-lens').evaluate(lightStyle)).opacity)).toBeGreaterThan(
    0,
  );
  await page.getByRole('button', { name: 'Close Pokédex', exact: true }).click();
  await expect(housing).toHaveAttribute('data-status', 'standby');
  expect((await page.locator('.sensor-lens').evaluate(lightStyle)).opacity).toBe('0');
});

/** Installs deterministic data before presenting the closed hardware. */
test.beforeEach(async function prepare({ context, page }) {
  await mockApi(context);
  await page.goto('/');
});

/** Confirms startup is closed, opening is guarded, and closing preserves the selected Pokémon. */
test('opens and closes a physical lid without exposing powered-off controls', async function testLid({
  page,
}) {
  const device = page.locator('.pokedex-device');
  const latch = page.getByRole('button', { name: 'Open Pokédex', exact: true });
  await expect(device).toHaveAttribute('data-phase', 'closed');
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await page.keyboard.press('/');
  await expect(page.locator('#search')).not.toBeFocused();
  await latch.focus();
  await page.keyboard.press('Enter');
  await expect(device).toHaveAttribute('data-phase', 'opening');
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await expect(device).toHaveAttribute('data-phase', 'open');
  await expect(page.getByRole('tab', { name: 'INFO', exact: true })).toBeFocused();
  await page.getByRole('searchbox').fill('sprigatito');
  await page.getByRole('list', { name: 'Pokémon results' }).getByRole('button').click();
  await expect(page.getByRole('heading', { name: 'sprigatito' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Pokédex', exact: true }).click();
  await expect(device).toHaveAttribute('data-phase', 'closing');
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await expect(device).toHaveAttribute('data-phase', 'closed');
  await expect(latch).toBeFocused();
  await latch.click();
  await expect(device).toHaveAttribute('data-phase', 'open');
  await expect(page.getByRole('heading', { name: 'sprigatito' })).toBeVisible();
});

/** Exercises dedicated display modes and directly searches the complete catalog. */
test('uses physical direction keys, tabs, and a continuous catalog', async function testHardware({
  page,
}) {
  await page.getByRole('button', { name: 'Open Pokédex', exact: true }).click();
  await expect(page.locator('.pokedex-device')).toHaveAttribute('data-phase', 'open');
  await page.getByRole('button', { name: 'Next information page' }).click();
  await expect(page.getByRole('tab', { name: 'STATS', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('heading', { name: /Base stats/ })).toBeVisible();
  await page.getByRole('tab', { name: 'STATS', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'MOVES', exact: true })).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: 'MOVES' })).toBeVisible();
  await page.getByRole('searchbox').fill('906');
  await expect(page.getByRole('searchbox')).toHaveValue('906');
  await page.getByRole('list', { name: 'Pokémon results' }).getByRole('button').click();
  await expect(page.getByRole('heading', { name: 'sprigatito' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'INFO', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
});

/** Records real oscillator creation so mute behavior is verified beyond the button appearance. */
test('plays gesture-initiated audio and persists the mute switch', async function testAudio({
  page,
}) {
  /** Counts synthesized oscillator voices while keeping the browser's real audio implementation. */
  function instrumentAudio(): void {
    const original = AudioContext.prototype.createOscillator;
    const state = window as Window & { deviceVoiceCount?: number };
    state.deviceVoiceCount = 0;
    /** Records each voice and delegates synthesis to the original native method. */
    AudioContext.prototype.createOscillator = function createOscillator(
      this: AudioContext,
    ): OscillatorNode {
      state.deviceVoiceCount = (state.deviceVoiceCount ?? 0) + 1;
      return original.call(this);
    };
  }
  /** Returns the number of oscillator voices created in this browser document. */
  function voices(): number {
    return (window as Window & { deviceVoiceCount?: number }).deviceVoiceCount ?? 0;
  }
  await page.addInitScript(instrumentAudio);
  await page.reload();
  expect(await page.evaluate(voices)).toBe(0);
  await page.getByRole('button', { name: 'Open Pokédex', exact: true }).click();
  await expect(page.locator('.pokedex-device')).toHaveAttribute('data-phase', 'open');
  expect(await page.evaluate(voices)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Mute device sounds' }).click();
  const mutedCount = await page.evaluate(voices);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  expect(await page.evaluate(voices)).toBe(mutedCount);
  await page.getByRole('button', { name: 'Close Pokédex', exact: true }).click();
  await expect(page.locator('.pokedex-device')).toHaveAttribute('data-phase', 'closed');
  expect(await page.evaluate(voices)).toBe(mutedCount);
  await page.reload();
  await page.getByRole('button', { name: 'Open Pokédex', exact: true }).click();
  await expect(page.locator('.pokedex-device')).toHaveAttribute('data-phase', 'open');
  await expect(page.getByRole('button', { name: 'Mute device sounds' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await page.evaluate(voices)).toBe(0);
});

/** Honors the system motion preference without skipping the final mechanical state. */
test('supports reduced motion and still opens both screens', async function testReducedMotion({
  page,
}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Open Pokédex', exact: true }).click();
  await expect(page.locator('.pokedex-device')).toHaveAttribute('data-phase', 'open');
  await expect(page.getByRole('searchbox')).toBeVisible();
  /** Reads the effective transition duration under the reduced-motion media query. */
  function transitionDuration(element: Element): string {
    return getComputedStyle(element).transitionDuration;
  }
  expect(parseFloat(await page.locator('.device-lid').evaluate(transitionDuration))).toBeLessThan(
    0.01,
  );
});
