; DraftSight drawing sheets and title blocks. ASCII only.
; Load with LoadApplication. Commands: ADDPAGE, TITLEBLOCK, UPDATEPAGES, PAGECOUNT.
; Geometry is in millimetres: US Letter landscape, plotted at 1:1 in mm.
; Change width/height BEFORE creating sheets; existing geometry is not resized.
; Counts only paper-space sheets carrying this script's PAGE marker.
; Native tab changes require UPDATEPAGES. ADDPAGE updates automatically.
; No ActiveX, reactors, or external libraries.

(setq tp:width 279.4 tp:height 215.9 tp:margin 8.0)
(setq tp:app "SENS_TITLE_PAGES_V1")

(defun tp:fail (msg)
  (princ (strcat "\n" msg))
  (exit))

(defun tp:layer ()
  (if (not (tblsearch "LAYER" "TITLE-PAGES"))
    (entmake (list '(0 . "LAYER") '(100 . "AcDbSymbolTableRecord")
                   '(100 . "AcDbLayerTableRecord") '(2 . "TITLE-PAGES")
                   '(70 . 0) '(62 . 7) '(6 . "Continuous"))))
  (regapp tp:app))

(defun tp:space ()
  (list '(67 . 1) (cons 410 (getvar "CTAB"))))

(defun tp:line (x1 y1 x2 y2)
  (if (not (entmake
    (append (list '(0 . "LINE") '(8 . "TITLE-PAGES")
                  (cons 10 (list x1 y1 0.0)) (cons 11 (list x2 y2 0.0)))
            (tp:space))))
    (tp:fail "Could not create border line. Check TITLE-PAGES layer.")))

(defun tp:rect (x1 y1 x2 y2)
  (tp:line x1 y1 x2 y1) (tp:line x2 y1 x2 y2)
  (tp:line x2 y2 x1 y2) (tp:line x1 y2 x1 y1))

(defun tp:text (x y h value role / data)
  (setq data
    (append (list '(0 . "TEXT") '(8 . "TITLE-PAGES")
                  (cons 10 (list x y 0.0)) (cons 40 h) (cons 1 value)
                  '(50 . 0.0) '(41 . 1.0) '(7 . "Standard"))
            (tp:space)))
  (if role
    (setq data (append data (list (list -3 (list tp:app (cons 1000 role)))))))
  (if (not (entmake data)) (tp:fail "Could not create title-block text.")))

(defun tp:role (entity / data app)
  (setq data (entget entity (list tp:app)))
  (setq app (cadr (assoc -3 data)))
  (if app (cdr (assoc 1000 (cdr app)))))

; Read layout records and sort by tab order (DXF 71), without ActiveX.
(defun tp:layouts (/ d row result)
  (setq d (cdr (assoc -1 (dictsearch (namedobjdict) "ACAD_LAYOUT"))))
  (if d
    (progn
      (setq row (dictnext d T))
      (while row
        (if (and (assoc 1 row) (assoc 71 row) (> (cdr (assoc 71 row)) 0))
          (setq result (cons (list (cdr (assoc 71 row)) (cdr (assoc 1 row))) result)))
        (setq row (dictnext d)))))
  (tp:sort result))

(defun tp:insert-order (item items)
  (cond ((null items) (list item))
        ((< (car item) (caar items)) (cons item items))
        (T (cons (car items) (tp:insert-order item (cdr items))))))

(defun tp:sort (items / result item)
  (foreach item items (setq result (tp:insert-order item result)))
  result)

(defun tp:markers (sheet / ss i e result)
  (setq ss (ssget "_X" (list '(0 . "TEXT") (cons 410 sheet)
                              (list -3 (list tp:app)))))
  (if ss
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq e (ssname ss i) i (1+ i))
        (if (= (tp:role e) "PAGE") (setq result (cons e result))))))
  result)

(defun tp:pages (/ result item markers)
  (foreach item (tp:layouts)
    (setq markers (tp:markers (cadr item)))
    (if markers (setq result (cons (list (cadr item) markers) result))))
  (reverse result))

(defun tp:update (/ pages total n page e data value)
  (setq pages (tp:pages) total (length pages) n 0)
  (foreach page pages
    (setq n (1+ n) value (strcat "Sheet " (itoa n) " of " (itoa total)))
    (foreach e (cadr page)
      (setq data (entget e))
      (if (not (entmod (subst (cons 1 value) (assoc 1 data) data)))
        (tp:fail "Could not update page text. Unlock TITLE-PAGES layer."))
      (entupd e)))
  total)

(defun tp:prompt (label fallback / value)
  (setq value (getstring T (strcat "\n" label " <" fallback ">: ")))
  (if (= value "") fallback value))

(defun tp:draw (title number revision / m r top x y)
  (tp:layer)
  (setq m tp:margin r (- tp:width m) top (- tp:height m)
        x (- r 145.0) y m)
  (tp:rect m m r top)
  ; 145 x 40 mm title block at bottom right, sharing the border edges.
  (tp:line x y x (+ y 40.0))
  (tp:line x (+ y 40.0) r (+ y 40.0))
  (tp:line x (+ y 20.0) r (+ y 20.0))
  (tp:line x (+ y 10.0) r (+ y 10.0))
  (tp:line (+ x 85.0) y (+ x 85.0) (+ y 20.0))
  (tp:text (+ x 3.0) (+ y 34.0) 2.0 "DRAWING TITLE" nil)
  (tp:text (+ x 3.0) (+ y 25.0) 3.5 title "TITLE")
  (tp:text (+ x 3.0) (+ y 16.0) 1.8 "DRAWING NUMBER" nil)
  (tp:text (+ x 3.0) (+ y 12.0) 2.5 number "NUMBER")
  (tp:text (+ x 88.0) (+ y 16.0) 1.8 "REVISION" nil)
  (tp:text (+ x 88.0) (+ y 12.0) 2.5 revision "REVISION")
  (tp:text (+ x 3.0) (+ y 3.5) 2.5 "SCALE: AS SHOWN" nil)
  (tp:text (+ x 88.0) (+ y 3.5) 2.5 "Sheet ? of ?" "PAGE"))

(defun tp:build (/ title number revision)
  (setq title (tp:prompt "Drawing title (keep reasonably short)" "UNTITLED")
        number (tp:prompt "Drawing number" "DWG-001")
        revision (tp:prompt "Revision" "A"))
  (tp:draw title number revision)
  (tp:update))

(defun c:ADDPAGE (/ *error* oldecho oldtile oldtab layouts names n name item)
  (setq oldecho (getvar "CMDECHO") oldtile (getvar "TILEMODE")
        oldtab (getvar "CTAB"))
  (defun *error* (msg)
    (setvar "CMDECHO" oldecho)
    (if (= oldtile 1) (setvar "TILEMODE" 1) (setvar "CTAB" oldtab))
    (princ (strcat "\nADDPAGE stopped: " msg
      "\nA partially created sheet may remain; inspect it before retrying."))
    (princ))
  (setq layouts (tp:layouts) n 1)
  (foreach item layouts (setq names (cons (strcase (cadr item)) names)))
  (setq name "Page-1")
  (while (member (strcase name) names)
    (setq n (1+ n) name (strcat "Page-" (itoa n))))
  (setvar "CMDECHO" 0)
  (command "_Sheet" "_New" name)
  (command "_Sheet" "_Activate" name)
  (setvar "TILEMODE" 0)
  (setvar "CTAB" name)
  (setvar "CVPORT" 1)
  (tp:build)
  (setvar "CMDECHO" oldecho)
  (princ (strcat "\nCreated " name "; all managed page numbers updated."))
  (princ "\nSet this sheet's Print Configuration to Letter landscape, 1:1 in mm.")
  (princ))

(defun c:TITLEBLOCK (/ *error* sheet)
  (defun *error* (msg) (princ (strcat "\nTITLEBLOCK stopped: " msg)) (princ))
  (if (= (getvar "TILEMODE") 1)
    (princ "\nSelect a Sheet tab first; TITLEBLOCK works in paper space.")
    (progn
      (setq sheet (getvar "CTAB"))
      (if (tp:markers sheet)
        (princ "\nThis sheet already has a managed title block.")
        (progn (setvar "CVPORT" 1) (tp:build)
               (princ "\nTitle block added; all managed page numbers updated.")))))
  (princ))

(defun c:UPDATEPAGES (/ *error* total)
  (defun *error* (msg) (princ (strcat "\nUPDATEPAGES stopped: " msg)) (princ))
  (setq total (tp:update))
  (princ (strcat "\nUpdated " (itoa total) " managed sheet(s), in tab order."))
  (princ))

(defun c:PAGECOUNT (/ pages n page)
  (setq pages (tp:pages) n 0)
  (princ (strcat "\nManaged drawing sheets: " (itoa (length pages))))
  (foreach page pages
    (setq n (1+ n))
    (princ (strcat "\n  " (itoa n) ": " (car page))))
  (princ "\nBlank sheets and Model are excluded.")
  (princ))

(princ "\nLoaded: ADDPAGE, TITLEBLOCK, UPDATEPAGES, PAGECOUNT.")
(princ)
