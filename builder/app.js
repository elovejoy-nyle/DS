
(() => {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";

  const paperPresets = {
    letter: [215.9, 279.4],
    legal: [215.9, 355.6],
    a4: [210.0, 297.0]
  };

  const defaultTitleBlock = () => ([
    {type:"rect", x1:0, y1:0, x2:145, y2:40},
    {type:"line", x1:0, y1:20, x2:145, y2:20},
    {type:"line", x1:0, y1:10, x2:145, y2:10},
    {type:"line", x1:85, y1:0, x2:85, y2:20},
    {type:"text", x:3, y:34, h:2.0, text:"DRAWING TITLE"},
    {type:"variable", x:3, y:25, h:3.5, text:"{TITLE}"},
    {type:"text", x:3, y:16, h:1.8, text:"DRAWING NUMBER"},
    {type:"variable", x:3, y:12, h:2.5, text:"{DRAWING_NUMBER}"},
    {type:"text", x:88, y:16, h:1.8, text:"REVISION"},
    {type:"variable", x:88, y:12, h:2.5, text:"{REVISION}"},
    {type:"text", x:3, y:3.5, h:2.5, text:"SCALE: AS SHOWN"},
    {type:"variable", x:88, y:3.5, h:2.5, text:"Sheet {PAGE} of {PAGECOUNT}"}
  ]);

  const state = {
    version: 1,
    paper: {preset:"letter", orientation:"landscape", width:279.4, height:215.9},
    gap: 10,
    margin: 8,
    titleBlock: {enabled:true, width:145, height:40, entities:defaultTitleBlock()},
    pages: [
      {id:cryptoId(), title:"UNTITLED", number:"DWG-001", revision:"A", entities:[]}
    ],
    selectedPageId: null,
    tool:"select",
    tbTool:"select",
    zoom: 1.0
  };
  state.selectedPageId = state.pages[0].id;

  const el = id => document.getElementById(id);
  const modelSvg = el("modelSvg");
  const tbSvg = el("titleBlockDesigner");

  function cryptoId() {
    return "p_" + Math.random().toString(36).slice(2,10);
  }

  function svgEl(name, attrs={}) {
    const n = document.createElementNS(SVGNS, name);
    for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  }

  function selectedPage() {
    return state.pages.find(p => p.id === state.selectedPageId) || state.pages[0];
  }

  function fmt(n) {
    return Number(n.toFixed(3));
  }

  function replaceVars(text, page, pageIndex) {
    return String(text)
      .replaceAll("{TITLE}", page.title || "")
      .replaceAll("{DRAWING_NUMBER}", page.number || "")
      .replaceAll("{REVISION}", page.revision || "")
      .replaceAll("{PAGE}", String(pageIndex + 1))
      .replaceAll("{PAGECOUNT}", String(state.pages.length));
  }

  function pageOrigin(index) {
    return {x:index * (state.paper.width + state.gap), y:0};
  }

  function updatePaperFromPreset() {
    const preset = state.paper.preset;
    if (preset === "custom") return;
    const [shortSide, longSide] = paperPresets[preset];
    if (state.paper.orientation === "landscape") {
      state.paper.width = longSide;
      state.paper.height = shortSide;
    } else {
      state.paper.width = shortSide;
      state.paper.height = longSide;
    }
  }

  function refreshInputs() {
    document.querySelectorAll('input[name="paper"]').forEach(r => r.checked = r.value === state.paper.preset);
    el("orientation").value = state.paper.orientation;
    el("paperWidth").value = state.paper.width;
    el("paperHeight").value = state.paper.height;
    el("pageGap").value = state.gap;
    el("pageMargin").value = state.margin;
    el("titleBlockEnabled").checked = state.titleBlock.enabled;
    el("tbWidth").value = state.titleBlock.width;
    el("tbHeight").value = state.titleBlock.height;

    const p = selectedPage();
    el("pageTitle").value = p?.title ?? "";
    el("drawingNumber").value = p?.number ?? "";
    el("revision").value = p?.revision ?? "";
  }

  function renderPageList() {
    const host = el("pageList");
    host.innerHTML = "";
    state.pages.forEach((p,i) => {
      const row = document.createElement("div");
      row.className = "page-row" + (p.id === state.selectedPageId ? " active" : "");
      row.innerHTML = `<div><strong>Page ${i+1}</strong><br><small>${escapeHtml(p.title || "UNTITLED")}</small></div>
                       <small>${fmt(pageOrigin(i).x)} mm</small>`;
      row.onclick = () => {
        state.selectedPageId = p.id;
        refreshInputs();
        renderAll();
      };
      host.appendChild(row);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  }

  function renderTitleBlockGroup(page, pageIndex, ox, oy, target) {
    if (!state.titleBlock.enabled) return;
    const tb = state.titleBlock;
    const baseX = ox + state.paper.width - state.margin - tb.width;
    const baseY = oy + state.margin;
    for (const e of tb.entities) {
      if (e.type === "line" || e.type === "rect") {
        if (e.type === "line") {
          target.appendChild(svgEl("line", {x1:baseX+e.x1, y1:baseY+e.y1, x2:baseX+e.x2, y2:baseY+e.y2, class:"tb-line"}));
        } else {
          const x = Math.min(e.x1,e.x2), y = Math.min(e.y1,e.y2);
          const w = Math.abs(e.x2-e.x1), h = Math.abs(e.y2-e.y1);
          target.appendChild(svgEl("rect", {x:baseX+x, y:baseY+y, width:w, height:h, class:"tb-line"}));
        }
      } else if (e.type === "text" || e.type === "variable") {
        const t = svgEl("text", {x:baseX+e.x, y:baseY+e.y, class:"tb-text", "font-size":e.h || 2.5});
        t.textContent = replaceVars(e.text, page, pageIndex);
        target.appendChild(t);
      }
    }
  }

  function renderModelEntity(e, ox, oy, target) {
    if (e.type === "line") {
      target.appendChild(svgEl("line", {x1:ox+e.x1,y1:oy+e.y1,x2:ox+e.x2,y2:oy+e.y2,class:"model-entity"}));
    } else if (e.type === "rect") {
      const x=Math.min(e.x1,e.x2), y=Math.min(e.y1,e.y2);
      target.appendChild(svgEl("rect", {x:ox+x,y:oy+y,width:Math.abs(e.x2-e.x1),height:Math.abs(e.y2-e.y1),class:"model-entity"}));
    } else if (e.type === "text") {
      const t=svgEl("text",{x:ox+e.x,y:oy+e.y,class:"model-text","font-size":e.h||3});
      t.textContent=e.text;
      target.appendChild(t);
    }
  }

  function renderModel() {
    modelSvg.innerHTML = "";
    const pad = 15;
    const totalW = Math.max(state.paper.width, state.pages.length * state.paper.width + Math.max(0,state.pages.length-1)*state.gap);
    const totalH = state.paper.height;
    modelSvg.setAttribute("viewBox", `${-pad} ${-pad} ${totalW+2*pad} ${totalH+2*pad}`);
    modelSvg.style.width = `${Math.max(900,(totalW+30)*state.zoom*3)}px`;
    modelSvg.style.height = `${Math.max(600,(totalH+30)*state.zoom*3)}px`;

    const bg = svgEl("rect",{x:-pad,y:-pad,width:totalW+2*pad,height:totalH+2*pad,fill:"#dfe3e6"});
    modelSvg.appendChild(bg);

    state.pages.forEach((p,i) => {
      const {x:ox,y:oy} = pageOrigin(i);
      const frame = svgEl("rect",{
        x:ox,y:oy,width:state.paper.width,height:state.paper.height,
        class:"page-frame"+(p.id===state.selectedPageId?" page-selected":"")
      });
      modelSvg.appendChild(frame);

      modelSvg.appendChild(svgEl("rect",{
        x:ox+state.margin,y:oy+state.margin,
        width:Math.max(0,state.paper.width-2*state.margin),
        height:Math.max(0,state.paper.height-2*state.margin),
        class:"page-inner"
      }));

      const label=svgEl("text",{x:ox+2,y:oy-3,class:"page-label"});
      label.textContent=`Page ${i+1}: ${p.title || "UNTITLED"}`;
      modelSvg.appendChild(label);

      p.entities.forEach(e => renderModelEntity(e,ox,oy,modelSvg));
      renderTitleBlockGroup(p,i,ox,oy,modelSvg);

      const hit=svgEl("rect",{x:ox,y:oy,width:state.paper.width,height:state.paper.height,class:"preview-hit"});
      hit.dataset.pageId=p.id;
      modelSvg.appendChild(hit);
    });

    el("statusText").textContent =
      `${state.pages.length} page${state.pages.length===1?"":"s"} · ${fmt(state.paper.width)} × ${fmt(state.paper.height)} mm · ${fmt(state.gap)} mm gap`;
  }

  function renderTitleBlockDesigner() {
    tbSvg.innerHTML="";
    const tb=state.titleBlock;
    tbSvg.setAttribute("viewBox",`0 0 ${tb.width} ${tb.height}`);
    tbSvg.appendChild(svgEl("rect",{x:0,y:0,width:tb.width,height:tb.height,fill:"#fff",stroke:"#999","stroke-width":0.25}));

    const fakePage = selectedPage() || {title:"TITLE",number:"DWG-001",revision:"A"};
    const pageIndex = Math.max(0,state.pages.findIndex(p=>p.id===state.selectedPageId));

    for (const e of tb.entities) {
      if (e.type==="line") {
        tbSvg.appendChild(svgEl("line",{x1:e.x1,y1:e.y1,x2:e.x2,y2:e.y2,class:"tb-line"}));
      } else if (e.type==="rect") {
        const x=Math.min(e.x1,e.x2), y=Math.min(e.y1,e.y2);
        tbSvg.appendChild(svgEl("rect",{x,y,width:Math.abs(e.x2-e.x1),height:Math.abs(e.y2-e.y1),class:"tb-line"}));
      } else {
        const t=svgEl("text",{x:e.x,y:e.y,class:"tb-text","font-size":e.h||2.5});
        t.textContent = replaceVars(e.text,fakePage,pageIndex);
        tbSvg.appendChild(t);
      }
    }
  }

  function renderAll() {
    renderPageList();
    renderModel();
    renderTitleBlockDesigner();
    refreshInputs();
  }

  function clientToSvg(svg, evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const m = svg.getScreenCTM();
    return pt.matrixTransform(m.inverse());
  }

  function locatePageAtPoint(pt) {
    for (let i=0;i<state.pages.length;i++) {
      const o=pageOrigin(i);
      if (pt.x>=o.x && pt.x<=o.x+state.paper.width && pt.y>=o.y && pt.y<=o.y+state.paper.height) {
        return {page:state.pages[i], index:i, x:pt.x-o.x, y:pt.y-o.y};
      }
    }
    return null;
  }

  let drawingStart = null;
  modelSvg.addEventListener("mousedown", evt => {
    const pt=clientToSvg(modelSvg,evt);
    const loc=locatePageAtPoint(pt);
    if (!loc) return;
    state.selectedPageId=loc.page.id;

    if (state.tool==="select") {
      refreshInputs(); renderAll(); return;
    }
    if (state.tool==="text") {
      const txt=prompt("Text:");
      if (txt) loc.page.entities.push({type:"text",x:fmt(loc.x),y:fmt(loc.y),h:3,text:txt});
      renderAll();
      return;
    }
    drawingStart={loc};
  });

  modelSvg.addEventListener("mouseup", evt => {
    if (!drawingStart) return;
    const pt=clientToSvg(modelSvg,evt);
    const loc=locatePageAtPoint(pt);
    if (!loc || loc.page.id!==drawingStart.loc.page.id) { drawingStart=null; return; }
    const a=drawingStart.loc, b=loc;
    if (state.tool==="line") a.page.entities.push({type:"line",x1:fmt(a.x),y1:fmt(a.y),x2:fmt(b.x),y2:fmt(b.y)});
    if (state.tool==="rect") a.page.entities.push({type:"rect",x1:fmt(a.x),y1:fmt(a.y),x2:fmt(b.x),y2:fmt(b.y)});
    drawingStart=null;
    renderAll();
  });

  let tbStart=null;
  tbSvg.addEventListener("mousedown", evt => {
    const p=clientToSvg(tbSvg,evt);
    if (state.tbTool==="text") {
      const txt=prompt("Title block text:");
      if (txt) state.titleBlock.entities.push({type:"text",x:fmt(p.x),y:fmt(p.y),h:2.5,text:txt});
      renderAll(); return;
    }
    if (state.tbTool==="variable") {
      state.titleBlock.entities.push({type:"variable",x:fmt(p.x),y:fmt(p.y),h:2.5,text:el("tbVariable").value});
      renderAll(); return;
    }
    if (state.tbTool==="select") return;
    tbStart=p;
  });
  tbSvg.addEventListener("mouseup", evt => {
    if (!tbStart) return;
    const p=clientToSvg(tbSvg,evt);
    if (state.tbTool==="line") state.titleBlock.entities.push({type:"line",x1:fmt(tbStart.x),y1:fmt(tbStart.y),x2:fmt(p.x),y2:fmt(p.y)});
    if (state.tbTool==="rect") state.titleBlock.entities.push({type:"rect",x1:fmt(tbStart.x),y1:fmt(tbStart.y),x2:fmt(p.x),y2:fmt(p.y)});
    tbStart=null; renderAll();
  });

  function downloadText(filename, text, type="text/plain") {
    const blob=new Blob([text],{type});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),500);
  }

  function dxfPair(code, value) {
    return `${code}\n${value}\n`;
  }

  function dxfLine(x1,y1,x2,y2,layer="PAGE") {
    return dxfPair(0,"LINE")+dxfPair(8,layer)+dxfPair(10,fmt(x1))+dxfPair(20,fmt(y1))+dxfPair(30,0)+dxfPair(11,fmt(x2))+dxfPair(21,fmt(y2))+dxfPair(31,0);
  }

  function dxfText(x,y,h,text,layer="PAGE") {
    return dxfPair(0,"TEXT")+dxfPair(8,layer)+dxfPair(10,fmt(x))+dxfPair(20,fmt(y))+dxfPair(30,0)+dxfPair(40,fmt(h))+dxfPair(1,String(text))+dxfPair(7,"STANDARD");
  }

  function dxfRect(x1,y1,x2,y2,layer="PAGE") {
    return dxfLine(x1,y1,x2,y1,layer)+dxfLine(x2,y1,x2,y2,layer)+dxfLine(x2,y2,x1,y2,layer)+dxfLine(x1,y2,x1,y1,layer);
  }

  function buildAsciiDxf() {
    let out="";
    out+=dxfPair(0,"SECTION")+dxfPair(2,"HEADER");
    out+=dxfPair(9,"$ACADVER")+dxfPair(1,"AC1009"); // R12 ASCII, intentionally plain/simple.
    out+=dxfPair(0,"ENDSEC");
    out+=dxfPair(0,"SECTION")+dxfPair(2,"TABLES");
    out+=dxfPair(0,"TABLE")+dxfPair(2,"LAYER")+dxfPair(70,3);
    for (const layer of ["0","PAGE-FRAME","SCHEMATIC"]) {
      out+=dxfPair(0,"LAYER")+dxfPair(2,layer)+dxfPair(70,0)+dxfPair(62,7)+dxfPair(6,"CONTINUOUS");
    }
    out+=dxfPair(0,"ENDTAB")+dxfPair(0,"ENDSEC");
    out+=dxfPair(0,"SECTION")+dxfPair(2,"ENTITIES");

    state.pages.forEach((page,i)=>{
      const o=pageOrigin(i);
      out+=dxfRect(o.x,o.y,o.x+state.paper.width,o.y+state.paper.height,"PAGE-FRAME");
      out+=dxfRect(o.x+state.margin,o.y+state.margin,o.x+state.paper.width-state.margin,o.y+state.paper.height-state.margin,"PAGE-FRAME");
      page.entities.forEach(e=>{
        if (e.type==="line") out+=dxfLine(o.x+e.x1,o.y+e.y1,o.x+e.x2,o.y+e.y2,"SCHEMATIC");
        else if (e.type==="rect") out+=dxfRect(o.x+e.x1,o.y+e.y1,o.x+e.x2,o.y+e.y2,"SCHEMATIC");
        else if (e.type==="text") out+=dxfText(o.x+e.x,o.y+e.y,e.h||3,e.text,"SCHEMATIC");
      });
      if (state.titleBlock.enabled) {
        const tb=state.titleBlock;
        const bx=o.x+state.paper.width-state.margin-tb.width;
        const by=o.y+state.margin;
        tb.entities.forEach(e=>{
          if (e.type==="line") out+=dxfLine(bx+e.x1,by+e.y1,bx+e.x2,by+e.y2,"PAGE-FRAME");
          else if (e.type==="rect") out+=dxfRect(bx+e.x1,by+e.y1,bx+e.x2,by+e.y2,"PAGE-FRAME");
          else out+=dxfText(bx+e.x,by+e.y,e.h||2.5,replaceVars(e.text,page,i),"PAGE-FRAME");
        });
      }
    });

    out+=dxfPair(0,"ENDSEC")+dxfPair(0,"EOF");
    return out;
  }

  function lispString(s) {
    return '"' + String(s).replaceAll("\\","\\\\").replaceAll('"','\\"') + '"';
  }

  function buildLisp() {
    const lines=[];
    lines.push("; Generated by DraftSight Page Builder");
    lines.push("; ASCII only. Load with LoadApplication, then run BUILDWEBPAGES.");
    lines.push("; This creates Model geometry and matching Sheet tabs.");
    lines.push("; Sheet tabs are created by command; Model geometry is authoritative.");
    lines.push("");
    lines.push("(setq wp:oldcmdecho nil)");
    lines.push("(defun wp:line (x1 y1 x2 y2 lay /)");
    lines.push("  (entmake (list '(0 . \"LINE\") (cons 8 lay) (cons 10 (list x1 y1 0.0)) (cons 11 (list x2 y2 0.0)))))");
    lines.push("(defun wp:text (x y h s lay /)");
    lines.push("  (entmake (list '(0 . \"TEXT\") (cons 8 lay) (cons 10 (list x y 0.0)) (cons 40 h) (cons 1 s) '(7 . \"Standard\"))))");
    lines.push("(defun wp:rect (x1 y1 x2 y2 lay /)");
    lines.push("  (wp:line x1 y1 x2 y1 lay) (wp:line x2 y1 x2 y2 lay) (wp:line x2 y2 x1 y2 lay) (wp:line x1 y2 x1 y1 lay))");
    lines.push("(defun wp:layer (name /)");
    lines.push("  (if (not (tblsearch \"LAYER\" name))");
    lines.push("    (entmake (list '(0 . \"LAYER\") '(100 . \"AcDbSymbolTableRecord\") '(100 . \"AcDbLayerTableRecord\") (cons 2 name) '(70 . 0) '(62 . 7) '(6 . \"Continuous\")))))");
    lines.push("");
    lines.push("(defun c:BUILDWEBPAGES (/ *error*)");
    lines.push("  (setq wp:oldcmdecho (getvar \"CMDECHO\"))");
    lines.push("  (defun *error* (msg) (if wp:oldcmdecho (setvar \"CMDECHO\" wp:oldcmdecho)) (princ (strcat \"\\nBUILDWEBPAGES stopped: \" msg)) (princ))");
    lines.push("  (setvar \"CMDECHO\" 0)");
    lines.push("  (wp:layer \"PAGE-FRAME\") (wp:layer \"SCHEMATIC\")");
    lines.push("  (setvar \"TILEMODE\" 1)");
    lines.push("  (setvar \"CTAB\" \"Model\")");

    state.pages.forEach((page,i)=>{
      const o=pageOrigin(i);
      lines.push(`  ; Page ${i+1}: ${page.title.replace(/[^\x20-\x7E]/g,"")}`);
      lines.push(`  (wp:rect ${fmt(o.x)} ${fmt(o.y)} ${fmt(o.x+state.paper.width)} ${fmt(o.y+state.paper.height)} "PAGE-FRAME")`);
      lines.push(`  (wp:rect ${fmt(o.x+state.margin)} ${fmt(o.y+state.margin)} ${fmt(o.x+state.paper.width-state.margin)} ${fmt(o.y+state.paper.height-state.margin)} "PAGE-FRAME")`);
      page.entities.forEach(e=>{
        if (e.type==="line") lines.push(`  (wp:line ${fmt(o.x+e.x1)} ${fmt(o.y+e.y1)} ${fmt(o.x+e.x2)} ${fmt(o.y+e.y2)} "SCHEMATIC")`);
        else if (e.type==="rect") lines.push(`  (wp:rect ${fmt(o.x+e.x1)} ${fmt(o.y+e.y1)} ${fmt(o.x+e.x2)} ${fmt(o.y+e.y2)} "SCHEMATIC")`);
        else if (e.type==="text") lines.push(`  (wp:text ${fmt(o.x+e.x)} ${fmt(o.y+e.y)} ${fmt(e.h||3)} ${lispString(e.text)} "SCHEMATIC")`);
      });
      if (state.titleBlock.enabled) {
        const tb=state.titleBlock, bx=o.x+state.paper.width-state.margin-tb.width, by=o.y+state.margin;
        tb.entities.forEach(e=>{
          if (e.type==="line") lines.push(`  (wp:line ${fmt(bx+e.x1)} ${fmt(by+e.y1)} ${fmt(bx+e.x2)} ${fmt(by+e.y2)} "PAGE-FRAME")`);
          else if (e.type==="rect") lines.push(`  (wp:rect ${fmt(bx+e.x1)} ${fmt(by+e.y1)} ${fmt(bx+e.x2)} ${fmt(by+e.y2)} "PAGE-FRAME")`);
          else lines.push(`  (wp:text ${fmt(bx+e.x)} ${fmt(by+e.y)} ${fmt(e.h||2.5)} ${lispString(replaceVars(e.text,page,i))} "PAGE-FRAME")`);
        });
      }
    });

    lines.push("  ; Create matching Sheet tabs. Viewport fitting remains a DraftSight-side operation.");
    lines.push("  ; The generated pages are all in Model, side-by-side at the configured gap.");
    state.pages.forEach((page,i)=>{
      const name = `Page-${i+1}`;
      lines.push(`  (if (not (member (strcase ${lispString(name)}) (mapcar '(lambda (x) (strcase (cadr x))) (wp:layouts))))`);
      lines.push(`    (command "_Sheet" "_New" ${lispString(name)}))`);
    });
    lines.push("  (setvar \"TILEMODE\" 1)");
    lines.push("  (setvar \"CTAB\" \"Model\")");
    lines.push("  (setvar \"CMDECHO\" wp:oldcmdecho)");
    lines.push(`  (princ ${lispString("\\nCreated Model geometry and "+state.pages.length+" matching Sheet tab(s).")})`);
    lines.push("  (princ \"\\nNext step in DraftSight: create one viewport per Sheet aimed at its Model page.\")");
    lines.push("  (princ))");
    lines.push("");
    lines.push("; Helper used only for tab existence checks.");
    lines.push("(defun wp:insert-order (item items)");
    lines.push("  (cond ((null items) (list item)) ((< (car item) (caar items)) (cons item items)) (T (cons (car items) (wp:insert-order item (cdr items))))))");
    lines.push("(defun wp:sort (items / result item) (foreach item items (setq result (wp:insert-order item result))) result)");
    lines.push("(defun wp:layouts (/ d row result)");
    lines.push("  (setq d (cdr (assoc -1 (dictsearch (namedobjdict) \"ACAD_LAYOUT\"))))");
    lines.push("  (if d (progn (setq row (dictnext d T)) (while row (if (and (assoc 1 row) (assoc 71 row) (> (cdr (assoc 71 row)) 0)) (setq result (cons (list (cdr (assoc 71 row)) (cdr (assoc 1 row))) result))) (setq row (dictnext d)))))");
    lines.push("  (tp:dummy))");
    # Fix helper reference and simple return after assembly.
    text="\n".join(lines)
    text=text.replace("  (tp:dummy))","  (wp:sort result))")
    text += "\n\n(princ \"\\nLoaded: BUILDWEBPAGES\")\n(princ)\n"
    return text;

  function exportSvg() {
    const clone=modelSvg.cloneNode(true);
    clone.removeAttribute("style");
    const serializer=new XMLSerializer();
    downloadText("draftsight_model_preview.svg",serializer.serializeToString(clone),"image/svg+xml");
  }

  el("addPageBtn").onclick=()=>{
    const n=state.pages.length+1;
    const p={id:cryptoId(),title:`PAGE ${n}`,number:`DWG-${String(n).padStart(3,"0")}`,revision:"A",entities:[]};
    state.pages.push(p); state.selectedPageId=p.id; renderAll();
  };
  el("deletePageBtn").onclick=()=>{
    if (state.pages.length<=1) { alert("Keep at least one page."); return; }
    const i=state.pages.findIndex(p=>p.id===state.selectedPageId);
    state.pages.splice(i,1);
    state.selectedPageId=state.pages[Math.max(0,i-1)].id;
    renderAll();
  };

  document.querySelectorAll('input[name="paper"]').forEach(r=>r.onchange=()=>{
    state.paper.preset=r.value;
    updatePaperFromPreset();
    refreshInputs(); renderAll();
  });
  el("orientation").onchange=()=>{
    state.paper.orientation=el("orientation").value;
    updatePaperFromPreset(); refreshInputs(); renderAll();
  };
  el("paperWidth").oninput=()=>{ state.paper.preset="custom"; state.paper.width=Math.max(1,+el("paperWidth").value||1); renderAll(); };
  el("paperHeight").oninput=()=>{ state.paper.preset="custom"; state.paper.height=Math.max(1,+el("paperHeight").value||1); renderAll(); };
  el("pageGap").oninput=()=>{ state.gap=Math.max(0,+el("pageGap").value||0); renderAll(); };
  el("pageMargin").oninput=()=>{ state.margin=Math.max(0,+el("pageMargin").value||0); renderAll(); };

  el("pageTitle").oninput=()=>{ selectedPage().title=el("pageTitle").value; renderPageList(); renderModel(); renderTitleBlockDesigner(); };
  el("drawingNumber").oninput=()=>{ selectedPage().number=el("drawingNumber").value; renderModel(); renderTitleBlockDesigner(); };
  el("revision").oninput=()=>{ selectedPage().revision=el("revision").value; renderModel(); renderTitleBlockDesigner(); };

  document.querySelectorAll(".tool").forEach(b=>b.onclick=()=>{
    state.tool=b.dataset.tool;
    document.querySelectorAll(".tool").forEach(x=>x.classList.toggle("active",x===b));
  });
  document.querySelectorAll(".tbtool").forEach(b=>b.onclick=()=>{
    state.tbTool=b.dataset.tbtool;
    document.querySelectorAll(".tbtool").forEach(x=>x.classList.toggle("active",x===b));
  });

  el("titleBlockEnabled").onchange=()=>{state.titleBlock.enabled=el("titleBlockEnabled").checked;renderAll();};
  el("tbWidth").oninput=()=>{state.titleBlock.width=Math.max(1,+el("tbWidth").value||1);renderAll();};
  el("tbHeight").oninput=()=>{state.titleBlock.height=Math.max(1,+el("tbHeight").value||1);renderAll();};
  el("resetTitleBlockBtn").onclick=()=>{state.titleBlock.width=145;state.titleBlock.height=40;state.titleBlock.entities=defaultTitleBlock();renderAll();};
  el("clearTitleBlockBtn").onclick=()=>{state.titleBlock.entities=[];renderAll();};

  el("saveProjectBtn").onclick=()=>downloadText("draftsight-page-project.json",JSON.stringify(state,null,2),"application/json");
  el("loadProjectInput").onchange=async evt=>{
    const f=evt.target.files[0]; if(!f)return;
    try {
      const loaded=JSON.parse(await f.text());
      Object.assign(state,loaded);
      if (!state.selectedPageId || !state.pages.some(p=>p.id===state.selectedPageId)) state.selectedPageId=state.pages[0]?.id;
      renderAll();
    } catch(e) { alert("Could not load project JSON: "+e.message); }
    evt.target.value="";
  };

  el("exportDxfBtn").onclick=()=>downloadText("draftsight_model_pages.dxf",buildAsciiDxf(),"application/dxf");
  el("exportLispBtn").onclick=()=>downloadText("build_draftsight_pages.lsp",buildLisp(),"text/plain");
  el("exportSvgBtn").onclick=exportSvg;

  el("fitBtn").onclick=()=>{state.zoom=1;renderModel();el("modelViewport").scrollTo(0,0);};
  el("zoomInBtn").onclick=()=>{state.zoom=Math.min(5,state.zoom*1.25);renderModel();};
  el("zoomOutBtn").onclick=()=>{state.zoom=Math.max(.25,state.zoom/1.25);renderModel();};

  renderAll();
})();
