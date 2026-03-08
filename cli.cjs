#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const electron = require('electron');

const args = [path.join(__dirname, '.')];
const proc = spawn(electron, args, { stdio: 'inherit' });

proc.on('close', (code) => {
    process.exit(code);
});
