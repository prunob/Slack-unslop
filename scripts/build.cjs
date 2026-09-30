const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src');
const output = path.join(root, 'extension');
fs.mkdirSync(output, { recursive: true });
const helperSource = fs.readFileSync(path.join(source, 'core.js'), 'utf8');
const helpers = helperSource
  .replace('globalThis.__SVNCore = Object.freeze(', 'return Object.freeze(')
  .replace(/^\/\*[^]*?\*\/\s*/, '')
  .replace(/;\s*$/, '');
for (const file of fs.readdirSync(source).sort()) {
  if (!fs.statSync(path.join(source, file)).isFile()) continue;
  let text = fs.readFileSync(path.join(source, file), 'utf8');
  if (file === 'content.js' || file === 'bridge.js') {
    const placeholder = 'const core = globalThis.__SVNCore;';
    if (!text.includes(placeholder)) throw new Error('Missing helper placeholder in ' + file);
    text = text.replace(placeholder, `const core = ${helpers};`);
  }
  if (file.endsWith('.js')) new vm.Script(text, { filename: file });
  fs.writeFileSync(path.join(output, file), text);
}
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
const referenced = [manifest.background.service_worker, manifest.action.default_popup,
  ...manifest.content_scripts.flatMap(script => script.js)];
for (const file of referenced) if (!fs.existsSync(path.join(output, file))) throw new Error('Missing extension file: ' + file);
console.log(`Built ${manifest.name} v${manifest.version} in extension/`);
