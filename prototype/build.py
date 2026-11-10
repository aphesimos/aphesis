import json, html
import os
D=os.path.dirname(os.path.abspath(__file__))+'/'
SECTIONS=[
 dict(id='book',name='book',gl='liber',desc='authors, works and what shaped me, leafed through like a codex.'),
 dict(id='experimental',name='experimental',gl='ἄδυτον',desc='chambers discovered through gestures. symbols, motion, no explanation.'),
 dict(id='archive',name='archive',gl='codex',desc='writing about anything, from draft (nigredo) to finished (rubedo).'),
 dict(id='laboratory',name='laboratory',gl='officina',desc='measured experiments: machines that rewrite themselves, metrics that lie, the cost of a truth.'),
 dict(id='works',name='works',gl='opera',desc='things I have built.'),
 dict(id='wall',name='wall',gl='paries',desc='anonymous messages that drift in the fog and fade with time.'),
 dict(id='forum',name='forum',gl='ἀγορά',desc='a plain anonymous forum, in threads.'),
]
PASSAGES=[
 dict(o='ἓν τὸ πᾶν',l='grc',t='the one is the all',a='Chrysopoeia of Cleopatra'),
 dict(o='Solve et coagula',l='la',t='dissolve and coagulate',a='alchemical maxim'),
 dict(o='Quod est inferius est sicut quod est superius',l='la',t='that which is below is as that which is above',a='Emerald Tablet'),
 dict(o='πάντα ῥεῖ',l='grc',t='everything flows',a='attributed to Heraclitus'),
 dict(o='γνῶθι σεαυτόν',l='grc',t='know thyself',a='Delphic maxim'),
 dict(o='Wovon man nicht sprechen kann, darüber muss man schweigen.',l='de',t='whereof one cannot speak, thereof one must be silent',a='Wittgenstein'),
 dict(o="Le silence éternel de ces espaces infinis m'effraie.",l='fr',t='the eternal silence of these infinite spaces frightens me',a='Pascal'),
 dict(o='Tudo vale a pena se a alma não é pequena.',l='pt',t='everything is worthwhile if the soul is not small',a='Fernando Pessoa'),
 dict(o='El tiempo es la sustancia de que estoy hecho.',l='es',t='time is the substance I am made of',a='Borges'),
 dict(o='色即是空',l='ja',t='form is emptiness',a='Heart Sutra'),
 dict(o='Nel mezzo del cammin di nostra vita',l='it',t='midway upon the journey of our life',a='Dante'),
 dict(o='Tempus edax rerum',l='la',t='time, devourer of things',a='Ovid'),
 dict(o='The map is not the territory.',l='en',t='',a='Korzybski'),
 dict(o='Visita interiora terrae, rectificando invenies occultum lapidem',l='la',t='visit the interior of the earth; by rectifying, you will find the hidden stone',a='V.I.T.R.I.O.L.'),
 dict(o='ἀρχὴ ἥμισυ παντός',l='grc',t='the beginning is half of the whole',a='Greek proverb'),
]
for f in PASSAGES:
    if not f['t']: f['t']='—'
lang=lambda g:'grc' if g in ('ἄδυτον','ἀγορά') else 'la'
nav=''.join(f'<a href="#{s["id"]}">{html.escape(s["name"])}<span class="gl" lang="{lang(s["gl"])}">{html.escape(s["gl"])}</span></a>' for s in SECTIONS)
sec=''.join(f'<section id="s-{s["id"]}" aria-labelledby="h-{s["id"]}"><h1 id="h-{s["id"]}" tabindex="-1"><span class="gloss" lang="{lang(s["gl"])}">{html.escape(s["gl"])}</span>{html.escape(s["name"])}</h1><p class="nota">{html.escape(s["desc"])}</p><p>this chamber is still being written. the seal in the corner leads back to the center.</p></section>' for s in SECTIONS)
t=open(D+'home_template.html').read()
t=t.replace('__NAV__',nav).replace('__SECTIONS__',sec).replace('__SECOES__',sec).replace('__SECTIONSJS__',json.dumps([dict(id=s['id'],name=s['name']) for s in SECTIONS],ensure_ascii=False))
t=t.replace('__SECOESJS__',json.dumps([dict(id=s['id'],name=s['name']) for s in SECTIONS],ensure_ascii=False))
t=t.replace('__FRASES__',json.dumps(PASSAGES,ensure_ascii=False)).replace('__PASSAGES__',json.dumps(PASSAGES,ensure_ascii=False))
t=t.replace('__M__',open(D+'../../mark/engine/model.js').read()).replace('__CORE__',open(D+'../../mark/engine/core.js').read())
t=t.replace('<script>','<script>document.documentElement.lang="en";',1)
open(D+'home.html','w').write(t); print(len(t))
