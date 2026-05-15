#!/usr/bin/env node

/**
 * Removes generated build output before producing a fresh npm package payload.
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * Resolves a path relative to the repository root.
 */
function resolveFromRoot(...segments) {
  return path.join(__dirname, '..', ...segments);
}

/**
 * Deletes current and legacy dist directories if they exist.
 */
function cleanDist() {
  fs.rmSync(resolveFromRoot('dist'), { force: true, recursive: true });
  fs.rmSync(resolveFromRoot('src', 'dist'), { force: true, recursive: true });
}

cleanDist();
