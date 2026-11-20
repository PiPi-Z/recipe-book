# -*- coding: utf-8 -*-
"""生成甜心小厨 PWA 图标"""
from PIL import Image, ImageDraw, ImageFont
import os
BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS=os.path.join(BASE,'assets')
os.makedirs(ASSETS,exist_ok=True)

def font(sz):
    for p in ['C:/Windows/Fonts/msyhbd.ttc','C:/Windows/Fonts/simhei.ttf']:
        if os.path.exists(p):
            try:return ImageFont.truetype(p,sz)
            except:pass
    return ImageFont.load_default()

def make(S):
    img=Image.new('RGB',(S,S),(255,241,243))
    d=ImageDraw.Draw(img)
    sc=S/512
    d.rounded_rectangle([20*sc,20*sc,S-20*sc,S-20*sc],radius=120*sc,fill=(255,192,205),outline=(232,145,159),width=int(6*sc))
    # 小圆点纹理
    for x in range(60,int(S-40),int(46*sc)):
        for y in range(60,int(S-40),int(46*sc)):
            d.ellipse([x,y,x+4*sc,y+4*sc],fill=(255,255,255))
    # 厨师帽
    d.ellipse([140*sc,120*sc,250*sc,250*sc],fill=(255,255,255),outline=(232,145,159),width=int(4*sc))
    d.ellipse([210*sc,80*sc,330*sc,210*sc],fill=(255,255,255),outline=(232,145,159),width=int(4*sc))
    d.ellipse([280*sc,120*sc,390*sc,250*sc],fill=(255,255,255),outline=(232,145,159),width=int(4*sc))
    d.rounded_rectangle([160*sc,200*sc,370*sc,300*sc],radius=30*sc,fill=(255,255,255),outline=(232,145,159),width=int(4*sc))
    # 爱心（矢量绘制，避免字体缺字）
    cx,cy=S/2,S/2+52*sc; s=2.6*sc
    pts=[]
    import math
    for i in range(361):
        t=math.radians(i)
        x=16*math.sin(t)**3
        y=13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t)
        pts.append((cx+x*s, cy-y*s))
    d.polygon(pts,fill=(212,111,132))
    return img

for sz,name in [(192,'icon-192.png'),(512,'icon-512.png'),(180,'apple-touch-icon.png')]:
    make(sz).save(os.path.join(ASSETS,name))
    print('generated',name)
