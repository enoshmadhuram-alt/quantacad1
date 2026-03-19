#!/usr/bin/env node
/**
 * QuantaCAD Setup Script
 * Run: node setup.js
 */
const { execSync } = require('child_process');
const os = require('os');
const path = require('path');

const platform = os.platform();
const green = s => `\x1b[32m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const cyan = s => `\x1b[36m${s}\x1b[0m`;
const bold = s => `\x1b[1m${s}\x1b[0m`;

console.log(bold('\n⬡  QuantaCAD — AutoCAD SAP Setup\n'));
console.log(cyan('Installing dependencies...'));

try {
  execSync('npm install', { stdio: 'inherit', cwd: __dirname });
  console.log(green('\n✓ Dependencies installed'));
  console.log(green('✓ You can now run: npm start\n'));
  console.log(bold('To build an installer:'));
  if (platform === 'win32') console.log('  ' + yellow('npm run build:win'));
  else if (platform === 'darwin') console.log('  ' + yellow('npm run build:mac'));
  else console.log('  ' + yellow('npm run build:linux'));
  console.log('\nInstaller will be saved in the ' + cyan('dist/') + ' folder.\n');
} catch (e) {
  console.error('\x1b[31mSetup failed. Make sure Node.js 18+ is installed.\x1b[0m');
  console.error(e.message);
}
