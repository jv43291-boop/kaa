#!/usr/bin/env python3
"""Monta as duas versões do Kaá: página de Artifact e pacote PWA instalável."""
import json, os, shutil, zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')
JS = ['01-core.js', '02-world.js', '03-sprites.js', '04-entities.js', '05-render.js', '06-audio.js', '07-ui.js', '08-main.js']
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Macondo&family=Signika:wght@400;600;700&display=swap" rel="stylesheet">'

def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()

css = read('style.css')
body = read('body.html')
js = '\n'.join(read(n) for n in JS)
version = 'kaa-v' + str(abs(hash(js + css)) % 10**8)

os.makedirs(os.path.join(DIST, 'artifact'), exist_ok=True)
art = f'''<title>Kaá</title>
<meta name="description" content="RPG de ação na floresta amazônica: desperte os três totens e purifique o Boitatá.">
{FONTS}
<style>
{css}
</style>
{body}
<script>
{js}
</script>
'''
with open(os.path.join(DIST, 'artifact', 'kaa.html'), 'w', encoding='utf-8') as f:
    f.write(art)

pwa = os.path.join(DIST, 'pwa')
os.makedirs(os.path.join(pwa, 'icons'), exist_ok=True)
index = f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>Kaá</title>
<meta name="description" content="RPG de ação na floresta amazônica: desperte os três totens e purifique o Boitatá.">
<meta name="theme-color" content="#07140f">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Kaá">
{FONTS}
<style>
{css}
</style>
</head>
<body>
{body}
<script>
{js}
</script>
<script>
if ('serviceWorker' in navigator && location.protocol !== 'file:') {{
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {{}}));
}}
</script>
</body>
</html>
'''
with open(os.path.join(pwa, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(index)

manifest = {
    'name': 'Kaá · Lendas da Floresta', 'short_name': 'Kaá',
    'description': 'RPG de ação na floresta amazônica: desperte os três totens e purifique o Boitatá.',
    'lang': 'pt-BR', 'id': './', 'start_url': './', 'scope': './',
    'display': 'fullscreen', 'display_override': ['fullscreen', 'standalone'], 'orientation': 'landscape',
    'background_color': '#07140f', 'theme_color': '#07140f', 'categories': ['games'],
    'icons': [
        {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
        {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
        {'src': 'icons/maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ],
}
with open(os.path.join(pwa, 'manifest.webmanifest'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

sw = '''const CACHE = '%s';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const keep = res => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  if (url.origin === location.origin || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(keep)));
  }
});
''' % version
with open(os.path.join(pwa, 'sw.js'), 'w', encoding='utf-8') as f:
    f.write(sw)

shutil.copy(os.path.join(ROOT, 'LEIA-ME.md'), os.path.join(pwa, 'LEIA-ME.md'))
for fn in os.listdir(os.path.join(ROOT, 'icons')):
    shutil.copy(os.path.join(ROOT, 'icons', fn), os.path.join(pwa, 'icons', fn))

zpath = os.path.join(DIST, 'kaa-pwa.zip')
with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
    for base, _, files in os.walk(pwa):
        for fn in files:
            full = os.path.join(base, fn)
            z.write(full, os.path.join('kaa', os.path.relpath(full, pwa)))
print('ok', version, len(art) // 1024, 'KB')
