
/* Page Builder 0.2.0. Pure project geometry and text exporters; no network calls. */
(function (root) {
  'use strict';
  const VERSION = '0.3.0-import-beta';
  // CAD TEXT height describes glyph height, not a browser CSS em square.
  // Arial's approximate cap-height ratio keeps browser previews closer to CAD.
  const TEXT_EM = 1.4;
  const clone = x => JSON.parse(JSON.stringify(x));
  const uid = () => 'e_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const num = n => Number(Number(n).toFixed(6));
  const finite = (x, fallback) => Number.isFinite(Number(x)) ? Number(x) : fallback;
  const text = x => String(x == null ? '' : x).replace(/[\r\n\t]/g, ' ').slice(0, 50000);
  const presets = {letter:[215.9,279.4], legal:[215.9,355.6], a4:[210,297]};
  function entity(type, props) { return Object.assign({id:uid(), type}, props); }

// Match our existing template as defualt.
function defaults() {
  return [
    // Outer boundary: 145 x 40 mm.
    // Coordinates start at the title block's bottom-left corner.
    entity('rect', {
      x1: 0, y1: 0,
      x2: 145, y2: 40
    }),

    // Horizontal row dividers.
    entity('line', {x1: 0, y1: 28,   x2: 145, y2: 28}),
    entity('line', {x1: 0, y1: 15.5, x2: 145, y2: 15.5}),
    entity('line', {x1: 0, y1: 8,    x2: 145, y2: 8}),

    // Main divider: production/drawing personnel on the left.
    entity('line', {x1: 55, y1: 0, x2: 55, y2: 40}),

    // DWG NUMBER / REV divider, in the third row only.
    entity('line', {x1: 120, y1: 8, x2: 120, y2: 15.5}),

    // SCALE / SHEET divider, in the bottom row only.
    entity('line', {x1: 110, y1: 0, x2: 110, y2: 8}),

    // Row 1: PRODUCTION START DATE | TITLE
    entity('text', {
      x: 1.5, y: 37.5, h: 1.8,
      text: 'PRODUCTION START DATE'
    }),
    entity('text', {
      x: 2, y: 31.5, h: 3,
      text: '{PRODUCTION_START_DATE}'
    }),
    entity('text', {
      x: 56.5, y: 37.5, h: 1.8,
      text: 'TITLE'
    }),
    entity('text', {
      x: 78, y: 31.5, h: 4,
      text: '{TITLE}'
    }),

    // Row 2: PRODUCTION END DATE | MODEL
    entity('text', {
      x: 1.5, y: 25.5, h: 1.8,
      text: 'PRODUCTION END DATE'
    }),
    entity('text', {
      x: 2, y: 19, h: 3,
      text: '{PRODUCTION_END_DATE}'
    }),
    entity('text', {
      x: 56.5, y: 25.5, h: 1.8,
      text: 'MODEL'
    }),
    entity('text', {
      x: 74, y: 19, h: 4,
      text: '{MODEL}'
    }),

    // Row 3: DRAWN BY | DWG NUMBER | REV
    entity('text', {
      x: 1.5, y: 13.1, h: 1.8,
      text: 'DRAWN BY'
    }),
    entity('text', {
      x: 2, y: 9.3, h: 2.8,
      text: '{DRAWN_BY}'
    }),
    entity('text', {
      x: 56.5, y: 13.1, h: 1.8,
      text: 'DWG NUMBER'
    }),
    entity('text', {
      x: 84, y: 9.3, h: 2.8,
      text: '{DRAWING_NUMBER}'
    }),
    entity('text', {
      x: 121.5, y: 13.1, h: 1.8,
      text: 'REV'
    }),
    entity('text', {
      x: 130, y: 9.3, h: 2.8,
      text: '{REVISION}'
    }),

    // Row 4: CHECKED | SCALE | SHEET
    entity('text', {
      x: 1.5, y: 5.6, h: 1.8,
      text: 'CHECKED'
    }),
    entity('text', {
      x: 2, y: 1.6, h: 2.8,
      text: '{CHECKED}'
    }),
    entity('text', {
      x: 56.5, y: 5.6, h: 1.8,
      text: 'SCALE'
    }),
    entity('text', {
      x: 77, y: 1.6, h: 3,
      text: '{SCALE}'
    }),
    entity('text', {
      x: 111.5, y: 5.6, h: 1.8,
      text: 'SHEET'
    }),
    entity('text', {
      x: 118, y: 1.6, h: 3,
      text: '{PAGE} OF {PAGECOUNT}'
    })
  ];
}
  function newPage(n=1) { return {id:uid(),title:n===1?'UNTITLED':'PAGE '+n,number:'DWG-001',revision:'A',entities:[]}; }
  function newProject() {
    return {format:'DraftSightPageBuilder',version:3,units:'mm',coordinateSystem:'cad-y-up',
		paper: {
		  preset: 'letter',
		  orientation: 'portrait',
		  width: 215.9,
		  height: 279.4
		},
		  gap:10,margin:8,
      titleBlock:{enabled:true,width:145,height:40,entities:defaults()},pages:[newPage()]};
  }
  function sampleProject() {
    const p=newProject();
    p.pages=[newPage(1),newPage(2)];
    p.pages[0].title='CONTROL POWER - SAMPLE';p.pages[1].title='ANALOG + COMS - SAMPLE';
    const a=p.pages[0].entities,b=p.pages[1].entities;
    a.push(entity('text',{x:25,y:184,h:5,text:'Drawing / export test'}));
    a.push(entity('text',{x:25,y:174,h:3,text:'Sample geometry only - not a wiring design'}));
    a.push(entity('line',{x1:30,y1:140,x2:130,y2:140}));
    a.push(entity('line',{x1:30,y1:137,x2:30,y2:143}));
    a.push(entity('line',{x1:130,y1:137,x2:130,y2:143}));
    a.push(entity('text',{x:50,y:146,h:3,text:'100 mm test line'}));
    a.push(entity('rect',{x1:35,y1:75,x2:85,y2:115}));
    a.push(entity('text',{x:41,y:93,h:3,text:'50 x 40 mm'}));
    a.push(entity('line',{x1:85,y1:95,x2:130,y2:95}));
    a.push(entity('circle',{x:140,y:95,r:10}));
    a.push(entity('line',{x1:150,y1:95,x2:205,y2:95}));
    a.push(entity('text',{x:129,y:111,h:3,text:'R10 mm'}));
    b.push(entity('text',{x:25,y:184,h:5,text:'Second page'}));
    b.push(entity('text',{x:25,y:173,h:3,text:'This is a separate sheet showing this model page.'}));
    for(let i=0;i<4;i++) {
      b.push(entity('rect',{x1:35,y1:125-i*15,x2:55,y2:135-i*15}));
      b.push(entity('text',{x:40,y:128-i*15,h:2.8,text:'X'+(i+1)}));
      b.push(entity('line',{x1:55,y1:130-i*15,x2:165,y2:130-i*15}));
    }
    b.push(entity('rect',{x1:165,y1:75,x2:220,y2:145}));
    b.push(entity('text',{x:174,y:109,h:3,text:'CONTROLLER'}));
    return p;
  }
  function validateProject(input) {
    if(!input || typeof input!=='object' || !Array.isArray(input.pages) || input.pages.length<1 || input.pages.length>200)
      throw Error('Project must contain between 1 and 200 pages.');
    if(input.version!==1 && input.version!==2 && input.version!==3) throw Error('Unsupported project version.');
    const p=newProject();
    const number=(value,min,max,label)=>{const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error(label+' must be between '+min+' and '+max+'.');return n;};
    const paper=input.paper || {};
    p.paper={preset:paper.preset in presets?paper.preset:'custom',orientation:paper.orientation==='portrait'?'portrait':'landscape',
      width:number(paper.width,50,1000000,'Paper width'),height:number(paper.height,50,1000000,'Paper height')};
    p.gap=number(input.gap,0,5000,'Page gap');
    p.margin=number(input.margin,0,Math.min(p.paper.width,p.paper.height)/2-0.1,'Border margin');
    let count=0;
    function checked(e) {
      if(!e || !['line','rect','circle','arc','path','fill','text','variable'].includes(e.type)) throw Error('Unknown drawing entity.');
      if(++count>60000) throw Error('Project exceeds 60,000 entities.');
      const type=e.type==='variable'?'text':e.type;
      const out={id:uid(),type};
      const cp=p=>({x:number(p.x,-1e9,1e9,'X'),y:number(p.y,-1e9,1e9,'Y')});
      if(type==='path') {
        if(!Array.isArray(e.points)||e.points.length<2||e.points.length>10000)throw Error('Invalid polyline.');
        out.points=e.points.map(cp);out.closed=!!e.closed;
      } else if(type==='fill') {
        if(!Array.isArray(e.loops)||e.loops.length<1||e.loops.length>1000)throw Error('Invalid fill.');
        out.loops=e.loops.map(l=>{if(!Array.isArray(l)||l.length<3||l.length>10000)throw Error('Invalid fill boundary.');return l.map(cp);});
      } else {
        const fields=type==='line'||type==='rect'?['x1','y1','x2','y2']:type==='circle'||type==='arc'?['x','y','r']:['x','y','h'];
        fields.forEach(k=>{out[k]=number(e[k],k==='h'||k==='r'?0.000001:-1e9,1e9,k);});
      }
      if(type==='arc'){out.start=number(e.start,-1e7,1e7,'Start angle');out.end=number(e.end,-1e7,1e7,'End angle');}
      if(type==='text') {
        if(String(e.text||'').length>50000)throw Error('Text is too long.');
        out.text=text(e.text);out.angle=number(e.angle||0,-1e7,1e7,'Text angle');
        out.widthFactor=number(e.widthFactor===undefined?1:e.widthFactor,0.001,1000,'Text width factor');
        out.halign=number(e.halign||0,0,2,'Horizontal alignment');out.valign=number(e.valign||0,0,3,'Vertical alignment');
      }
      ['layer','sourceType','sourceHandle','sourceLineType'].forEach(k=>{if(e[k]!==undefined)out[k]=String(e[k]).slice(0,255);});
      if(e.literal)out.literal=true;
      if(Number.isInteger(e.colorIndex))out.colorIndex=e.colorIndex;
      if(Number.isInteger(e.trueColor)&&e.trueColor>=0&&e.trueColor<=0xffffff)out.trueColor=e.trueColor;
      return out;
    }
    const tb=input.titleBlock || {};
    p.titleBlock={enabled:tb.enabled!==false,width:number(tb.width,1,5000,'Title block width'),height:number(tb.height,1,5000,'Title block height'),
      entities:Array.isArray(tb.entities)?tb.entities.map(checked):defaults()};
    p.pages=input.pages.map((page,i)=>{
      if(!page || !Array.isArray(page.entities)) throw Error('Page '+(i+1)+' has no entity list.');
      const entities=page.entities.map(checked);
      // Version 1 displayed user drawing coordinates with SVG's downward Y axis.
      // Its title-block template was already intended as CAD-up, so only migrate drawing entities.
      if(input.version===1) entities.forEach(e=>{
        if(e.type==='line'||e.type==='rect') {e.y1=p.paper.height-e.y1;e.y2=p.paper.height-e.y2;}
        else e.y=p.paper.height-e.y;
      });
      return {id:uid(),title:text(page.title),number:text(page.number),revision:text(page.revision),productionStartDate:text(page.productionStartDate),productionEndDate:text(page.productionEndDate),model:text(page.model),drawnBy:text(page.drawnBy),checked:text(page.checked),scale:page.scale===undefined?'NTS':text(page.scale),frame:page.frame!==false,entities};
    });
    if(input.importInfo&&typeof input.importInfo==='object')p.importInfo=clone(input.importInfo);
    return p;
  }
	function vars(s, page, index, total) {
	  const values = {
		TITLE:                 page.title               ?? '',
		DRAWING_NUMBER:        page.number              ?? '',
		REVISION:              page.revision            ?? '',
		PAGE:                  index + 1,
		PAGECOUNT:             total,

		PRODUCTION_START_DATE: page.productionStartDate ?? '',
		PRODUCTION_END_DATE:   page.productionEndDate   ?? '',
		MODEL:                 page.model               ?? '',
		DRAWN_BY:              page.drawnBy             ?? '',
		CHECKED:               page.checked             ?? '',
		SCALE:                 page.scale               ?? 'NTS'
	  };

	  return text(s).replace(
		/\{([A-Z_]+)\}/g,
		(match, key) =>
		  Object.prototype.hasOwnProperty.call(values, key)
			? String(values[key])
			: match
	  );
	}
 
  function origin(p,index) { return {x:num(index*(p.paper.width+p.gap)),y:0}; }
  function moved(e,dx,dy) {
    const r=clone(e);
    if(e.type==='line'||e.type==='rect') {r.x1=num(e.x1+dx);r.y1=num(e.y1+dy);r.x2=num(e.x2+dx);r.y2=num(e.y2+dy);}
    else if(e.type==='path')r.points=e.points.map(p=>({x:num(p.x+dx),y:num(p.y+dy)}));
    else if(e.type==='fill')r.loops=e.loops.map(l=>l.map(p=>({x:num(p.x+dx),y:num(p.y+dy)})));
    else {r.x=num(e.x+dx);r.y=num(e.y+dy);}
    return r;
  }
  function scene(p) {
    const out=[];
    function add(e,dx,dy,layer,page,index) {
      const r=moved(e,dx,dy);r.layer=layer;r.page=index;
      if(r.type==='text'&&!r.literal) r.text=vars(r.text,page,index,p.pages.length);
      out.push(r);
    }
    p.pages.forEach((page,i)=>{
      const x=origin(p,i).x,W=p.paper.width,H=p.paper.height,m=p.margin;
      add(entity('rect',{x1:0,y1:0,x2:W,y2:H}),x,0,'PAGE-EDGE',page,i);
      if(page.frame!==false)add(entity('rect',{x1:m,y1:m,x2:W-m,y2:H-m}),x,0,'PAGE-FRAME',page,i);
      page.entities.forEach(e=>add(e,x,0,e.layer||'SCHEMATIC',page,i));
      if(p.titleBlock.enabled) p.titleBlock.entities.forEach(e=>add(e,x+W-m-p.titleBlock.width,m,'PAGE-FRAME',page,i));
    });
    return out;
  }
  function primitives(entities) {
    return entities.flatMap(e=>e.type!=='rect'?[e]:[
      {...e,type:'line',x1:e.x1,y1:e.y1,x2:e.x2,y2:e.y1},
      {...e,type:'line',x1:e.x2,y1:e.y1,x2:e.x2,y2:e.y2},
      {...e,type:'line',x1:e.x2,y1:e.y2,x2:e.x1,y2:e.y2},
      {...e,type:'line',x1:e.x1,y1:e.y2,x2:e.x1,y2:e.y1}
    ]);
  }
  function ascii(s) {
    // DXF text is kept on one physical line. Encode non-ASCII UTF-16 code units.
    return text(s).replace(/[^\x20-\x7e]/g,c=>'\\U+'+c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'));
  }
  function xml(s) {return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
  function ink(e) {
    if(Number.isInteger(e.trueColor)&&e.trueColor>0&&e.trueColor<0xf0f0f0)return '#'+e.trueColor.toString(16).padStart(6,'0');
    return ({1:'#b51f2b',2:'#9a7400',3:'#087833',4:'#007b88',5:'#1b4da0',6:'#99359b'}[Math.abs(e.colorIndex)]||'#1a2430');
  }
  function shapePath(e,svgCoords=true) {
    const y=v=>svgCoords?-v:v;
    if(e.type==='arc') {
      const a=e.start*Math.PI/180,b=e.end*Math.PI/180,d=((e.end-e.start)%360+360)%360;
      return 'M '+(e.x+e.r*Math.cos(a))+' '+y(e.y+e.r*Math.sin(a))+' A '+e.r+' '+e.r+' 0 '+(d>180?1:0)+' '+(svgCoords?0:1)+' '+(e.x+e.r*Math.cos(b))+' '+y(e.y+e.r*Math.sin(b));
    }
    const loop=ps=>ps.map((p,i)=>(i?'L ':'M ')+p.x+' '+y(p.y)).join(' ');
    if(e.type==='path')return loop(e.points)+(e.closed?' Z':'');
    if(e.type==='fill')return e.loops.map(l=>loop(l)+' Z').join(' ');
    return '';
  }
  function textYOffset(e){return e.valign===3?e.h:e.valign===2?e.h/2:0;}
  function svg(p) {
    const W=p.pages.length*p.paper.width+(p.pages.length-1)*p.gap,H=p.paper.height;
    const lines=[`<svg xmlns="http://www.w3.org/2000/svg" width="${num(W)}mm" height="${num(H)}mm" viewBox="0 ${-H} ${num(W)} ${H}">`, '<title>Page Builder - model pages</title>'];
    p.pages.forEach((page,i)=>lines.push(`<rect x="${origin(p,i).x}" y="${-H}" width="${p.paper.width}" height="${H}" fill="white" stroke="none"/>`));
    for(const e of scene(p)) {
      const stroke=e.layer==='PAGE-EDGE'?'#9ca3af':ink(e);
      if(e.type==='line')lines.push(`<line x1="${e.x1}" y1="${-e.y1}" x2="${e.x2}" y2="${-e.y2}" stroke="${stroke}" stroke-width="0.3"/>`);
      else if(e.type==='rect')lines.push(`<rect x="${Math.min(e.x1,e.x2)}" y="${-Math.max(e.y1,e.y2)}" width="${Math.abs(e.x2-e.x1)}" height="${Math.abs(e.y2-e.y1)}" fill="none" stroke="${stroke}" stroke-width="0.3"/>`);
      else if(e.type==='circle')lines.push(`<circle cx="${e.x}" cy="${-e.y}" r="${e.r}" fill="none" stroke="${stroke}" stroke-width="0.3"/>`);
      else if(['arc','path','fill'].includes(e.type))lines.push(`<path d="${shapePath(e)}" fill="${e.type==='fill'?stroke:'none'}" fill-rule="evenodd" stroke="${stroke}" stroke-width="${e.type==='fill'?0:0.3}"/>`);
      else lines.push(`<text transform="translate(${e.x} ${-e.y}) rotate(${-finite(e.angle,0)}) scale(${finite(e.widthFactor,1)} 1)" x="0" y="${textYOffset(e)}" text-anchor="${e.halign===1?'middle':e.halign===2?'end':'start'}" font-family="Arial, sans-serif" font-size="${num(e.h*TEXT_EM)}" fill="${stroke}">${xml(e.text)}</text>`);
    }
    lines.push('</svg>');return lines.join('\n');
  }
  function dxf(p,withSheets=true) {
    // R2000 ASCII: full ownership chain, per-layout block records, LAYOUT objects,
    // paper settings and locked 1:1 viewports. No binary data or runtime dependency.
    let next=0x100;
    const handle=()=> (next++).toString(16).toUpperCase();
    const rootH=handle(),layoutDict=handle(),groupDict=handle(),plotDict=handle();
    const tables={};['VPORT','LTYPE','LAYER','STYLE','VIEW','UCS','APPID','DIMSTYLE','BLOCK_RECORD'].forEach(n=>tables[n]=handle());
    const blocks=[{name:'*Model_Space',layout:'Model',index:0}];
    const paperCount=withSheets?p.pages.length:1;
    for(let i=0;i<paperCount;i++) blocks.push({name:i===0?'*Paper_Space':'*Paper_Space'+(i-1),layout:'Page-'+(i+1),index:i+1});
    blocks.forEach(b=>{b.record=handle();b.begin=handle();b.end=handle();b.object=handle();if(b.index){b.main=handle();if(withSheets)b.vp=handle();}});
    const model=blocks[0],W=p.paper.width,H=p.paper.height,totalW=p.pages.length*W+(p.pages.length-1)*p.gap;
    const pair=(code,val)=>String(code)+'\n'+(typeof val==='number'?num(val):val)+'\n';
    const tags=a=>a.map(t=>pair(t[0],t[1])).join('');
    const xyz=(code,x,y,z=0)=>[[code,x],[code+10,y],[code+20,z]];
    const sec=(name,body)=>tags([[0,'SECTION'],[2,name]])+body+tags([[0,'ENDSEC']]);
    function table(name,entries){return tags([[0,'TABLE'],[2,name],[5,tables[name]],[330,'0'],[100,'AcDbSymbolTable'],[70,entries.length]])+entries.join('')+tags([[0,'ENDTAB']]);}
    function entry(type,subclass,name,more=[]) {return tags([[0,type],[5,handle()],[330,tables[type]],[100,'AcDbSymbolTableRecord'],[100,subclass],[2,name],...more]);}
    const t=[];
    t.push(table('VPORT',[entry('VPORT','AcDbViewportTableRecord','*Active',[[70,0],[10,0],[20,0],[11,1],[21,1],[12,totalW/2],[22,H/2],[13,0],[23,0],[14,1],[24,1],[15,10],[25,10],...xyz(16,0,0,1),...xyz(17,0,0),[40,Math.max(H*1.15,totalW/1.6*1.05)],[41,1.6],[42,50],[43,0],[44,0],[50,0],[51,0],[71,0],[72,1000],[73,0],[74,3],[75,0],[76,0],[77,0],[78,0],[281,0],[65,0],[146,0]])]));
    t.push(table('LTYPE',['ByBlock','ByLayer','Continuous'].map(n=>entry('LTYPE','AcDbLinetypeTableRecord',n,[[70,0],[3,n==='Continuous'?'Solid line':''],[72,65],[73,0],[40,0]]))));
    const layerNames=[...new Set(['0','PAGE-EDGE','PAGE-FRAME','SCHEMATIC','VIEWPORTS',...scene(p).map(e=>e.layer)])];
    t.push(table('LAYER',layerNames.map(n=>entry('LAYER','AcDbLayerTableRecord',n,[[70,0],[62,7],[6,'Continuous'],[290,n==='PAGE-EDGE'||n==='VIEWPORTS'?0:1],[370,-3]]))));
    t.push(table('STYLE',[entry('STYLE','AcDbTextStyleTableRecord','Standard',[[70,0],[40,0],[41,1],[50,0],[71,0],[42,2.5],[3,'txt'],[4,'']])]));
    t.push(table('VIEW',[]),table('UCS',[]));
    t.push(table('APPID',[entry('APPID','AcDbRegAppTableRecord','ACAD',[[70,0]])]));
    t.push(table('DIMSTYLE',[]));
    t.push(table('BLOCK_RECORD',blocks.map(b=>tags([[0,'BLOCK_RECORD'],[5,b.record],[330,tables.BLOCK_RECORD],[100,'AcDbSymbolTableRecord'],[100,'AcDbBlockTableRecord'],[2,b.name],[340,b.object]]))));
    const base=(type,h,owner,layer,paper)=>[[0,type],[5,h],[330,owner],[100,'AcDbEntity'],...(paper?[[67,1],[410,paper]]:[[67,0],[410,'Model']]),[8,layer]];
    function viewport(b,main) {
      const cx=W/2,cy=H/2;
      return tags([...base('VIEWPORT',main?b.main:b.vp,b.record,'VIEWPORTS',b.layout),[100,'AcDbViewport'],
        ...xyz(10,cx,cy),[40,main?W*1.1:W],[41,main?H*1.1:H],[68,main?1:2],[69,main?1:2],
        [12,main?cx:origin(p,b.index-1).x+cx],[22,cy],[13,0],[23,0],[14,1],[24,1],[15,10],[25,10],
        ...xyz(16,0,0,1),...xyz(17,0,0),[42,50],[43,0],[44,0],[45,main?H*1.1:H],[50,0],[51,0],[72,100],
        [90,main?557088:16384],[1,''],[281,0],[71,0],[74,0],...xyz(110,0,0),...xyz(111,1,0),...xyz(112,0,1),[79,0],[146,0]]);
    }
    const paperEntities=b=>viewport(b,true)+(b.vp?viewport(b,false):'');
    const bs=[];
    blocks.forEach(b=>{
      bs.push(tags([[0,'BLOCK'],[5,b.begin],[330,b.record],[100,'AcDbEntity'],[8,'0'],[100,'AcDbBlockBegin'],[2,b.name],[70,0],...xyz(10,0,0),[3,b.name],[1,'']]));
      if(b.index>1) bs.push(paperEntities(b));
      bs.push(tags([[0,'ENDBLK'],[5,b.end],[330,b.record],[100,'AcDbEntity'],[8,'0'],[100,'AcDbBlockEnd']]));
    });
    const es=[];
    primitives(scene(p)).forEach(e=>{
      const type=e.type==='path'?'LWPOLYLINE':e.type==='fill'?'HATCH':e.type.toUpperCase();
      let data=base(type,handle(),model.record,e.layer,null);
      if(Number.isInteger(e.colorIndex)&&Math.abs(e.colorIndex)>0&&Math.abs(e.colorIndex)<256)data.push([62,Math.abs(e.colorIndex)]);
      if(e.type==='line')data.push([100,'AcDbLine'],...xyz(10,e.x1,e.y1),...xyz(11,e.x2,e.y2));
      else if(e.type==='circle'||e.type==='arc'){
        data.push([100,'AcDbCircle'],...xyz(10,e.x,e.y),[40,e.r]);
        if(e.type==='arc')data.push([100,'AcDbArc'],[50,((e.start%360)+360)%360],[51,((e.end%360)+360)%360]);
      } else if(e.type==='path') {
        data.push([100,'AcDbPolyline'],[90,e.points.length],[70,e.closed?1:0]);
        e.points.forEach(pt=>data.push([10,pt.x],[20,pt.y]));
      } else if(e.type==='fill') {
        data.push([100,'AcDbHatch'],...xyz(10,0,0),...xyz(210,0,0,1),[2,'SOLID'],[70,1],[71,0],[91,e.loops.length]);
        e.loops.forEach(l=>{data.push([92,2],[72,0],[73,1],[93,l.length]);l.forEach(pt=>data.push([10,pt.x],[20,pt.y]));data.push([97,0]);});
        data.push([75,0],[76,1],[98,0]);
      } else data.push([100,'AcDbText'],...xyz(10,e.x,e.y),[40,e.h],[1,ascii(e.text)],[50,finite(e.angle,0)],[41,finite(e.widthFactor,1)],[51,0],[7,'Standard'],[71,0],[72,e.halign||0],...xyz(11,e.x,e.y),[100,'AcDbText'],[73,e.valign||0]);
      es.push(tags(data));
    });
    es.push(paperEntities(blocks[1]));
    function dict(h,owner,entries) {return tags([[0,'DICTIONARY'],[5,h],[330,owner],[100,'AcDbDictionary'],[280,0],[281,1],...entries.flatMap(([name,ref])=>[[3,name],[350,ref]])]);}
    const os=[dict(rootH,'0',[['ACAD_GROUP',groupDict],['ACAD_LAYOUT',layoutDict],['ACAD_PLOTSETTINGS',plotDict]]),dict(groupDict,rootH,[]),dict(plotDict,rootH,[]),dict(layoutDict,rootH,blocks.map(b=>[b.layout,b.object]))];
    blocks.forEach(b=>{
      os.push(tags([[0,'LAYOUT'],[5,b.object],[330,layoutDict],[100,'AcDbPlotSettings'],[1,''],[2,''],[4,'PageBuilder_('+num(W)+'_x_'+num(H)+'_MM)'],[6,''],
        [40,0],[41,0],[42,0],[43,0],[44,W],[45,H],[46,0],[47,0],[48,0],[49,0],[140,0],[141,0],[142,1],[143,1],
        [70,b.index?672:1024],[72,1],[73,0],[74,5],[7,''],[75,16],[76,0],[77,2],[78,300],[147,1],[148,0],[149,0],
        [100,'AcDbLayout'],[1,b.layout],[70,1],[71,b.index],[10,0],[20,0],[11,b.index?W:totalW],[21,H],...xyz(12,0,0),
        ...xyz(14,0,0),...xyz(15,b.index?W:totalW,H),[146,0],...xyz(13,0,0),...xyz(16,1,0),...xyz(17,0,1),[76,1],[330,b.record],...(b.index?[[331,b.main]]:[])]));
    });
    const header=tags([[9,'$ACADVER'],[1,'AC1015'],[9,'$ACADMAINTVER'],[70,6],[9,'$DWGCODEPAGE'],[3,'ANSI_1252'],[9,'$HANDSEED'],[5,next.toString(16).toUpperCase()],
      [9,'$INSBASE'],...xyz(10,0,0),[9,'$EXTMIN'],...xyz(10,0,0),[9,'$EXTMAX'],...xyz(10,totalW,H),[9,'$LIMMIN'],[10,0],[20,0],[9,'$LIMMAX'],[10,totalW],[20,H],
      [9,'$TILEMODE'],[70,1],[9,'$CTAB'],[1,'Model'],[9,'$INSUNITS'],[70,4],[9,'$MEASUREMENT'],[70,1],[9,'$LUNITS'],[70,2],[9,'$LUPREC'],[70,3],[9,'$TEXTSTYLE'],[7,'Standard'],[9,'$CLAYER'],[8,'SCHEMATIC']]);
    return sec('HEADER',header)+sec('CLASSES','')+sec('TABLES',t.join(''))+sec('BLOCKS',bs.join(''))+sec('ENTITIES',es.join(''))+sec('OBJECTS',os.join(''))+tags([[0,'EOF']]);
  }
  function lisp(p) {
    if(scene(p).some(e=>['arc','path','fill'].includes(e.type)||e.type==='text'&&(e.angle||e.halign||e.valign)))throw Error('Use DXF for imported curves, fills and rotated/aligned text. The LISP fallback is for basic drawings.');
    const ls=s=>'"'+ascii(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
    const lines=[
      '; Page Builder '+VERSION+' - MODEL-ONLY fallback. The DXF export includes Sheets.',
      '; LoadApplication, select this file, then type BUILDWEBPAGES in an EMPTY drawing.',
      '; Loading only defines the command. This file does not execute automatically.',
      '(defun wpb2:make (data)',
      '  (if (not (entmake data)) (progn (princ "\\nCould not create an entity.") (exit))))',
      '(defun wpb2:layer (name plot)',
      '  (if (not (tblsearch "LAYER" name))',
      '    (wpb2:make (list \'(0 . "LAYER") \'(100 . "AcDbSymbolTableRecord")',
      '      \'(100 . "AcDbLayerTableRecord") (cons 2 name) \'(70 . 0)',
      '      \'(62 . 7) \'(6 . "Continuous") (cons 290 plot)))))',
      '(defun c:BUILDWEBPAGES (/ *error* oldtile oldtab)',
      '  (setq oldtile (getvar "TILEMODE") oldtab (getvar "CTAB"))',
      '  (defun *error* (msg)',
      '    (if (= oldtile 1) (setvar "TILEMODE" 1) (progn (setvar "TILEMODE" 0) (setvar "CTAB" oldtab)))',
      '    (princ (strcat "\\nBUILDWEBPAGES stopped: " msg "\\nPartial geometry may remain. This command does not delete it.")) (princ))',
      '  (if (ssget "_X" \'((410 . "Model")))',
      '    (princ "\\nUse an empty test drawing. Nothing was added.")',
      '    (progn',
      '      (setvar "TILEMODE" 1)',
      '      (wpb2:layer "PAGE-EDGE" 0) (wpb2:layer "PAGE-FRAME" 1) (wpb2:layer "SCHEMATIC" 1)'
    ];
    for(const e of primitives(scene(p))) {
      let body=`(0 . ${ls(e.type.toUpperCase())}) (8 . ${ls(e.layer)}) (67 . 0) (410 . "Model") `;
      if(e.type==='line')body+=`(10 ${num(e.x1)} ${num(e.y1)} 0.0) (11 ${num(e.x2)} ${num(e.y2)} 0.0)`;
      else if(e.type==='circle')body+=`(10 ${num(e.x)} ${num(e.y)} 0.0) (40 . ${num(e.r)})`;
      else body+=`(10 ${num(e.x)} ${num(e.y)} 0.0) (40 . ${num(e.h)}) (1 . ${ls(e.text)}) (7 . "Standard")`;
      lines.push("      (wpb2:make '("+body+'))');
    }
    lines.push('      (command "_ZoomFit")','      (princ "\\nModel pages created. For linked Sheet tabs, use the browser DXF export.")','    )','  )','  (princ)',' )',
      '(princ "\\nLoaded: BUILDWEBPAGES (empty drawing, Model-only fallback)")','(princ)');
    return lines.join('\n')+'\n';
  }
  const api={VERSION,TEXT_EM,ink,shapePath,textYOffset,clone,uid,num,finite,text,presets,entity,defaults,newPage,newProject,sampleProject,validateProject,vars,origin,moved,scene,primitives,ascii,svg,dxf,lisp};
  root.PageBuilderCore=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

