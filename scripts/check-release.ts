/** Rejects release tags that do not exactly match the package and lockfile versions. */
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8')) as {
  version: string;
  packages: Record<string, { version: string }>;
};
const tag = process.env.GITHUB_REF_NAME ?? process.argv[2];
if (!tag || !new RegExp(`^v?${manifest.version.replaceAll('.', '\\.')}$`).test(tag)) {
  throw new Error(
    `Expected release tag ${manifest.version} or v${manifest.version}; received ${tag ?? 'no tag'}.`,
  );
}
if (lock.version !== manifest.version || lock.packages['']?.version !== manifest.version) {
  throw new Error('The package manifest and lockfile versions must match.');
}
console.log(`Release ${tag} matches package version ${manifest.version}.`);
