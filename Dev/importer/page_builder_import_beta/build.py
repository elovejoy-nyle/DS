"""Rebuild index.html from source; no third-party Python packages required."""
from pathlib import Path
root = Path(__file__).resolve().parent
source = root / 'source'
html = (source / 'shell.html').read_text(encoding='utf-8')
scripts = []
for name in ('core.js', 'cad-import.js', 'app.js', 'import-ui.js'):
    attribute = ' id="cad-import-adapter"' if name == 'cad-import.js' else ''
    code = (source / name).read_text(encoding='utf-8').replace('</script', '<\\/script')
    scripts.append('<script' + attribute + '>\n' + code + '\n</script>\n')
html = html.replace('<!-- PAGE_BUILDER_SCRIPTS -->\n', ''.join(scripts))
(root / 'index.html').write_text(html, encoding='utf-8')
print('Built', root / 'index.html')
