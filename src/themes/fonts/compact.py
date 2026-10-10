"""Derive opt-in compact faces from pinned local assets; retain originals for rollback."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
import hashlib, json
folder = Path(__file__).resolve().parent
root = folder.parents[2]
chars = set(chr(i) for i in range(32, 127))
for path in (root / 'src').rglob('*'):
    if path.suffix in ('.ts', '.tsx', '.json'):
        chars.update(path.read_text(encoding='utf-8'))
report = {}
for family in ('notosanssc', 'notoserifsc'):
    source = folder / (family + '.woff2')
    font = TTFont(source, recalcTimestamp=False)
    original = set(font.getBestCmap())
    app_cjk = {ord(c) for c in chars if 0x3400 <= ord(c) <= 0x9fff}
    assert not app_cjk - original, sorted(app_cjk - original)
    required = original if family == 'notosanssc' else original & set(map(ord, chars))
    if family == 'notosanssc':
        instantiateVariableFont(font, {'wght': (200, 400)}, inplace=True)
    else:
        worker = subset.Subsetter(options=subset.Options())
        worker.populate(unicodes=required)
        worker.subset(font)
    target = folder / (family + '-compact.woff2')
    font.save(target)
    actual = set(TTFont(target).getBestCmap())
    missing = sorted(required - actual)
    assert not missing, missing
    report[family] = {'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'requiredGlyphs': len(required), 'missingGlyphs': missing, 'appCjkGlyphs': len(app_cjk), 'missingAppCjkGlyphs': sorted(app_cjk - actual)}
(folder / 'compact-sources.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
