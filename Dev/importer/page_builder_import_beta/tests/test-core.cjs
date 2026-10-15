const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.dirname(__dirname),C=require(root+'/source/core.js'),I=require(root+'/source/cad-import.js');
let passed=0;const check=(name,fn)=>{fn();console.log('PASS',name);passed++;};
const near=(a,b,t=1e-7)=>assert(Math.abs(a-b)<t,`${a} != ${b}`);
function fixture(){return {
 header:{INSUNITS:4},tables:{LAYER:{entries:[{name:'0',colorIndex:7},{name:'WIRE',colorIndex:1},{name:'HIDDEN',off:true}]},BLOCK_RECORD:{entries:[
  {name:'CONTACT',basePoint:{x:5,y:5},entities:[{type:'LINE',startPoint:{x:5,y:5},endPoint:{x:15,y:5},layer:'0'},{type:'CIRCLE',center:{x:10,y:10},radius:2}]},
  {name:'NESTED',basePoint:{x:0,y:0},entities:[{type:'INSERT',name:'CONTACT',insertionPoint:{x:10,y:0},rotation:0,xScale:1,yScale:1}]}
 ]}},objects:{LAYOUT:[{layoutName:'Model'},{layoutName:'CONTROL POWER'},{layoutName:'ANALOG + COMS'}]},entities:[
 {type:'LINE',handle:'10',layer:'WIRE',startPoint:{x:0,y:0},endPoint:{x:100,y:0}},
 {type:'INSERT',name:'CONTACT',handle:'11',layer:'WIRE',insertionPoint:{x:40,y:40},rotation:Math.PI/2,xScale:2,yScale:2,attribs:[{type:'ATTRIB',handle:'12',tag:'NAME',text:{text:'K1',startPoint:{x:50,y:60},textHeight:2.5,rotation:0,halign:0,valign:0}}]},
 {type:'INSERT',name:'NESTED',handle:'13',layer:'WIRE',insertionPoint:{x:60,y:10},rotation:0,xScale:1,yScale:1},
 {type:'ARC',center:{x:100,y:50},radius:10,startAngle:0,endAngle:Math.PI},
 {type:'LWPOLYLINE',flag:512,vertices:[{x:10,y:10,bulge:0},{x:20,y:10,bulge:0},{x:20,y:20,bulge:0},{x:10,y:20,bulge:0}]},
 {type:'LWPOLYLINE',flag:0,vertices:[{x:20,y:70,bulge:1},{x:40,y:70,bulge:0}]},
 {type:'TEXT',text:'ROTATED',startPoint:{x:140,y:30},endPoint:{x:140,y:30},textHeight:3,rotation:Math.PI/2,xScale:0.8,halign:1,valign:2},
 {type:'TEXT',text:'Literal {PAGE}',startPoint:{x:10,y:90},textHeight:3},
 {type:'MTEXT',text:'first\\Psecond',insertionPoint:{x:80,y:85},textHeight:3,rotation:0,attachmentPoint:1,lineSpacing:1},
 {type:'SOLID',corner1:{x:5,y:40},corner2:{x:15,y:40},corner3:{x:5,y:50},corner4:{x:15,y:50}},
 {type:'HATCH',solidFill:1,boundaryPaths:[{vertices:[{x:20,y:40},{x:30,y:40},{x:30,y:50},{x:20,y:50}]}]},
 {type:'TEXT',layer:'HIDDEN',text:'hidden',startPoint:{x:1,y:1},textHeight:2},
 {type:'UNKNOWN_ELECTRICAL_OBJECT',handle:'bad'},
 {type:'LINE',isInPaperSpace:true,startPoint:{x:0,y:0},endPoint:{x:1000,y:1000}}
 ]};}
