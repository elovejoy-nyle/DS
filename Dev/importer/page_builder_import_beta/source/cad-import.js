/* Page Builder CAD import adapter. Original code for this application.
 * Decoder data schema: @mlightcad/libredwg-web 0.7.x.
 * This adapter never writes the source drawing and never makes network requests.
 * Unsupported entities and approximations are collected in a report.
 */
(function(root){
'use strict';
const TAU=Math.PI*2, DEG=180/Math.PI, LIMIT=60000;
const number=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const point=p=>Array.isArray(p)?{x:number(p[0]),y:number(p[1]),z:number(p[2])}:{x:number(p&&p.x),y:number(p&&p.y),z:number(p&&p.z)};
const identity=[1,0,0,1,0,0];
const entries=t=>Array.isArray(t)?t:(t&&Array.isArray(t.entries)?t.entries:[]);
const apply=(m,p)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
function rotation(a,x=0,y=0,sx=1,sy=1){const c=Math.cos(a),s=Math.sin(a);return [c*sx,s*sx,-s*sy,c*sy,x,y];}
function scalar(m){const x=Math.hypot(m[0],m[1]),y=Math.hypot(m[2],m[3]);return {x,y,uniform:Math.abs(x-y)<1e-8*Math.max(1,x,y)&&Math.abs(m[0]*m[2]+m[1]*m[3])<1e-8*Math.max(1,x*y),det:m[0]*m[3]-m[1]*m[2]};}
function angleSweep(a,b,ccw=true){let d=ccw?b-a:a-b;while(d<0)d+=TAU;return Math.abs(d)<1e-10?TAU:Math.min(d,TAU);}
const unitTable={1:['inches',25.4],2:['feet',304.8],4:['millimetres',1],5:['centimetres',10],6:['metres',1000],7:['kilometres',1e6],8:['microinches',0.0000254],9:['mils',0.0254],10:['yards',914.4],11:['angstroms',1e-7],12:['nanometres',1e-6],13:['microns',0.001],14:['decimetres',100],15:['decametres',10000],16:['hectometres',100000],21:['US survey feet',1200000/3937]};
function plainText(s){
 return String(s==null?'':s).replace(/\\U\+([0-9a-fA-F]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16)))
 .replace(/%%d/gi,'\u00b0').replace(/%%p/gi,'\u00b1').replace(/%%c/gi,'\u2300')
 .replace(/\\P/g,'\n').replace(/\\~/g,' ').replace(/\\[LlOoKk]/g,'')
 .replace(/\\S([^;]*);/g,(_,v)=>v.replace(/[\^#]/g,'/'))
 .replace(/\\[ACcFfHhQqTtWwpa][^;]*;/g,'').replace(/[{}]/g,'').replace(/\\([\\{}])/g,'$1');
}
function decodeDatabase(db,options={}){
 if(!db||!Array.isArray(db.entities))throw Error('The DWG reader returned an unrecognized database. Save the diagnostic JSON so the adapter can be updated.');
 const report={sourceName:options.name||'Drawing',sourceEntityTypes:{},expandedEntityTypes:{},skipped:{},approximated:{},notes:[],decoderStats:options.stats||{},decodedModelEntities:db.entities.length};
 const bump=(obj,key,n=1)=>obj[key]=(obj[key]||0)+n;
 const skipped=(reason,e)=>{bump(report.skipped,reason);if(e&&report.examples===undefined)report.examples=[];if(e&&report.examples.length<30)report.examples.push({type:e.type,handle:e.handle,reason});};
 const approximation=reason=>bump(report.approximated,reason);
 const layers=new Map(entries(db.tables&&db.tables.LAYER).map(x=>[x.name,x]));
 const blocks=new Map(entries(db.tables&&db.tables.BLOCK_RECORD).map(x=>[x.name,x]));
 const blockRecords=entries(db.tables&&db.tables.BLOCK_RECORD);
 const modelRecord=blockRecords.find(b=>/^\*?model_space$/i.test(b.name));
 const paperRecords=blockRecords.filter(b=>/^\*?paper_space/i.test(b.name));
 const paperOwners=new Set(paperRecords.map(b=>b.handle).filter(Boolean));
 const paperEntityHandles=new Set(paperRecords.flatMap(b=>(b.entities||[]).flatMap(e=>[e.handle,...(e.attribs||[]).map(a=>a.handle)])).filter(Boolean));
 // LibreDWG-Web's entity list can include paper-space objects without an isInPaperSpace flag.
 // Prefer the actual Model block ownership list; otherwise classify by owner handles.
 const source=modelRecord&&modelRecord.entities&&modelRecord.entities.length?modelRecord.entities:db.entities;
 report.decodedModelEntities=source.filter(e=>!e.isInPaperSpace&&!paperOwners.has(e.ownerBlockRecordSoftId)&&!paperEntityHandles.has(e.handle)).length;
 if(paperRecords.length)report.skipped['Paper-space definitions (Model import only)']=paperRecords.reduce((n,b)=>n+(b.entities||[]).length,0);
 const attachedRootHandles=new Set(source.filter(e=>e.type==='INSERT').flatMap(e=>(e.attribs||[]).map(a=>a.handle)).filter(Boolean));
 const output=[];
 if(number(report.decoderStats.unknownEntityCount)>0)report.skipped['Entities not described by the DWG decoder']=report.decoderStats.unknownEntityCount;
 function emit(type,props,source,layer){
  if(output.length>=LIMIT)throw Error('Import would exceed '+LIMIT+' objects. The current project has not been changed.');
  const e={id:'imp_'+output.length,type,...props,layer:layer||source.layer||'0',literal:true,sourceType:source.type,sourceHandle:String(source.handle||'')};
  if(Number.isInteger(source.colorIndex))e.colorIndex=source.colorIndex;
  if(Number.isInteger(source.color)&&source.color>=0&&source.color<=0xffffff)e.trueColor=source.color;
  const ly=layers.get(e.layer);
  if((e.colorIndex===undefined||e.colorIndex===256)&&ly)e.colorIndex=ly.colorIndex;
  if(e.trueColor===undefined&&ly&&Number.isInteger(ly.color)&&ly.color>0)e.trueColor=ly.color;
  if(source.lineType&& !/^(bylayer|byblock|continuous)$/i.test(source.lineType))e.sourceLineType=source.lineType;
  else if(ly&&ly.lineType&&!/^continuous$/i.test(ly.lineType))e.sourceLineType=ly.lineType;
  output.push(e);
 }
 function line(a,b,m,e,layer){a=apply(m,point(a));b=apply(m,point(b));emit('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y},e,layer);}
 function path(points,m,e,layer,closed=false){if(points.length<2){skipped('Empty or degenerate curve',e);return;}emit('path',{points:points.map(p=>apply(m,point(p))),closed},e,layer);}
 function arc(center,r,a,b,m,e,layer,ccw=true){
  center=point(center);r=Math.abs(number(r));if(!r){skipped('Zero-radius arc',e);return;}
  const sc=scalar(m),sweep=angleSweep(a,b,ccw);
  if(sc.uniform){const c=apply(m,center),p1=apply(m,{x:center.x+r*Math.cos(a),y:center.y+r*Math.sin(a)}),p2=apply(m,{x:center.x+r*Math.cos(b),y:center.y+r*Math.sin(b)});
   if(sweep>TAU-1e-8)emit('circle',{x:c.x,y:c.y,r:r*sc.x},e,layer);
   else {let start=Math.atan2(p1.y-c.y,p1.x-c.x)*DEG,end=Math.atan2(p2.y-c.y,p2.x-c.x)*DEG;if((sc.det<0)===ccw)[start,end]=[end,start];emit('arc',{x:c.x,y:c.y,r:r*sc.x,start,end},e,layer);}return;
  }
  approximation('Non-uniformly scaled arcs/circles converted to polylines');
  const n=Math.max(12,Math.min(720,Math.ceil(sweep/(Math.PI/90)))),ps=[];
  for(let i=0;i<=n;i++){const t=a+(ccw?1:-1)*sweep*i/n;ps.push({x:center.x+r*Math.cos(t),y:center.y+r*Math.sin(t)});}path(ps,m,e,layer,sweep>TAU-1e-8);
 }
 function poly(vertices,closed,m,e,layer){
  if(!vertices||vertices.length<2){skipped('Empty polyline',e);return;}
  const hasBulge=vertices.some(v=>Math.abs(number(v.bulge))>1e-10);
  if(!hasBulge){path(vertices.map(v=>v.position||v.point||v),m,e,layer,closed);return;}
  approximation('Bulged polylines split into editable lines/arcs');
  const n=vertices.length;
  for(let i=0;i<n-(closed?0:1);i++){
   const a=point(vertices[i].position||vertices[i]),b=point(vertices[(i+1)%n].position||vertices[(i+1)%n]),bulge=number(vertices[i].bulge);
   if(Math.abs(bulge)<1e-10){line(a,b,m,e,layer);continue;}
   const dx=b.x-a.x,dy=b.y-a.y,chord=Math.hypot(dx,dy);if(!chord)continue;
   const t=(1-bulge*bulge)/(4*bulge),c={x:(a.x+b.x)/2-dy*t,y:(a.y+b.y)/2+dx*t},r=chord*(1+bulge*bulge)/(4*Math.abs(bulge));
   arc(c,r,Math.atan2(a.y-c.y,a.x-c.x),Math.atan2(b.y-c.y,b.x-c.x),m,e,layer,bulge>0);
  }
 }
 function textEntity(e,m,layer){
  const isM=e.type==='MTEXT',v=e.type==='ATTRIB'||e.type==='ATTDEF'?(typeof e.text==='object'?e.text:{...e,text:e.text||e.defaultValue||''}):e;
  if((e.type==='ATTRIB'||e.type==='ATTDEF')&&(number(e.flags)&1)){skipped('Invisible attributes',e);return;}
  const raw=v.text==null?'':v.text,content=isM?plainText(raw):String(raw).replace(/\\U\+([0-9a-fA-F]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/%%d/gi,'\u00b0').replace(/%%p/gi,'\u00b1').replace(/%%c/gi,'\u2300');
  const h=number(v.textHeight||v.height,2.5);if(!(h>0))return;
  const a=isM&&v.direction&&Math.hypot(number(v.direction.x),number(v.direction.y))>1e-9?Math.atan2(v.direction.y,v.direction.x):number(v.rotation),dx={x:Math.cos(a),y:Math.sin(a)},dy={x:-Math.sin(a),y:Math.cos(a)};
  const sx=Math.hypot(m[0]*dx.x+m[2]*dx.y,m[1]*dx.x+m[3]*dx.y),sy=Math.hypot(m[0]*dy.x+m[2]*dy.y,m[1]*dy.x+m[3]*dy.y);
  const angle=Math.atan2(m[1]*dx.x+m[3]*dx.y,m[0]*dx.x+m[2]*dx.y)*DEG;
  let pos=point(isM?v.insertionPoint:v.startPoint||v.insertionPoint),halign=number(v.halign),valign=number(v.valign);
  if(!isM&&(halign||valign)&&v.endPoint)pos=point(v.endPoint);
  if(halign>2){halign=0;approximation('Aligned/fitted text approximated using its stored height and width');}
  if(isM){approximation('MTEXT formatting/wrapping simplified to editable text lines');const attach=Math.max(1,number(v.attachmentPoint,1));halign=(attach-1)%3;valign=0;
   const ls=content.split('\n'),pitch=h*1.667*number(v.lineSpacing,1),height=ls.length*pitch;
   let offset=attach<=3?-h:attach<=6?height/2-h:height-h;
   ls.forEach((s,i)=>{const pp=apply(m,{x:pos.x+dy.x*(offset-i*pitch),y:pos.y+dy.y*(offset-i*pitch)});emit('text',{...pp,h:h*sy,text:s,angle,widthFactor:sx/Math.max(sy,1e-9),halign,valign:0},e,layer);});
  }else{const p=apply(m,pos);emit('text',{...p,h:h*sy,text:content,angle,widthFactor:number(v.xScale,1)*sx/Math.max(sy,1e-9),halign,valign},e,layer);}
  if(number(v.obliqueAngle))approximation('Oblique text displayed without slant');
  if(number(v.generationFlag)||scalar(m).det<0)approximation('Mirrored text displayed readable; verify placement');
 }
 function flat(e,m=identity,layer='0',stack=[]){
  if(!e||!e.type)return;
  bump(report.expandedEntityTypes,e.type);
  layer=e.layer&&e.layer!=='0'?e.layer:layer;
  const ly=layers.get(layer);
  if(!options.includeHidden&&ly&&(ly.off||ly.frozen||number(ly.colorIndex,7)<0)){skipped('Entities on off/frozen layers',e);return;}
  if(e.isVisible===false&&!options.includeHidden){skipped('Hidden entities',e);return;}
  const ex=e.extrusionDirection||e.normal;
  if(ex&&(Math.abs(number(ex.x))>1e-8||Math.abs(number(ex.y))>1e-8)){skipped('Non-XY entity (3D projection not supported)',e);return;}
  const original=m;
  if(ex&&number(ex.z,1)<0&&!['LINE','ELLIPSE','SPLINE','MTEXT'].includes(e.type))m=multiply(m,[-1,0,0,1,0,0]);
  try{
   switch(e.type){
    case 'LINE':line(e.startPoint,e.endPoint,m,e,layer);break;
    case 'CIRCLE':arc(e.center,e.radius,0,TAU,m,e,layer);break;
    case 'ARC':arc(e.center,e.radius,number(e.startAngle),number(e.endAngle),m,e,layer);break;
    case 'TEXT':case 'MTEXT':case 'ATTRIB':textEntity(e,m,layer);break;
    case 'ATTDEF':if(number(e.flags)&2)textEntity(e,m,layer);else bump(report.skipped,'Nonconstant attribute definitions (instance attributes used)');break;
    case 'LWPOLYLINE':poly(e.vertices,!!(number(e.flag)&512)||e.closed===true,m,e,layer);if(e.constantWidth||e.vertices.some(v=>v.startWidth||v.endWidth))approximation('Polyline widths simplified to centreline strokes');break;
    case 'POLYLINE':case 'POLYLINE_2D':case 'POLYLINE_3D':case 'POLYLINE2D':case 'POLYLINE3D':poly(e.vertices||e.points,!!(number(e.flag)&1),m,e,layer);break;
    case 'INSERT':case 'MINSERT':{
     const b=blocks.get(e.name);if(!b){skipped('Missing block definition: '+e.name,e);break;}
     if(stack.includes(e.name)||stack.length>30){skipped('Recursive or overly nested block: '+e.name,e);break;}
     const base=point(b.basePoint),pos=point(e.insertionPoint),angle=number(e.rotation),sx=number(e.xScale,1),sy=number(e.yScale,1);
     const rows=Math.max(1,number(e.rowCount,1)),cols=Math.max(1,number(e.columnCount,1));
     if(rows*cols>10000)throw Error('Block array is too large.');
     for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const rr=rotation(angle,pos.x,pos.y),off=[sx,0,0,sy,col*number(e.columnSpacing)-sx*base.x,row*number(e.rowSpacing)-sy*base.y],mat=multiply(m,multiply(rr,off));
      (b.entities||[]).forEach(child=>flat(child,mat,layer,[...stack,e.name]));
     }
     // Attached attribute coordinates are in the containing space, not block-local.
     (e.attribs||[]).forEach(a=>flat(a,original,layer,stack));
     approximation('Block references expanded to editable geometry');
     if((number(b.flags)&12)&&!(b.entities||[]).length)skipped('Unresolved external drawing reference: '+e.name,e);
     break;
    }
    case 'DIMENSION':{
     const b=blocks.get(e.name);if(b&&b.entities&&b.entities.length){b.entities.forEach(ch=>flat(ch,m,layer,[...stack,e.name]));approximation('Dimensions imported as static geometry/text');}else skipped('Dimension without a cached block picture',e);break;
    }
    case 'ELLIPSE':{
     const c=point(e.center),v=point(e.majorAxisEndPoint),ratio=number(e.axisRatio,1),a=number(e.startAngle),sweep=angleSweep(a,number(e.endAngle,TAU)),n=Math.max(24,Math.ceil(sweep/(Math.PI/90))),ps=[];
     for(let i=0;i<=n;i++){const t=a+sweep*i/n;ps.push({x:c.x+v.x*Math.cos(t)-v.y*ratio*Math.sin(t),y:c.y+v.y*Math.cos(t)+v.x*ratio*Math.sin(t)});}path(ps,m,e,layer,sweep>TAU-1e-8);approximation('Ellipses sampled to editable polylines (2-degree steps)');break;
    }
    case 'SPLINE':{
     const ps=e.controlPoints||[],ks=e.knots||[],deg=number(e.degree,3),ws=e.weights||[];
     if(ps.length<=deg||ks.length!==ps.length+deg+1){skipped('Spline without valid control points/knots',e);break;}
     function value(u){let k=deg;while(k<ps.length-1&&u>=ks[k+1])k++;const d=[];for(let j=0;j<=deg;j++){const i=k-deg+j,p=point(ps[i]),w=number(ws[i],1);d[j]=[p.x*w,p.y*w,w];}for(let r=1;r<=deg;r++)for(let j=deg;j>=r;j--){const i=k-deg+j,den=ks[i+deg-r+1]-ks[i],a=den?(u-ks[i])/den:0;d[j]=d[j].map((v,t)=>(1-a)*d[j-1][t]+a*v);}return{x:d[deg][0]/d[deg][2],y:d[deg][1]/d[deg][2]};}
     const start=ks[deg],end=ks[ps.length],n=Math.min(1000,Math.max(60,ps.length*12)),out=[];for(let i=0;i<=n;i++)out.push(value(start+(end-start)*i/n));path(out,m,e,layer,!!(number(e.flag)&1));approximation('Splines sampled to editable polylines');break;
    }
    case 'SOLID':case 'TRACE':{
     let ps=[e.corner1,e.corner2,e.corner4||e.corner3,e.corner3].map(point);emit('fill',{loops:[ps.map(p=>apply(m,p))]},e,layer);break;
    }
    case 'HATCH':{
     const loops=[];
     for(const p of e.boundaryPaths||[]){let ps=[];if(p.vertices){const verts=p.vertices;for(let i=0;i<verts.length;i++){const v=verts[i],w=verts[(i+1)%verts.length],a=point(v),b=point(w),bulge=number(v.bulge);ps.push(a);if(Math.abs(bulge)>1e-9){const dx=b.x-a.x,dy=b.y-a.y,t=(1-bulge*bulge)/(4*bulge),c={x:(a.x+b.x)/2-dy*t,y:(a.y+b.y)/2+dx*t},r=Math.hypot(a.x-c.x,a.y-c.y),start=Math.atan2(a.y-c.y,a.x-c.x),sweep=4*Math.atan(bulge);for(let j=1;j<24;j++){const q=start+sweep*j/24;ps.push({x:c.x+r*Math.cos(q),y:c.y+r*Math.sin(q)});}}}}
      else for(const edge of p.edges||[]){if(edge.type===1){ps.push(point(edge.start),point(edge.end));}else if(edge.type===2){const c=point(edge.center),a=number(edge.startAngle),sw=angleSweep(a,number(edge.endAngle),edge.isCCW!==false),n=Math.max(12,Math.ceil(sw/(Math.PI/90)));for(let i=0;i<=n;i++){const q=a+(edge.isCCW===false?-1:1)*sw*i/n;ps.push({x:c.x+edge.radius*Math.cos(q),y:c.y+edge.radius*Math.sin(q)});}}else{skipped('Unsupported hatch boundary edge',e);ps=[];break;}}
      if(ps.length>2)loops.push(ps.map(p=>apply(m,p)));
     }
     if(!loops.length){skipped('Hatch without supported boundary',e);break;}
     if(e.solidFill===1)emit('fill',{loops},e,layer);
     else {loops.forEach(points=>emit('path',{points,closed:true},e,layer));approximation('Pattern hatches imported as outlines only');}
     if(e.boundaryPaths.some(p=>p.edges||p.vertices&&p.vertices.some(v=>v.bulge)))approximation('Curved hatch boundaries sampled');break;
    }
    case 'LEADER':path(e.vertices||[],m,e,layer);approximation('Leader arrowheads/associations not reconstructed');break;
    case 'VIEWPORT':case 'SEQEND':case 'VERTEX':case 'BLOCK':case 'ENDBLK':break;
    default:skipped('Unsupported '+e.type,e);
   }
  }catch(err){if(output.length>=LIMIT)throw err;skipped('Could not translate '+e.type+': '+err.message,e);}
 }
 for(const e of source){bump(report.sourceEntityTypes,e.type||'unknown');if(e.isInPaperSpace||paperOwners.has(e.ownerBlockRecordSoftId)||paperEntityHandles.has(e.handle)){bump(report.skipped,'Paper-space entities (Model import only)');continue;}if(e.type==='ATTRIB'&&e.handle&&attachedRootHandles.has(e.handle))continue;flat(e);}
 if(!output.length)throw Error('No supported visible Model geometry was found. This importer does not yet reconstruct paper-space-only drawings.');
 // Reject bad numeric geometry instead of allowing it to break the canvas/exporter.
 const valid=output.filter(e=>{const vals=e.type==='line'?[e.x1,e.y1,e.x2,e.y2]:e.type==='path'?e.points.flatMap(p=>[p.x,p.y]):e.type==='fill'?e.loops.flatMap(l=>l.flatMap(p=>[p.x,p.y])):[e.x,e.y,e.h||e.r];if(vals.some(v=>!Number.isFinite(v))){skipped('Invalid numeric geometry',e);return false;}return true;});
 const unitCode=number(db.header&&(db.header.INSUNITS??db.header.$INSUNITS)),unit=unitTable[unitCode];
 report.unitCode=unitCode;report.unitName=unit?unit[0]:'unspecified';report.suggestedScale=unit?unit[1]:null;
 report.layoutNames=(db.objects&&db.objects.LAYOUT||[]).map(x=>x.layoutName||x.name).filter(Boolean);
 report.importedObjects=valid.length;
 report.notes.push('This first importer brings the entire Model into one editing canvas. Original relative positions are retained; existing Sheet tabs/viewports are not reconstructed.');
 report.notes.push('Existing title-block lettering is imported as literal editable text, not automatically bound to page variables.');
 report.notes.push('Fonts are substituted with Arial in the browser and Standard in DXF. Verify text fit. Original line patterns/weights are not fully reproduced.');
 if(Object.keys(report.skipped).length)report.notes.push('Review all skipped items before using this import as a complete drawing.');
 return {entities:valid,report};
}
function bounds(es){
 let xmin=Infinity,ymin=Infinity,xmax=-Infinity,ymax=-Infinity;
 function add(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return;xmin=Math.min(xmin,x);ymin=Math.min(ymin,y);xmax=Math.max(xmax,x);ymax=Math.max(ymax,y);}
 for(const e of es){
  if(e.type==='line'||e.type==='rect'){add(e.x1,e.y1);add(e.x2,e.y2);}
  else if(e.type==='circle'||e.type==='arc'){add(e.x-e.r,e.y-e.r);add(e.x+e.r,e.y+e.r);}
  else if(e.type==='path')e.points.forEach(p=>add(p.x,p.y));
  else if(e.type==='fill')e.loops.forEach(l=>l.forEach(p=>add(p.x,p.y)));
  else {const w=String(e.text).length*e.h*0.95*number(e.widthFactor,1),a=number(e.angle)/DEG,c=Math.cos(a),s=Math.sin(a),left=e.halign===1?-w/2:e.halign===2?-w:0,low=e.valign===3?-e.h:e.valign===2?-e.h/2:-e.h*.2;[[left,low],[left+w,low],[left,low+e.h*1.2],[left+w,low+e.h*1.2]].forEach(([x,y])=>add(e.x+c*x-s*y,e.y+s*x+c*y));}
 }
 if(xmin===Infinity)return{x:0,y:0,w:0,h:0};return{x:xmin,y:ymin,w:xmax-xmin,h:ymax-ymin};
}
function makeProject(decoded,base,scale){
 scale=Number(scale);if(!Number.isFinite(scale)||scale<=0||scale>1e6)throw Error('Choose a positive millimetres-per-drawing-unit value.');
 const p=JSON.parse(JSON.stringify(base)),b=bounds(decoded.entities),pad=10;
 const map=p=>({x:(p.x-b.x)*scale+pad,y:(p.y-b.y)*scale+pad});
 const entities=decoded.entities.map((e,i)=>{e=JSON.parse(JSON.stringify(e));e.id='import_'+i+'_'+Date.now().toString(36);
  if(e.type==='line'||e.type==='rect'){const a=map({x:e.x1,y:e.y1}),b=map({x:e.x2,y:e.y2});e.x1=a.x;e.y1=a.y;e.x2=b.x;e.y2=b.y;}
  else if(e.type==='path')e.points=e.points.map(map);
  else if(e.type==='fill')e.loops=e.loops.map(l=>l.map(map));
  else {Object.assign(e,map(e));if(e.r)e.r*=scale;if(e.h)e.h*=scale;}
  return e;
 });
 const width=Math.max(50,b.w*scale+2*pad),height=Math.max(50,b.h*scale+2*pad);
 if(width>1e6||height>1e6)throw Error('Resulting drawing is too large. Check the import units.');
 p.version=3;p.paper={preset:'custom',orientation:width>height?'landscape':'portrait',width,height};p.margin=0;
 // Keep the user's template definition but do not stamp a second title block over imported content.
 p.titleBlock.enabled=false;
 p.pages=[{id:'page_import_'+Date.now().toString(36),title:decoded.report.sourceName.replace(/\.(dwg|dxf|json)$/i,''),number:'',revision:'',entities,frame:false}];
 p.importInfo={...decoded.report,mmPerSourceUnit:scale,sourceOrigin:{x:b.x,y:b.y},translationMm:{x:pad-b.x*scale,y:pad-b.y*scale},modelBoundsSourceUnits:b};
 return p;
}
// A small ASCII DXF front end produces the same typed database used by the DWG adapter.
// Unknown records are kept by type so they can be reported, never silently ignored.
function parseDXF(contents){
 if(contents.startsWith('AutoCAD Binary DXF'))throw Error('Binary DXF is not supported; save as ASCII DXF.');
 const lines=contents.replace(/^\ufeff/,'').split(/\r\n|\n|\r/),pairs=[];
 for(let i=0;i+1<lines.length;i+=2){const c=Number(lines[i].trim());if(!Number.isInteger(c))throw Error('Invalid ASCII DXF group code at line '+(i+1));pairs.push([c,lines[i+1].trim()]);}
 const header={},records=[],blocks=[],layers=[],layouts=[];let section='',currentBlock=null,insert=null,poly=null;
 const get=(a,c,d)=>{const p=a.find(t=>t[0]===c);return p?p[1]:d;},getn=(a,c,d=0)=>number(get(a,c,d),d);
 const pt=(a,c)=>({x:getn(a,c),y:getn(a,c+10),z:getn(a,c+20)});
 function convert(a){
  const type=get(a,0,''),common={type,handle:get(a,5,''),layer:get(a,8,'0'),colorIndex:getn(a,62,256),isVisible:getn(a,60)===0,isInPaperSpace:getn(a,67)===1,lineType:get(a,6,'ByLayer')};
  if(get(a,420)!==undefined)common.color=getn(a,420);
  if(get(a,210)!==undefined)common.extrusionDirection=pt(a,210);
  const pos=()=>pt(a,10);
  switch(type){
   case 'LINE':return{...common,startPoint:pos(),endPoint:pt(a,11)};
   case 'ARC':case 'CIRCLE':return{...common,center:pos(),radius:getn(a,40),startAngle:getn(a,50)/DEG,endAngle:getn(a,51,360)/DEG};
   case 'TEXT':case 'ATTRIB':case 'ATTDEF':{const t={text:get(a,1,''),startPoint:pos(),endPoint:pt(a,11),textHeight:getn(a,40,2.5),rotation:getn(a,50)/DEG,xScale:getn(a,41,1),halign:getn(a,72),valign:getn(a,type==='TEXT'?73:74),generationFlag:getn(a,71),obliqueAngle:getn(a,51)/DEG};return type==='TEXT'?{...common,...t}:{...common,text:t,flags:getn(a,70),tag:get(a,2,'')};}
   case 'MTEXT':return{...common,insertionPoint:pos(),text:a.filter(t=>t[0]===1||t[0]===3).map(t=>t[1]).join(''),textHeight:getn(a,40),rectWidth:getn(a,41),rotation:get(a,50)!==undefined?getn(a,50)/DEG:Math.atan2(getn(a,21),getn(a,11,1)),attachmentPoint:getn(a,71,1),lineSpacing:getn(a,44,1)};
   case 'INSERT':return{...common,name:get(a,2,''),insertionPoint:pos(),xScale:getn(a,41,1),yScale:getn(a,42,1),rotation:getn(a,50)/DEG,rowCount:getn(a,71,1),columnCount:getn(a,70,1),rowSpacing:getn(a,45),columnSpacing:getn(a,44),attribs:[]};
   case 'DIMENSION':return{...common,name:get(a,2,'')};
   case 'LWPOLYLINE':{const vertices=[];let v;for(const [c,s]of a){if(c===10){v={x:number(s),y:0,bulge:0};vertices.push(v);}else if(v&&c===20)v.y=number(s);else if(v&&c===42)v.bulge=number(s);}return{...common,vertices,flag:(getn(a,70)&1)?512:0,constantWidth:getn(a,43)};}
   case 'POLYLINE':return{...common,vertices:[],flag:getn(a,70)};
   case 'VERTEX':return{...pos(),bulge:getn(a,42)};
   case 'ELLIPSE':return{...common,center:pos(),majorAxisEndPoint:pt(a,11),axisRatio:getn(a,40),startAngle:getn(a,41),endAngle:getn(a,42,TAU)};
   case 'SOLID':case 'TRACE':return{...common,corner1:pos(),corner2:pt(a,11),corner3:pt(a,12),corner4:pt(a,13)};
   case 'SPLINE':{const ps=[],knots=[],weights=[];let p;for(const [c,s]of a){if(c===10){p={x:number(s),y:0};ps.push(p);}else if(c===20&&p)p.y=number(s);else if(c===40)knots.push(number(s));else if(c===41)weights.push(number(s));}return{...common,degree:getn(a,71,3),controlPoints:ps,knots,weights,flag:getn(a,70)};}
   case 'HATCH':{const paths=[];for(let j=0;j<a.length;j++)if(a[j][0]===92){const flag=number(a[j][1]),verts=[];let closed=true;if(!(flag&2))return common;let v;for(j++;j<a.length&&a[j][0]!==92&&a[j][0]!==97;j++){const [c,s]=a[j];if(c===73)closed=!!number(s);if(c===10){v={x:number(s),y:0,bulge:0};verts.push(v);}else if(c===20&&v)v.y=number(s);else if(c===42&&v)v.bulge=number(s);}paths.push({vertices:verts,isClosed:closed});j--;}return{...common,solidFill:getn(a,70),boundaryPaths:paths};}
   default:return common;
  }
 }
 for(let i=0;i<pairs.length;){
  const [code,val]=pairs[i];
  if(code===0&&val==='SECTION'){section=pairs[i+1]&&pairs[i+1][1];i+=2;continue;}
  if(code===0&&val==='ENDSEC'){section='';i++;continue;}
  if(section==='HEADER'&&code===9){header[val.replace(/^\$/,'')]=pairs[i+1]?pairs[i+1][1]:'';i+=2;continue;}
  if(code!==0){i++;continue;}
  let j=i+1;while(j<pairs.length&&pairs[j][0]!==0)j++;const a=pairs.slice(i,j);i=j;
  if(section==='TABLES'&&val==='LAYER'){layers.push({name:get(a,2,'0'),colorIndex:getn(a,62,7),off:getn(a,62,7)<0,frozen:!!(getn(a,70)&1),lineType:get(a,6,'Continuous')});continue;}
  if(section==='OBJECTS'&&val==='LAYOUT'){const names=a.filter(t=>t[0]===1);layouts.push({layoutName:names.length?names[names.length-1][1]:'',tabOrder:getn(a,71)});continue;}
  if(section==='BLOCKS'){
   if(val==='BLOCK'){currentBlock={name:get(a,2,''),basePoint:pt(a,10),flags:getn(a,70),entities:[]};blocks.push(currentBlock);insert=null;poly=null;continue;}
   if(val==='ENDBLK'){currentBlock=null;insert=null;poly=null;continue;}
   if(!currentBlock)continue;
  }else if(section!=='ENTITIES')continue;
  const out=currentBlock?currentBlock.entities:records,e=convert(a);
  if(val==='VERTEX'&&poly){poly.vertices.push(e);continue;}
  if(val==='ATTRIB'&&insert){insert.attribs.push(e);continue;}
  if(val==='SEQEND'){insert=null;poly=null;continue;}
  if(val==='INSERT')insert=e;else if(val!=='ATTRIB')insert=null;
  if(val==='POLYLINE')poly=e;else if(val!=='VERTEX')poly=null;
  // Paper-space blocks are not part of the Model entity stream.
  out.push(e);
 }
 const model=blocks.find(b=>/^\*?model_space$/i.test(b.name));
 if(!records.some(e=>!e.isInPaperSpace)&&model)records.push(...model.entities);
 return {header,entities:records,tables:{BLOCK_RECORD:{entries:blocks},LAYER:{entries:layers}},objects:{LAYOUT:layouts}};
}
root.CadImport={decodeDatabase,parseDXF,makeProject,bounds,unitTable,plainText};
if(typeof module!=='undefined'&&module.exports)module.exports=root.CadImport;
})(typeof globalThis!=='undefined'?globalThis:this);
