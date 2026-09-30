const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../extension');
const profiles = {
  UTEST00001: { id: 'UTEST00001', profile: { real_name: 'Marie Dupont', display_name: 'dragon42' } },
  UTEST00002: { id: 'UTEST00002', profile: { real_name: 'Marc Martin', display_name: 'dragon42' } }
};
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8787');
  if (url.pathname.startsWith('/api/')) {
    let body = '';
    for await (const chunk of req) body += chunk;
    const params = new URLSearchParams(body);
    const user = profiles[params.get('user')];
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(url.pathname === '/api/users.info'
      ? user ? { ok: true, user } : { ok: false, error: 'user_not_found' }
      : { ok: true }));
    return;
  }
  const file = url.pathname.startsWith('/extension/')
    ? path.join(root, path.basename(url.pathname))
    : path.join(__dirname, 'fixture.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(fs.readFileSync(file));
}).listen(8787, '127.0.0.1', () => console.log('Fixture at http://127.0.0.1:8787/client/TTEST00001/CTEST00001'));
