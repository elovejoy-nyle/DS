
/* Page Builder browser UI. Pointer events support both click-click and drag drawing. */
(function () {
 'use strict';
 const C=window.PageBuilderCore, $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
 if(!C) { $('bootError').textContent='Could not load core.js. Use the single-file HTML or keep the source files together.'; return; }
 const canvas=$('canvas'), STORE='draftsight-page-builder-v3-import-beta';
 let project=C.newProject(), selectedPageId=project.pages[0].id;
 let mode='model',tool='select',selection=null,pending=null,pointer=null,moving=null,spaceDown=false;
 let camera={x:-15,y:-230,w:310,h:240}, undo=[],redo=[],timer=null,backupTimer=null;
 let grid=true,snap=true,step=1,restored=false,viewInitialized=false;
 const measureCanvas=document.createElement('canvas'),measure=measureCanvas.getContext('2d');
 try { const saved=localStorage.getItem(STORE); if(saved){project=C.validateProject(JSON.parse(saved));selectedPageId=project.pages[0].id;restored=true;} } catch (_) { /* Browser storage is optional, including for file:// usage. */ }
 const page=()=>project.pages.find(p=>p.id===selectedPageId)||project.pages[0];
 const pageIndex=()=>project.pages.indexOf(page());
 function el(name,attrs={},value) {
  const node=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,String(v)));if(value!==undefined)node.textContent=value;return node;
 }
 function toast(msg,error=false) {
  clearTimeout(timer);$('toast').textContent=msg;$('toast').classList.toggle('error',error);$('toast').hidden=false;
  timer=setTimeout(()=>$('toast').hidden=true,error?9000:4500);
 }
 function backup() {
  clearTimeout(backupTimer);backupTimer=setTimeout(()=>{
   try {localStorage.setItem(STORE,JSON.stringify(project));$('saveStatus').textContent='Browser backup saved';}
   catch(_){$('saveStatus').textContent='Use Save project to keep your work';}
  },180);
 }
 function change(fn,fitAfter=false) {
  const before=JSON.stringify(project);
  try {fn();} catch(e){project=JSON.parse(before);toast(e.message,true);render();return false;}
  if(before!==JSON.stringify(project)){undo.push(before);if(undo.length>80)undo.shift();redo=[];backup();}
  if(fitAfter)fit(false);render();return true;
 }
 function history(direction) {
  const from=direction==='undo'?undo:redo,to=direction==='undo'?redo:undo;
  if(!from.length)return;
  to.push(JSON.stringify(project));project=JSON.parse(from.pop());
  if(!project.pages.some(p=>p.id===selectedPageId))selectedPageId=project.pages[0].id;
  selection=null;pending=null;moving=null;pointer=null;backup();fit(false);render();
 }
 function setInput(id,val){const n=$(id);if(document.activeElement!==n)n.value=val;}
 function snapValue(n){return C.num(snap?Math.round(n/step)*step:n);}
 function localPoint(target,world,clamp=true){
  let x=snapValue(world.x-target.ox),y=snapValue(world.y);
  if(clamp){x=Math.max(0,Math.min(target.width,x));y=Math.max(0,Math.min(target.height,y));}
  return {x:C.num(x),y:C.num(y)};
 }
 function targetAt(world) {
  if(mode==='title')return world.x>=0&&world.x<=project.titleBlock.width&&world.y>=0&&world.y<=project.titleBlock.height?
   {scope:'title',id:null,ox:0,width:project.titleBlock.width,height:project.titleBlock.height}:null;
  const pages=mode==='sheet'?[page()]:project.pages;
  for(const p of pages) {
   const i=project.pages.indexOf(p),ox=mode==='model'?C.origin(project,i).x:0;
   if(world.x>=ox&&world.x<=ox+project.paper.width&&world.y>=0&&world.y<=project.paper.height)
    return {scope:'page',id:p.id,ox,width:project.paper.width,height:project.paper.height};
  }
  return null;
 }
 function listFor(s){return s.scope==='title'?project.titleBlock.entities:(project.pages.find(p=>p.id===s.id)||page()).entities;}
 function selectedEntity(){return selection?listFor(selection).find(e=>e.id===selection.entityId):null;}
 function bounds() {
  if(mode==='title')return {x:0,y:0,w:project.titleBlock.width,h:project.titleBlock.height};
  return {x:0,y:0,w:mode==='sheet'?project.paper.width:project.pages.length*project.paper.width+(project.pages.length-1)*project.gap,h:project.paper.height};
 }
 function fit(draw=true) {
  const b=bounds(),r=canvas.getBoundingClientRect(),aspect=Math.max(0.25,r.width/Math.max(1,r.height));
  let w=b.w+Math.min(30,b.w*.12),h=b.h+Math.min(30,b.h*.25);
  if(w/h<aspect)w=h*aspect;else h=w/aspect;
  camera={x:b.x+b.w/2-w/2,y:-b.y-b.h/2-h/2,w,h};
  viewInitialized=true;
  if(draw)renderCanvas();
 }
 function zoom(factor,anchor=null) {
  const r=canvas.getBoundingClientRect(),a=anchor||{x:camera.x+camera.w/2,y:camera.y+camera.h/2};
  const newW=Math.max(10,Math.min(1e7,camera.w*factor)),f=newW/camera.w;
  camera={x:a.x-(a.x-camera.x)*f,y:a.y-(a.y-camera.y)*f,w:newW,h:camera.h*f};
  renderCanvas();
 }
 function toWorld(evt) {
  const p=canvas.createSVGPoint();p.x=evt.clientX;p.y=evt.clientY;
  const matrix=canvas.getScreenCTM();if(!matrix)return {x:0,y:0};
  const q=p.matrixTransform(matrix.inverse());return {x:q.x,y:-q.y};
 }
 function pixelSize(){return camera.w/Math.max(1,canvas.getBoundingClientRect().width);}
 function textWidth(e,value){measure.font='100px Arial';return measure.measureText(value===undefined?e.text:value).width*e.h*C.TEXT_EM/100;}
 function entityBounds(e) {
  if(e.type==='line'||e.type==='rect')return {x:Math.min(e.x1,e.x2),y:Math.min(e.y1,e.y2),w:Math.abs(e.x2-e.x1),h:Math.abs(e.y2-e.y1)};
  if(e.type==='circle'||e.type==='arc')return {x:e.x-e.r,y:e.y-e.r,w:2*e.r,h:2*e.r};
  if(e.type==='path'||e.type==='fill'||e.type==='text'&&(e.angle||e.halign||e.valign||e.widthFactor&&e.widthFactor!==1))return window.CadImport.bounds([e]);
   const value=e.literal?e.text:C.vars(e.text,page(),pageIndex(),project.pages.length);return {x:e.x,y:e.y-e.h*.25,w:textWidth(e,value),h:e.h*1.2};
 }
 function distanceToLine(p,e) {
  const dx=e.x2-e.x1,dy=e.y2-e.y1,denom=dx*dx+dy*dy;
  const t=denom?Math.max(0,Math.min(1,((p.x-e.x1)*dx+(p.y-e.y1)*dy)/denom)):0;
  return Math.hypot(p.x-e.x1-t*dx,p.y-e.y1-t*dy);
 }
 function hit(target,point) {
  const entities=listFor(target),tol=pixelSize()*6;
  for(let i=entities.length-1;i>=0;i--) {
   const e=entities[i],b=entityBounds(e);
   if(e.type==='line'&&distanceToLine(point,e)<=tol)return e;
   if(e.type==='circle'&&Math.abs(Math.hypot(point.x-e.x,point.y-e.y)-e.r)<=tol)return e;
   if(e.type==='rect'&&point.x>=b.x-tol&&point.x<=b.x+b.w+tol&&point.y>=b.y-tol&&point.y<=b.y+b.h+tol&&
    (Math.abs(point.x-b.x)<=tol||Math.abs(point.x-b.x-b.w)<=tol||Math.abs(point.y-b.y)<=tol||Math.abs(point.y-b.y-b.h)<=tol))return e;
    if(e.type==='arc') {
      const a=Math.atan2(point.y-e.y,point.x-e.x)*180/Math.PI,d=((e.end-e.start)%360+360)%360,t=((a-e.start)%360+360)%360;
      if(Math.abs(Math.hypot(point.x-e.x,point.y-e.y)-e.r)<=tol&&t<=d+1)return e;
    }
    if(e.type==='path'||e.type==='fill') {
      const loops=e.type==='path'?[e.points]:e.loops;
      for(const l of loops)for(let j=0;j<l.length-((e.closed||e.type==='fill')?0:1);j++){
        const a=l[j],b=l[(j+1)%l.length];if(distanceToLine(point,{x1:a.x,y1:a.y,x2:b.x,y2:b.y})<=tol)return e;
      }
      if(e.type==='fill') {
        let inside=false;
        for(const l of loops)for(let j=0,k=l.length-1;j<l.length;k=j++)if((l[j].y>point.y)!==(l[k].y>point.y)&&point.x<(l[k].x-l[j].x)*(point.y-l[j].y)/(l[k].y-l[j].y)+l[j].x)inside=!inside;
        if(inside)return e;
      }
    }
   if(e.type==='text'&&point.x>=b.x-tol&&point.x<=b.x+b.w+tol&&point.y>=b.y-tol&&point.y<=b.y+b.h+tol)return e;
  }
  return null;
 }
 function renderEntity(parent,e,ox=0,settings={}) {
  const color=settings.selected?'#136fcc':settings.preview?'#136fcc':(settings.color||C.ink(e));
  const attrs={stroke:color,'stroke-width':settings.selected||settings.preview?Math.max(.3,pixelSize()*1.6):.3,fill:'none','pointer-events':'none'};
  if(settings.preview)attrs['stroke-dasharray']=`${pixelSize()*5} ${pixelSize()*3}`;
  let node;
  if(e.type==='line')node=el('line',{...attrs,x1:e.x1+ox,y1:-e.y1,x2:e.x2+ox,y2:-e.y2});
  else if(e.type==='rect')node=el('rect',{...attrs,x:ox+Math.min(e.x1,e.x2),y:-Math.max(e.y1,e.y2),width:Math.abs(e.x2-e.x1),height:Math.abs(e.y2-e.y1)});
  else if(e.type==='circle')node=el('circle',{...attrs,cx:ox+e.x,cy:-e.y,r:e.r});
  else if(['arc','path','fill'].includes(e.type))node=el('path',{...attrs,d:C.shapePath(C.moved(e,ox,0)),fill:e.type==='fill'?color:'none','fill-rule':'evenodd','stroke-width':e.type==='fill'?0:attrs['stroke-width']});
   else node=el('text',{transform:`translate(${ox+e.x} ${-e.y}) rotate(${-C.finite(e.angle,0)}) scale(${C.finite(e.widthFactor,1)} 1)`,x:0,y:C.textYOffset(e),'text-anchor':e.halign===1?'middle':e.halign===2?'end':'start','font-size':e.h*C.TEXT_EM,'font-family':'Arial, sans-serif',fill:color,'pointer-events':'none'},settings.resolved===undefined?e.text:settings.resolved);
  node.dataset.entityId=e.id;parent.appendChild(node);
  if(settings.selected) {
   const b=entityBounds(e),pad=pixelSize()*3;
   parent.appendChild(el('rect',{x:ox+b.x-pad,y:-b.y-b.h-pad,width:b.w+2*pad,height:b.h+2*pad,stroke:'#3282d5','stroke-width':pixelSize(),fill:'none','stroke-dasharray':`${pixelSize()*3} ${pixelSize()*3}`,'pointer-events':'none'}));
  }
 }
 function draftEntity(p) {
  let end={...p.end};const start=p.start;
  if(p.shift&&p.type==='line'){
   if(Math.abs(end.x-start.x)>Math.abs(end.y-start.y))end.y=start.y;else end.x=start.x;
  }
  if(p.shift&&p.type==='rect') {
   const size=Math.min(Math.max(Math.abs(end.x-start.x),Math.abs(end.y-start.y)),
    end.x>=start.x?p.target.width-start.x:start.x,end.y>=start.y?p.target.height-start.y:start.y);
   end.x=start.x+(end.x>=start.x?size:-size);end.y=start.y+(end.y>=start.y?size:-size);
  }
  if(p.type==='circle')return {id:'preview',type:'circle',x:start.x,y:start.y,r:C.num(Math.hypot(end.x-start.x,end.y-start.y))};
  return {id:'preview',type:p.type,x1:start.x,y1:start.y,x2:C.num(end.x),y2:C.num(end.y)};
 }
 function renderCanvas() {
  canvas.setAttribute('viewBox',`${camera.x} ${camera.y} ${camera.w} ${camera.h}`);
  canvas.dataset.tool=tool;canvas.dataset.panning=String(!!(pointer&&pointer.type==='pan'));
  canvas.replaceChildren();
  const defs=el('defs'),scene=el('g',{id:'drawing-scene'}),overlay=el('g',{id:'drawing-overlay'});
  canvas.append(defs,scene,overlay);
  function drawGrid(x,w,h,id){
   if(!grid)return;
   let pitch=step;while(pitch/pixelSize()<10)pitch*=5;
   const pattern=el('pattern',{id,x,y:0,width:pitch,height:pitch,patternUnits:'userSpaceOnUse'});
   pattern.appendChild(el('circle',{cx:0,cy:0,r:pixelSize()*.65,fill:'#d1dae5'}));defs.appendChild(pattern);
   scene.appendChild(el('rect',{x,y:-h,width:w,height:h,fill:`url(#${id})`,'pointer-events':'none'}));
  }
  function showEditable(entities,target,ox) {
   entities.forEach(e=>{
    const selected=selection&&selection.scope===target.scope&&selection.id===target.id&&selection.entityId===e.id;
    const displayed=selected&&moving?C.moved(e,moving.dx,moving.dy):e;
    const resolved=e.type==='text'?(e.literal?e.text:C.vars(e.text,target.scope==='title'?page():project.pages.find(p=>p.id===target.id),target.scope==='title'?pageIndex():project.pages.findIndex(p=>p.id===target.id),project.pages.length)):undefined;
    renderEntity(scene,displayed,ox,{selected,resolved});
   });
  }
  if(mode==='title') {
   const tb=project.titleBlock;
   scene.appendChild(el('rect',{x:0,y:-tb.height,width:tb.width,height:tb.height,fill:'#fff',stroke:'#93a5ba','stroke-width':pixelSize()}));
   drawGrid(0,tb.width,tb.height,'template-grid');showEditable(tb.entities,{scope:'title',id:null},0);
   scene.appendChild(el('text',{x:0,y:-tb.height-pixelSize()*9,'font-size':pixelSize()*12,fill:'#566a80'},'Shared title block template - lower-left origin; variables preview the selected page'));
  } else {
   const pages=mode==='sheet'?[page()]:project.pages;
   pages.forEach(p=>{
    const i=project.pages.indexOf(p),x=mode==='model'?C.origin(project,i).x:0,W=project.paper.width,H=project.paper.height,m=project.margin;
    scene.appendChild(el('rect',{x:x+pixelSize()*3,y:-H+pixelSize()*3,width:W,height:H,fill:'#283c5215'}));
    scene.appendChild(el('rect',{x,y:-H,width:W,height:H,fill:'#fff',stroke:p.id===selectedPageId?'#4682bd':'#92a3b6','stroke-width':pixelSize()*(p.id===selectedPageId?1.5:1)}));
    drawGrid(x,W,H,'grid-'+i);
    if(p.frame!==false)renderEntity(scene,{id:'border-'+i,type:'rect',x1:m,y1:m,x2:W-m,y2:H-m},x,{color:'#526173'});
    showEditable(p.entities,{scope:'page',id:p.id},x);
    if(project.titleBlock.enabled){
     const bx=x+W-m-project.titleBlock.width;
     project.titleBlock.entities.forEach(e=>renderEntity(scene,C.moved(e,0,m),bx,{resolved:e.type==='text'?C.vars(e.text,p,i,project.pages.length):undefined}));
    }
    scene.appendChild(el('text',{x,y:-H-pixelSize()*8,'font-size':pixelSize()*12,fill:'#435c75'},`Page ${i+1} - ${p.title || 'UNTITLED'}`));
   });
  }
  if(pending) {
   const e=draftEntity(pending);renderEntity(overlay,e,pending.target.ox,{preview:true});
   overlay.appendChild(el('circle',{cx:pending.target.ox+pending.start.x,cy:-pending.start.y,r:pixelSize()*3,fill:'#1463bc'}));
  }
 }
 function inspector() {
  const e=selectedEntity();$('inspector').hidden=!e;if(!e)return;
  $('selectionName').textContent='Selected '+(e.type==='rect'?'rectangle':e.type);
  // Do not replace an active coordinate input while the user is typing.
  if(!$('geometryFields').contains(document.activeElement)) {
   const fields=$('geometryFields');fields.replaceChildren();
   const keys=e.type==='line'||e.type==='rect'?['x1','y1','x2','y2']:e.type==='circle'?['x','y','r']:e.type==='arc'?['x','y','r','start','end']:e.type==='path'||e.type==='fill'?[]:['x','y','h','angle','widthFactor'];
   if(!keys.length){const note=document.createElement('p');note.className='hint';note.textContent='Imported '+e.type+'. Drag to move; Duplicate and Delete are available. Individual vertices are not edited in this version.';fields.appendChild(note);}
   keys.forEach(key=>{
    const label=document.createElement('label');label.textContent=({r:'Radius',h:'Text height'}[key]||key.toUpperCase())+(['angle','start','end'].includes(key)?' (degrees)':key==='widthFactor'?'':' (mm)');
    const input=document.createElement('input');input.type='number';input.step='0.1';input.value=C.num(e[key]===undefined?(key==='widthFactor'?1:0):e[key]);input.dataset.coordinate=key;
    input.onchange=()=>{
     const n=Number(input.value);
     if(!Number.isFinite(n)||(key==='h'||key==='r'||key==='widthFactor')&&n<=0){toast('Enter a valid '+key+' value.',true);input.value=e[key];return;}
     change(()=>{const s=selectedEntity();if(s)s[key]=n;});
    };
    label.appendChild(input);fields.appendChild(label);
   });
  }
  $('selectedTextLabel').hidden=e.type!=='text';if(e.type==='text')setInput('selectedText',e.text);
 }
 function renderUI() {
  if(!pending)$('coordinates').textContent=$('coordinates').textContent.replace(' - click to finish','');
  $('pageCount').textContent=project.pages.length;
  const host=$('pageList'),scroll=host.scrollTop;host.replaceChildren();
  project.pages.forEach((p,i)=>{
   const row=document.createElement('button');row.className='page-row'+(p.id===selectedPageId?' active':'');row.dataset.pageId=p.id;
   const n=document.createElement('span');n.className='page-number';n.textContent=i+1;
   const title=document.createElement('span');title.className='page-name';title.textContent=p.title||'UNTITLED';
   const x=document.createElement('small');x.textContent=C.origin(project,i).x+' mm';row.append(n,title,x);
   row.onclick=()=>{selectedPageId=p.id;selection=null;pending=null;if(mode==='sheet')fit(false);render();};host.appendChild(row);
  });host.scrollTop=scroll;
  setInput('pageTitle',page().title);setInput('drawingNumber',page().number);setInput('revision',page().revision);
  setInput('orientation',project.paper.orientation);setInput('width',project.paper.width);setInput('height',project.paper.height);setInput('gap',project.gap);setInput('margin',project.margin);
  document.querySelectorAll('input[name=paper]').forEach(r=>r.checked=r.value===project.paper.preset);
  setInput('tbWidth',project.titleBlock.width);setInput('tbHeight',project.titleBlock.height);$('tbEnabled').checked=project.titleBlock.enabled;
  const i=pageIndex();$('pageLeftBtn').disabled=i===0;$('pageRightBtn').disabled=i===project.pages.length-1;$('deletePageBtn').disabled=project.pages.length===1;
  $('undoBtn').disabled=!undo.length;$('redoBtn').disabled=!redo.length;
  document.querySelectorAll('[data-tool]').forEach(b=>{if(b.tagName==='BUTTON')b.classList.toggle('active',b.dataset.tool===tool);});
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  $('textOptions').hidden=tool!=='text';
  const instructions={select:'Click an object to select it. Drag to move it. Delete removes it. Edit coordinates in the left panel.',
   line:'Line: click a start point, then an end point. Drag works too. Hold Shift for horizontal / vertical. Esc cancels.',
   rect:'Rectangle: click two opposite corners, or drag. Hold Shift for a square. Esc cancels.',
   circle:'Circle: click the centre, then a point on the circle, or drag. Esc cancels.',
   text:'Text: enter the text above, then click where its lower-left baseline should go. Variables are allowed.',
   pan:'Drag to move the view. Mouse wheel zooms. Middle-button drag or Space + drag also pans.'};
  $('toolHint').textContent=instructions[tool];
  const count=mode==='title'?project.titleBlock.entities.length:page().entities.length;
  $('entityCount').textContent=count+(mode==='title'?' template objects':' drawing objects on page '+(pageIndex()+1));
  inspector();
  if($('importReportBtn'))$('importReportBtn').hidden=!project.importInfo;
 }
 function render(){renderUI();renderCanvas();}
 function cancel(){pending=null;moving=null;pointer=null;tool='select';render();}
 function setTool(name){pending=null;moving=null;pointer=null;tool=name;render();}
 function finishShape(){
  if(!pending)return;const p=pending,e=draftEntity(p);
  if(e.type==='circle'&&e.r<1e-6||e.type==='line'&&Math.hypot(e.x2-e.x1,e.y2-e.y1)<1e-6||e.type==='rect'&&(Math.abs(e.x2-e.x1)<1e-6||Math.abs(e.y2-e.y1)<1e-6)){
   toast('Choose a different end point.');return;
  }
  e.id=C.uid();pending=null;change(()=>{listFor(p.target).push(e);selection=null;});
 }
 function release(evt){try{if(canvas.hasPointerCapture(evt.pointerId))canvas.releasePointerCapture(evt.pointerId);}catch(_){}}
 canvas.addEventListener('pointerdown',evt=>{
  if(evt.button!==0&&evt.button!==1)return;
  evt.preventDefault();canvas.focus({preventScroll:true});
  try{canvas.setPointerCapture(evt.pointerId);}catch(_){}
  const world=toWorld(evt);
  if(evt.button===1||tool==='pan'||spaceDown){pointer={type:'pan',x:evt.clientX,y:evt.clientY,camera:{...camera}};renderCanvas();return;}
  if(pending) {
   pending.end=localPoint(pending.target,world);pending.shift=evt.shiftKey;
   pointer={type:'draw',second:true,x:evt.clientX,y:evt.clientY};renderCanvas();return;
  }
  const target=targetAt(world);
  if(!target){selection=null;render();release(evt);return;}
  if(target.scope==='page')selectedPageId=target.id;
  const point=localPoint(target,world);
  if(tool==='select') {
   const found=hit(target,{x:world.x-target.ox,y:world.y});
   selection=found?{scope:target.scope,id:target.id,entityId:found.id}:null;
   if(found){moving={target,entityId:found.id,original:C.clone(found),start:world,dx:0,dy:0};pointer={type:'move',x:evt.clientX,y:evt.clientY};}
   render();return;
  }
  if(tool==='text') {
   const value=C.text($('newText').value),h=Number($('newTextHeight').value);
   if(!value.trim()||!Number.isFinite(h)||h<=0){toast('Enter text and a positive text height first.',true);release(evt);return;}
   const e=C.entity('text',{x:point.x,y:point.y,h,text:value});
   change(()=>{listFor(target).push(e);selection={scope:target.scope,id:target.id,entityId:e.id};tool='select';});
   release(evt);return;
  }
  pending={type:tool,start:point,end:point,target,shift:evt.shiftKey};pointer={type:'draw',second:false,x:evt.clientX,y:evt.clientY};render();
 });
 canvas.addEventListener('pointermove',evt=>{
  const world=toWorld(evt);
  if(pointer&&pointer.type==='pan'){
   const r=canvas.getBoundingClientRect();camera={...pointer.camera,x:pointer.camera.x-(evt.clientX-pointer.x)*pointer.camera.w/r.width,y:pointer.camera.y-(evt.clientY-pointer.y)*pointer.camera.h/r.height};renderCanvas();return;
  }
  if(moving&&pointer&&pointer.type==='move'){
   moving.dx=snapValue(world.x-moving.start.x);moving.dy=snapValue(world.y-moving.start.y);renderCanvas();
  }
  if(pending){pending.end=localPoint(pending.target,world);pending.shift=evt.shiftKey;renderCanvas();}
  const t=pending?pending.target:targetAt(world);
  if(t){const q=localPoint(t,world,false);$('coordinates').textContent=(t.scope==='title'?'Template':('Page '+(project.pages.findIndex(p=>p.id===t.id)+1)))+`: X ${q.x.toFixed(2)}   Y ${q.y.toFixed(2)} mm`+(pending?' - click to finish':'');}
 });
 canvas.addEventListener('pointerup',evt=>{
  if(!pointer){release(evt);return;}
  const p=pointer;pointer=null;
  if(p.type==='move'&&moving){
   const m=moving;moving=null;
   if(m.dx||m.dy)change(()=>{const arr=listFor(m.target),index=arr.findIndex(e=>e.id===m.entityId);if(index>=0)arr[index]=C.moved(m.original,m.dx,m.dy);});
   else render();
  } else if(p.type==='draw'&&pending){
   pending.end=localPoint(pending.target,toWorld(evt));pending.shift=evt.shiftKey;
   if(p.second||Math.hypot(evt.clientX-p.x,evt.clientY-p.y)>4)finishShape();else renderCanvas();
  }else renderCanvas();
  release(evt);
 });
 canvas.addEventListener('pointercancel',evt=>{pointer=null;pending=null;moving=null;release(evt);renderCanvas();});
 canvas.addEventListener('contextmenu',evt=>{evt.preventDefault();cancel();});
 canvas.addEventListener('wheel',evt=>{evt.preventDefault();const p=toWorld(evt);zoom(Math.exp(Math.max(-300,Math.min(300,evt.deltaY))*.0015),{x:p.x,y:-p.y});},{passive:false});
 document.querySelectorAll('button[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
 document.querySelectorAll('button[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;selection=null;pending=null;moving=null;pointer=null;fit(false);render();});
 $('fitBtn').onclick=()=>fit();$('zoomInBtn').onclick=()=>zoom(.8);$('zoomOutBtn').onclick=()=>zoom(1.25);
 $('undoBtn').onclick=()=>history('undo');$('redoBtn').onclick=()=>history('redo');$('cancelBtn').onclick=cancel;
 $('gridEnabled').onchange=()=>{grid=$('gridEnabled').checked;renderCanvas();};
 $('snapEnabled').onchange=()=>{snap=$('snapEnabled').checked;};
 $('snapStep').onchange=()=>{const n=Number($('snapStep').value);if(n>0&&n<=100)step=n;else $('snapStep').value=step;renderCanvas();};
 $('variable').onchange=()=>{const v=$('variable').value;if(!v)return;const input=$('newText');input.value=input.value==='Note'?v:input.value+v;$('variable').value='';};
 function deleteSelected(){if(!selectedEntity())return;change(()=>{const arr=listFor(selection),i=arr.findIndex(e=>e.id===selection.entityId);if(i>=0)arr.splice(i,1);selection=null;});}
 function duplicateSelected(){const e=selectedEntity();if(!e)return;change(()=>{const copy=C.moved(e,2,2);copy.id=C.uid();listFor(selection).push(copy);selection.entityId=copy.id;});}
 $('deleteEntityBtn').onclick=deleteSelected;$('duplicateEntityBtn').onclick=duplicateSelected;$('deselectBtn').onclick=()=>{selection=null;render();};
 $('selectedText').oninput=()=>{const value=$('selectedText').value;change(()=>{const e=selectedEntity();if(e)e.text=C.text(value);});};
 document.addEventListener('keydown',evt=>{
  const tag=evt.target.tagName,typing=['INPUT','TEXTAREA','SELECT'].includes(tag)||evt.target.isContentEditable;
  if(evt.key==='Escape'){evt.preventDefault();cancel();return;}
  if(typing)return;
  if((evt.ctrlKey||evt.metaKey)&&evt.key.toLowerCase()==='z'){evt.preventDefault();history(evt.shiftKey?'redo':'undo');return;}
  if((evt.ctrlKey||evt.metaKey)&&evt.key.toLowerCase()==='y'){evt.preventDefault();history('redo');return;}
  if((evt.ctrlKey||evt.metaKey)&&evt.key.toLowerCase()==='s'){evt.preventDefault();saveProject();return;}
  if((evt.ctrlKey||evt.metaKey)&&evt.key.toLowerCase()==='d'){evt.preventDefault();duplicateSelected();return;}
  if(evt.key==='Delete'||evt.key==='Backspace'){evt.preventDefault();deleteSelected();return;}
  if(evt.code==='Space'){evt.preventDefault();spaceDown=true;return;}
  if(!evt.ctrlKey&&!evt.metaKey&&!evt.altKey){const shortcuts={v:'select',l:'line',r:'rect',c:'circle',t:'text',h:'pan'};const name=shortcuts[evt.key.toLowerCase()];if(name){evt.preventDefault();setTool(name);}}
 });
 document.addEventListener('keyup',evt=>{if(evt.code==='Space')spaceDown=false;});
 window.addEventListener('blur',()=>{spaceDown=false;pointer=null;moving=null;});
 $('addPageBtn').onclick=()=>change(()=>{
  if(project.pages.length>=200)throw Error('Maximum 200 pages.');
  const p=C.newPage(project.pages.length+1);p.number=page().number;p.revision=page().revision;project.pages.push(p);selectedPageId=p.id;selection=null;pending=null;
 },true);
 $('deletePageBtn').onclick=()=>{
  if(project.pages.length<=1)return;
  if(!confirm('Delete this page and its drawing objects? Undo can restore it.'))return;
  change(()=>{const i=pageIndex();project.pages.splice(i,1);selectedPageId=project.pages[Math.max(0,i-1)].id;selection=null;pending=null;},true);
 };
 $('duplicatePageBtn').onclick=()=>change(()=>{
  if(project.pages.length>=200)throw Error('Maximum 200 pages.');
  const p=C.clone(page());p.id=C.uid();p.title+=' (copy)';p.entities.forEach(e=>e.id=C.uid());project.pages.splice(pageIndex()+1,0,p);selectedPageId=p.id;selection=null;pending=null;
 },true);
 function reorder(delta){change(()=>{const i=pageIndex(),j=i+delta;if(j<0||j>=project.pages.length)return;[project.pages[i],project.pages[j]]=[project.pages[j],project.pages[i]];pending=null;},true);}
 $('pageLeftBtn').onclick=()=>reorder(-1);$('pageRightBtn').onclick=()=>reorder(1);
 [['pageTitle','title'],['drawingNumber','number'],['revision','revision']].forEach(([id,key])=>$(id).oninput=()=>{const val=$(id).value;change(()=>page()[key]=C.text(val));});
 function preset(){const sides=C.presets[project.paper.preset];if(!sides)return;[project.paper.width,project.paper.height]=project.paper.orientation==='landscape'?[sides[1],sides[0]]:sides;}
 function validNumber(id,min,max){const n=Number($(id).value);if(!Number.isFinite(n)||n<min||n>max)throw Error(id+' must be between '+min+' and '+C.num(max)+'.');return n;}
 function pageSizeChanged(){
  if(project.titleBlock.enabled&&(project.titleBlock.width>project.paper.width-2*project.margin||project.titleBlock.height>project.paper.height-2*project.margin))toast('The title block is larger than the page interior. Resize the template or switch it off.',true);
 }
 document.querySelectorAll('input[name=paper]').forEach(r=>r.onchange=()=>{change(()=>{project.paper.preset=r.value;preset();pending=null;},true);pageSizeChanged();});
 $('orientation').onchange=()=>{change(()=>{
  const previous=project.paper.orientation;project.paper.orientation=$('orientation').value;
  if(project.paper.preset==='custom'&&previous!==project.paper.orientation)[project.paper.width,project.paper.height]=[project.paper.height,project.paper.width];else preset();pending=null;
 },true);pageSizeChanged();};
 ['width','height'].forEach(id=>$(id).onchange=()=>{
  change(()=>{project.paper[id]=validNumber(id,50,1000000);project.paper.preset='custom';pending=null;},true);pageSizeChanged();
 });
 $('gap').onchange=()=>change(()=>{project.gap=validNumber('gap',0,5000);pending=null;},true);
 $('margin').onchange=()=>{change(()=>{project.margin=validNumber('margin',0,Math.min(project.paper.width,project.paper.height)/2-.1);pending=null;});pageSizeChanged();};
 $('tbEnabled').onchange=()=>change(()=>project.titleBlock.enabled=$('tbEnabled').checked);
 $('editTbBtn').onclick=()=>{mode='title';pending=null;selection=null;fit(false);render();};
 ['tbWidth','tbHeight'].forEach(id=>$(id).onchange=()=>{
  change(()=>{
   const tb=project.titleBlock,key=id==='tbWidth'?'width':'height',value=validNumber(id,1,5000),sx=key==='width'?value/tb.width:1,sy=key==='height'?value/tb.height:1;
   tb.entities.forEach(e=>{if(e.type==='path'){e.points.forEach(p=>{p.x*=sx;p.y*=sy;});}else if(e.type==='fill'){e.loops.forEach(l=>l.forEach(p=>{p.x*=sx;p.y*=sy;}));}else if(e.type==='line'||e.type==='rect'){e.x1*=sx;e.x2*=sx;e.y1*=sy;e.y2*=sy;}else{e.x*=sx;e.y*=sy;if(e.type==='circle'||e.type==='arc')e.r*=Math.min(sx,sy);else e.h*=Math.min(sx,sy);}});
   tb[key]=value;pending=null;
  },true);pageSizeChanged();
 });
 $('resetTbBtn').onclick=()=>{if(!confirm('Replace the shared title block with the default template?'))return;change(()=>{project.titleBlock={enabled:true,width:145,height:40,entities:C.defaults()};selection=null;pending=null;},true);};
 $('clearTbBtn').onclick=()=>{if(!confirm('Remove all objects from the shared title block? Undo can restore them.'))return;change(()=>{project.titleBlock.entities=[];selection=null;pending=null;});};
 function download(filename,contents,type='text/plain') {
  const url=URL.createObjectURL(new Blob([contents],{type})),a=document.createElement('a');a.href=url;a.download=filename;a.hidden=true;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }
 function saveProject(){download('page-builder-project.json',JSON.stringify(project,null,2),'application/json');toast('Project JSON saved. Open it here to continue editing.');}
 function exportFile(type) {
  if(pending){toast('Finish or cancel the current shape before exporting.',true);return;}
  try {
   if(type==='dxf'){download('model-and-sheets.dxf',C.dxf(project),'application/dxf');toast('DXF exported: '+project.pages.length+' model pages with linked Sheet viewports.');}
   else if(type==='svg'){download('model-pages.svg',C.svg(project),'image/svg+xml');toast('SVG exported with embedded drawing styles.');}
   else {download('model-only-fallback.lsp',C.lisp(project));toast('Model-only LISP saved. Load it in an empty test drawing, then run BUILDWEBPAGES.');}
  } catch(e){toast('Export failed: '+e.message,true);}
 }
 $('saveBtn').onclick=saveProject;$('dxfBtn').onclick=()=>exportFile('dxf');$('svgBtn').onclick=()=>exportFile('svg');$('lispBtn').onclick=()=>exportFile('lisp');
 $('loadBtn').onclick=()=>$('loadInput').click();
 function replaceProject(p){change(()=>{project=p;selectedPageId=p.pages[0].id;selection=null;pending=null;moving=null;pointer=null;mode='model';tool='select';},true);}
 $('loadInput').onchange=async evt=>{
  const f=evt.target.files[0];if(!f)return;
  try {if(f.size>15*1024*1024)throw Error('Project exceeds 15 MB.');const p=C.validateProject(JSON.parse(await f.text()));replaceProject(p);toast('Project opened.');}
  catch(e){toast('Could not open project: '+e.message,true);}evt.target.value='';
 };
 $('newBtn').onclick=()=>{if(confirm('Start a new project? Save project first to keep a file copy. Undo can restore this session.'))replaceProject(C.newProject());};
 $('sampleBtn').onclick=()=>{
  if(project.pages.some(p=>p.entities.length)&&!confirm('Replace this project with the sample? Save first to keep a file copy. Undo can restore it.'))return;
  replaceProject(C.sampleProject());toast('Two sample pages loaded. The first contains an exactly 100 mm line.');
 };
 const observer=new ResizeObserver(()=>{
  if(!viewInitialized)fit(false);
  else {const r=canvas.getBoundingClientRect();const h=camera.w*Math.max(1,r.height)/Math.max(1,r.width);camera.y+=(camera.h-h)/2;camera.h=h;}
  renderCanvas();
 });observer.observe($('stage'));
 window.addEventListener('error',evt=>{if(evt.message){$('bootError').hidden=false;$('bootError').textContent='Drawing engine error: '+evt.message;}});
 window.PageBuilder=Object.freeze({loadImported:p=>replaceProject(C.validateProject(p)),getProject:()=>C.clone(project),getView:()=>({mode,tool,camera:{...camera},pending:!!pending,selectedPageId}),exportDXF:()=>C.dxf(project)});
 fit(false);render();$('bootError').hidden=true;
 if(restored)toast('Restored the last browser backup. Save project for a portable JSON copy.');
})();

