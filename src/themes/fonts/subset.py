from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
import hashlib,json,re
root=Path(__file__).resolve().parents[3]
folder=root/'src/themes/fonts'
common=(folder/'common-3500.txt').read_text(encoding='utf-8')
commonchars=set(re.findall(r'[\u3400-\u9fff]',common))
assert len(commonchars)==3500,len(commonchars)
chars=set(commonchars)
for p in (root/'src').rglob('*'):
 if p.suffix in ('.ts','.tsx','.json'): chars.update(p.read_text(encoding='utf-8'))
chars.update(chr(i) for i in range(32,127))
(folder/'subset-characters.txt').write_text(''.join(sorted(chars)),encoding='utf-8')
report={}
for family in ['notosanssc','notoserifsc','cormorantgaramond','jost','archivo']:
 source=root/'.tmp/font-source'/f'{family}.ttf'
 font=TTFont(source)
 if family=='notoserifsc': font=instantiateVariableFont(font, {'wght':400}, inplace=True)
 options=subset.Options(); options.flavor='woff2'
 sub=subset.Subsetter(options=options); sub.populate(text=''.join(chars)); sub.subset(font)
 font.flavor='woff2'; output=folder/f'{family}.woff2'; font.save(output)
 report[family]={'source':'https://github.com/google/fonts/tree/main/ofl/'+family,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}
 print(family,output.stat().st_size,flush=True)
(folder/'sources.json').write_text(json.dumps({'commonCharacters':3500,'subsetCharacters':len(chars),'characterListSource':'https://github.com/shengdoushi/common-standard-chinese-characters-table/blob/master/level-1.txt','fonts':report},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

