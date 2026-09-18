/** Removes only generated output inside this repository before a build. */
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../dist/', import.meta.url));
rmSync(output, { recursive: true, force: true });
