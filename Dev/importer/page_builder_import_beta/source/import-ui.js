/* Import UI. The editor and JSON/DXF import work offline.
 * DWG decoding fetches the pinned LibreDWG-Web module and WASM from jsDelivr.
 * Only decoder code is downloaded. The drawing ArrayBuffer stays in a local Worker.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id),C=window.PageBuilderCore,I=window.CadImport;
const modal=$('cadImportDialog');
let worker=null,workerUrl=null,decoded=null,rawDatabase=null,readyProject=null,timer=null,reading=false;
const version='0.7.17',base='https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@'+version;
function download(name,value){const s=typeof value==='string'?value:JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2);const url=URL.createObjectURL(new Blob([s],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function stop(){clearTimeout(timer);if(worker)worker.terminate();if(workerUrl)URL.revokeObjectURL(workerUrl);worker=null;workerUrl=null;reading=false;$('cadReadBtn').disabled=false;}
function status(message,error=false){$('cadStatus').textContent=message;$('cadStatus').classList.toggle('error',error);}
function open(){decoded=null;rawDatabase=null;readyProject=null;$('cadPreview').replaceChildren();$('cadDetails').textContent='';$('cadAcceptBtn').disabled=true;$('cadSaveJsonBtn').disabled=true;$('cadDiagnosticBtn').disabled=true;$('cadConfirmed').checked=false;$('cadUnitBox').hidden=true;status('Choose a file, then click Read drawing. Your current project stays open until you accept the preview.');modal.showModal();}
function workerMain(){
 const safe=v=>{try{return typeof v==='string'?v:JSON.stringify(v);}catch(_){return String(v);}};
 self.onmessage=async evt=>{
  let db=null,lib=null,ptr=null;const warnings=[];
  const oldWarn=console.warn;console.warn=(...a)=>{warnings.push(a.map(safe).join(' '));oldWarn(...a);};
  const send=(type,data)=>self.postMessage({type,...data});
  try{
   const {kind,buffer,name,includeHidden,decoderBase}=evt.data;
   if(kind==='dwg'){
    send('progress',{message:'Downloading the DWG decoder. Your drawing is not uploaded.'});
    const module=await import(decoderBase+'/dist/libredwg-web.js');
    if(!module.LibreDwg)throw Error('The downloaded decoder does not expose LibreDwg.');
    lib=await module.LibreDwg.create(decoderBase+'/wasm');
    send('progress',{message:'Decoding DWG locally in this browser...'});
    ptr=lib.dwg_read_data(buffer,module.Dwg_File_Type?module.Dwg_File_Type.DWG:0);
    if(!ptr)throw Error('The DWG decoder did not return a drawing.');
    const result=typeof lib.convertEx==='function'?lib.convertEx(ptr):{database:lib.convert(ptr),stats:{}};
    db=result.database;send('progress',{message:'Translating drawing geometry...'});
    const data=self.CadImport.decodeDatabase(db,{name,includeHidden,stats:result.stats});
    data.report.decoder='LibreDWG-Web '+evt.data.decoderVersion;
    data.report.decoderWarnings=warnings;
    send('complete',{data,database:db});
   }else{
    const s=new TextDecoder().decode(buffer);
    if(kind==='dxf')db=self.CadImport.parseDXF(s);
    else {const j=JSON.parse(s);db=j.database||j;}
    const data=self.CadImport.decodeDatabase(db,{name,includeHidden});
    data.report.decoder=kind==='dxf'?'Built-in ASCII DXF reader':'Previously decoded DWG database';
    send('complete',{data,database:db});
   }
  }catch(err){send('failed',{message:err.message||String(err),database:db,warnings});}
  finally {if(lib&&ptr)try{lib.dwg_free(ptr);}catch(_){} }
 };
}
async function read(){
 const f=$('cadFile').files[0];if(!f){status('Choose a DWG or ASCII DXF file first.',true);return;}
 if(f.size>40*1024*1024){status('This beta limits imports to 40 MB. Your current project has not changed.',true);return;}
 stop();decoded=null;rawDatabase=null;readyProject=null;reading=true;$('cadReadBtn').disabled=true;$('cadAcceptBtn').disabled=true;$('cadSaveJsonBtn').disabled=true;$('cadConfirmed').checked=false;$('cadDiagnosticBtn').disabled=true;$('cadPreview').replaceChildren();$('cadDetails').textContent='';$('cadUnitBox').hidden=true;
 const kind=/\.dwg$/i.test(f.name)?'dwg':/\.dxf$/i.test(f.name)?'dxf':/\.json$/i.test(f.name)?'json':null;
 if(!kind){stop();status('Choose .dwg, .dxf, or a decoded database .json.',true);return;}
 try{
  const buffer=await f.arrayBuffer();
  if(kind==='dwg'&&!/^AC10\d\d/.test(new TextDecoder().decode(buffer.slice(0,6))))throw Error('This file does not have a supported DWG header.');
  const adapter=$('cad-import-adapter').textContent;
  workerUrl=URL.createObjectURL(new Blob([adapter,'\n('+workerMain.toString()+')();'],{type:'text/javascript'}));
  worker=new Worker(workerUrl);
  worker.onmessage=evt=>{
   const msg=evt.data;
   if(msg.type==='progress'){status(msg.message);return;}
   if(msg.type==='failed'){
    rawDatabase=msg.database||null;$('cadDiagnosticBtn').disabled=!rawDatabase;stop();
    status('Import stopped: '+msg.message+' Your current project was not changed.',true);
    $('cadDetails').textContent='For DWG, the decoder requires Internet access to cdn.jsdelivr.net. A company filter can block it. The normal editor still works without it. This beta has not been end-to-end tested with the supplied E180 DWG.';
    return;
   }
   if(msg.type==='complete'){
    decoded=msg.data;rawDatabase=msg.database;$('cadDiagnosticBtn').disabled=false;stop();
    const scale=decoded.report.suggestedScale;$('cadUnitBox').hidden=false;$('cadUnits').value=scale===null?'':String(scale);
    if(!$('cadUnits').value&&scale!==null){$('cadUnits').value='custom';$('cadCustomScale').value=scale;}
    $('cadCustomScaleBox').hidden=$('cadUnits').value!=='custom';
    $('cadUnitNote').textContent='Drawing units reported by the file: '+decoded.report.unitName+'. Unknown units must be chosen explicitly.';
    preview();
   }
  };
  worker.onerror=evt=>{stop();status('Import worker failed: '+(evt.message||'browser could not start the decoder')+'. Your project is unchanged.',true);};
  timer=setTimeout(()=>{stop();status('Import timed out after 90 seconds. Check Internet access for the DWG decoder. Your project is unchanged.',true);},90000);
  worker.postMessage({kind,buffer,name:f.name,includeHidden:$('cadHidden').checked,decoderBase:base,decoderVersion:version},[buffer]);
  status(kind==='dwg'?'Starting DWG reader...':'Reading drawing locally...');
 }catch(err){stop();status(err.message,true);}
}
function reportText(r){
 const section=(label,obj)=>Object.keys(obj||{}).length?'\n'+label+'\n'+Object.entries(obj).map(([k,v])=>'  '+v+' - '+k).join('\n'):'\n'+label+'\n  None reported';
 return 'Source: '+r.sourceName+'\nDecoder: '+r.decoder+'\nTop-level Model objects: '+r.decodedModelEntities+'\nEditable objects after expansion: '+r.importedObjects+
 '\nDetected layout names: '+((r.layoutNames||[]).join(', ')||'(none)')+section('Source entity types',r.sourceEntityTypes)+section('Skipped / excluded',r.skipped)+section('Simplified / expanded',r.approximated)+
 '\n\nDecoder statistics\n'+JSON.stringify(r.decoderStats||{},null,2)+((r.decoderWarnings||[]).length?'\nDecoder warnings\n'+r.decoderWarnings.join('\n'):'')+
 '\n\nImport scope\n'+(r.notes||[]).map(s=>'  '+s).join('\n');
}
function preview(){
 if(!decoded)return;
 $('cadDetails').textContent=reportText(decoded.report);
 const value=$('cadUnits').value,scale=value==='custom'?Number($('cadCustomScale').value):Number(value);
 if(!value||!(scale>0)){readyProject=null;$('cadAcceptBtn').disabled=true;$('cadSaveJsonBtn').disabled=true;status('The file does not specify usable units. Select the drawing units to generate the preview.',true);return;}
 try{
  readyProject=I.makeProject(decoded,window.PageBuilder.getProject(),scale);
  readyProject=C.validateProject(readyProject);
  const svg=C.svg(readyProject);$('cadPreview').innerHTML=svg;
  const s=$('cadPreview').querySelector('svg');s.setAttribute('width','100%');s.setAttribute('height','340');
  $('cadSize').textContent='Imported drawing: '+readyProject.paper.width.toFixed(2)+' x '+readyProject.paper.height.toFixed(2)+' mm, including a 10 mm blank margin. No fit-to-page rescaling.';
  $('cadSaveJsonBtn').disabled=false;$('cadAcceptBtn').disabled=!$('cadConfirmed').checked;
  status('Preview ready. Review the drawing and import report before accepting.');
 }catch(err){readyProject=null;$('cadAcceptBtn').disabled=true;$('cadSaveJsonBtn').disabled=true;status('Cannot prepare the drawing: '+err.message,true);}
}
$('importCadBtn').onclick=open;
$('cadReadBtn').onclick=read;
$('cadCloseBtn').onclick=()=>{stop();modal.close();};
modal.addEventListener('cancel',()=>stop());
$('cadUnits').onchange=()=>{$('cadCustomScaleBox').hidden=$('cadUnits').value!=='custom';preview();};$('cadCustomScale').onchange=preview;
$('cadConfirmed').onchange=()=>{$('cadAcceptBtn').disabled=!readyProject||!$('cadConfirmed').checked;};
$('cadAcceptBtn').onclick=()=>{
 if(!readyProject||!$('cadConfirmed').checked)return;
 try{window.PageBuilder.loadImported(readyProject);modal.close();}catch(e){status('The drawing was not loaded: '+e.message,true);}
};
$('cadSaveJsonBtn').onclick=()=>{if(readyProject)download('imported-drawing.page-builder.json',readyProject);};
$('cadDiagnosticBtn').onclick=()=>{if(rawDatabase)download('decoded-drawing.database.json',{database:rawDatabase,report:decoded&&decoded.report});};
$('importReportBtn').onclick=()=>{const info=window.PageBuilder.getProject().importInfo;if(info)download('drawing-import-report.json',info);};
})();