check('portrait and customized default retained',()=>{const p=C.newProject();assert.equal(p.paper.orientation,'portrait');assert.equal(p.paper.width,215.9);assert(p.titleBlock.entities.some(e=>e.text==='PRODUCTION START DATE'));});
let decoded=I.decodeDatabase(fixture(),{name:'synthetic-fixture.dwg'});
check('DWG database adapter expands nested blocks with base points, rotation and scaling',()=>{const lines=decoded.entities.filter(e=>e.type==='line');near(lines[1].x1,40);near(lines[1].y1,40);near(lines[1].x2,40);near(lines[1].y2,60);near(lines[2].x1,70);near(lines[2].x2,80);});
check('instance attributes are not transformed twice',()=>{const e=decoded.entities.find(e=>e.text==='K1');near(e.x,50);near(e.y,60);});
check('arc and bulge directions retained',()=>{const arcs=decoded.entities.filter(e=>e.type==='arc');assert.equal(arcs.length,2);near(arcs[0].start,0);near(arcs[0].end,180);near(arcs[1].x,30);near(arcs[1].y,70);near(arcs[1].r,10);});
check('unknown and hidden objects reported',()=>{assert.equal(decoded.report.skipped['Unsupported UNKNOWN_ELECTRICAL_OBJECT'],1);assert.equal(decoded.report.skipped['Entities on off/frozen layers'],1);assert.equal(decoded.report.skipped['Paper-space entities (Model import only)'],1);});
check('hidden-layer option includes hidden geometry',()=>{assert(I.decodeDatabase(fixture(),{includeHidden:true}).entities.some(e=>e.text==='hidden'));});
check('units required when unspecified',()=>{const db=fixture();db.header={};assert.equal(I.decodeDatabase(db).report.suggestedScale,null);assert.throws(()=>I.makeProject(decoded,C.newProject(),0));});
check('Model block ownership excludes paper-space text even without paper flags',()=>{const db=fixture(),model=[db.entities[0]],paper=[{type:'TEXT',handle:'P1',ownerBlockRecordSoftId:'P',text:'DO NOT STACK',startPoint:{x:0,y:0},textHeight:3}];db.tables.BLOCK_RECORD.entries.push({name:'*Model_Space',handle:'M',entities:model},{name:'*Paper_Space',handle:'P',entities:paper});db.entities=[...model,...paper];const d=I.decodeDatabase(db);assert.equal(d.entities.length,1);assert(!d.entities.some(e=>e.text==='DO NOT STACK'));});
check('Repeated nested block attributes remain present in every instance',()=>{const db=fixture();db.entities=[{type:'INSERT',name:'TAGGED',insertionPoint:{x:0,y:0}},{type:'INSERT',name:'TAGGED',insertionPoint:{x:100,y:0}}];db.tables.BLOCK_RECORD.entries.push({name:'TAGGED',basePoint:{x:0,y:0},entities:[{type:'INSERT',name:'CONTACT',insertionPoint:{x:0,y:0},attribs:[{type:'ATTRIB',handle:'SAME',text:{text:'TAG',startPoint:{x:10,y:10},textHeight:3}}]}]});const a=I.decodeDatabase(db).entities.filter(e=>e.text==='TAG');assert.equal(a.length,2);near(a[1].x-a[0].x,100);});
check('Upstream POLYLINE2D naming is supported',()=>{const db=fixture();db.entities=[{type:'POLYLINE2D',flag:1,vertices:[{x:0,y:0},{x:20,y:0},{x:20,y:20}]}];const d=I.decodeDatabase(db);assert.equal(d.entities[0].type,'path');assert.equal(d.entities[0].closed,true);});
check('MTEXT direction vector controls rotation',()=>{const db=fixture();db.entities=[{type:'MTEXT',text:'vertical',insertionPoint:{x:0,y:0},textHeight:3,direction:{x:0,y:1},rotation:0,attachmentPoint:1}];near(I.decodeDatabase(db).entities[0].angle,90);});
let p=I.makeProject(decoded,C.newProject(),1);
check('import keeps old template but does not overlay it',()=>{assert.equal(p.titleBlock.enabled,false);assert.deepEqual(p.titleBlock.entities.map(e=>e.text),C.newProject().titleBlock.entities.map(e=>e.text));assert.equal(p.pages.length,1);assert.equal(p.pages[0].frame,false);});
check('unit conversion preserves line length',()=>{const q=I.makeProject(decoded,C.newProject(),25.4),line=q.pages[0].entities[0];near(Math.hypot(line.x2-line.x1,line.y2-line.y1),2540);});
check('JSON validation preserves rotation, source metadata and literal text',()=>{p=C.validateProject(p);const t=p.pages[0].entities.find(e=>e.text==='ROTATED');assert.equal(t.angle,90);assert.equal(t.halign,1);assert.equal(t.valign,2);assert.equal(t.widthFactor,.8);assert.equal(p.importInfo.sourceName,'synthetic-fixture.dwg');assert(C.scene(p).some(e=>e.text==='Literal {PAGE}'));});
check('full title-block data fields survive save/load',()=>{const q=C.newProject();q.pages[0].drawnBy='TEST';q.pages[0].model='E180';q.pages[0].scale='NTS';const r=C.validateProject(q);assert.equal(r.pages[0].drawnBy,'TEST');assert.equal(r.pages[0].model,'E180');});
check('DXF has native arcs, polylines, fills and rotated text',()=>{const d=C.dxf(p);assert(d.includes('\nARC\n'));assert(d.includes('\nLWPOLYLINE\n'));assert(d.includes('\nHATCH\n'));assert(d.includes('ROTATED'));fs.writeFileSync(root+'/tests/fixture-export.dxf',d);});
check('SVG and extended entity translations work',()=>{assert(C.svg(p).includes('rotate(-90)'));const e=p.pages[0].entities.find(e=>e.type==='path'),m=C.moved(e,10,20);near(m.points[0].x,e.points[0].x+10);near(m.points[0].y,e.points[0].y+20);});
check('LISP refuses unsupported shapes instead of silently dropping them',()=>assert.throws(()=>C.lisp(p),/Use DXF/));
check('ASCII DXF real-file import passes',()=>{const db=I.parseDXF(fs.readFileSync(root+'/tests/test-input.dxf','utf8'));const d=I.decodeDatabase(db,{name:'Page Builder two-page DXF test'});assert(d.entities.length>60);assert.equal(d.report.suggestedScale,1);const q=C.validateProject(I.makeProject(d,C.newProject(),1));fs.writeFileSync(root+'/tests/dxf-import-project.json',JSON.stringify(q,null,2));fs.writeFileSync(root+'/tests/dxf-import-export.dxf',C.dxf(q));});
check('ASCII DXF roundtrip preserves supported primitive counts',()=>{const data=I.decodeDatabase(I.parseDXF(C.dxf(p)));for(const type of ['arc','circle','fill'])assert.equal(data.entities.filter(e=>e.type===type).length,p.pages[0].entities.filter(e=>e.type===type).length,type);});
fs.writeFileSync(root+'/tests/fixture-decoder-database.json',JSON.stringify({database:fixture()},null,2));fs.writeFileSync(root+'/tests/fixture-project.json',JSON.stringify(p,null,2));fs.writeFileSync(root+'/tests/fixture-preview.svg',C.svg(p));
console.log('TOTAL',passed,'passed. Actual DWG binary decoding NOT executed.');
