#!/usr/bin/env python3
"""Inline css/js/svg into one HTML file so the demo opens by double-click. Usage: python3 tools/build-standalone.py"""
import base64, re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')

def data_uri(p):
    return 'data:image/svg+xml;base64,' + base64.b64encode((root / p).read_bytes()).decode()

html = html.replace('<link rel="stylesheet" href="css/styles.css">', '<style>\n' + (root / 'css/styles.css').read_text(encoding='utf-8') + '\n</style>')
html = html.replace('<link rel="manifest" href="manifest.json">\n', '')
html = html.replace('<link rel="icon" href="assets/logo.svg" type="image/svg+xml">', '<link rel="icon" href="%s" type="image/svg+xml">' % data_uri('assets/logo.svg'))

def inline_js(m):
    code = (root / m.group(1)).read_text(encoding='utf-8')
    for a in ('logo', 'hero', 'sahara'):
        code = code.replace('assets/%s.svg' % a, data_uri('assets/%s.svg' % a))
    return '<script>\n' + code.replace('</script>', '<\\/script>') + '\n</script>'

html = re.sub(r'<script src="(js/[^"]+)"></script>', inline_js, html)
html = html.replace('assets/logo.svg', data_uri('assets/logo.svg'))
out = root / 'kavach-standalone.html'
out.write_text(html, encoding='utf-8')
print('wrote', out, round(out.stat().st_size / 1024), 'KB')
