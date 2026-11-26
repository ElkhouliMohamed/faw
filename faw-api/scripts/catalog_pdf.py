#!/usr/bin/env python3
"""Public catalogue only. No contact/quote/counter/journal access."""
import json,sys,html
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.enums import TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.pagesizes import A4
payload=json.load(open(sys.argv[1],encoding='utf-8'))
styles=getSampleStyleSheet();styles['Title'].textColor=colors.HexColor('#795b4a');styles['Heading2'].textColor=colors.HexColor('#795b4a')
priced=any(p.get('price',0)>0 and not p.get('priceToConfirm') for p in payload)
story=[Paragraph('FAW Aluminium',styles['Title']),Paragraph('Catalogue produits · Prix TTC' if priced else 'Catalogue produits · Prix sur devis',styles['Heading2']),Paragraph('Pose non comprise · illustration non contractuelle. Disponibilité selon la fiche produit. Transport sur devis ou selon la ville, hors prix produit.' if priced else 'Pose non comprise · illustration non contractuelle. Disponibilité selon la fiche produit. Prix et transport communiqués sur devis.',styles['BodyText']),Spacer(1,18)]
category=None
for p in payload:
 if p['category']!=category:category=p['category'];story.extend([Paragraph(html.escape(category),styles['Heading2']),Spacer(1,8)])
 specs=' · '.join(html.escape(k+': '+str(v)) for k,v in p['specs'].items())
 price=f"{p['price']:,}".replace(',',' ')+' DH TTC' if p['price']>0 and not p['priceToConfirm'] else 'Prix sur devis'
 title=Paragraph(html.escape(p['title']),styles['Heading3']);details=Paragraph(html.escape(p['id'])+('<br/>'+specs if specs else '')+'<br/>Pose non comprise · illustration non contractuelle',styles['BodyText'])
 table=Table([[title,Paragraph(price,styles['BodyText'])],[details,'']],colWidths=[365,140]);table.setStyle(TableStyle([('SPAN',(0,1),(1,1)),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,-1),(-1,-1),.4,colors.HexColor('#ded5ca')),('BOTTOMPADDING',(0,0),(-1,-1),10)]));story.extend([KeepTogether(table),Spacer(1,8)])
SimpleDocTemplate(sys.argv[2],pagesize=A4,rightMargin=40,leftMargin=40,topMargin=35,bottomMargin=35,title='Catalogue FAW Aluminium').build(story)
