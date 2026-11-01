# Nasha Aur Masturbation Addiction Se Azaadi

Original Hinglish recovery book by **Ankit Mahato** — practical, shame-free and evidence-aware.

## Finished deliverable

`../Nasha_Aur_Masturbation_Addiction_Se_Azaadi_Ankit_Mahato.pdf`

- 154 designed 6×9-inch pages
- 18 chapters / 117 detailed sections across eight core parts
- 30 single-page daily workbook entries with substance and compulsion tracks
- Eight reusable worksheets, glossary and verified Indian help directory
- 26 linked research references
- Ten unique illustrations including the cover
- Clickable contents, 192 PDF bookmarks and 347 links

The PDF is educational and does not replace medical diagnosis, treatment or emergency care. Heavy alcohol/CNS-depressant use and other withdrawal risks require professional guidance. Masturbation or high sexual desire alone is not framed as a disorder.

## Source map

- `content_part1.py` … `content_part8.py` — original manuscript
- `workbook.py` — thirty daily practice pages
- `extras.py` — disclaimer, glossary, reusable worksheets and resource directory
- `references.py` — linked reference registry, accessed 1 November 2026
- `research_notes.md` — editorial synthesis and safety safeguards
- `assets/` — final cover and nine original non-explicit illustrations
- `build_book.py` — ReportLab layout, contents, links and bookmarks
- `validate_book.py` — source/PDF integrity and structure checks
- `book_manifest.json` / `validation_report.json` — final build metadata and QA results

## Rebuild and validate

```bash
python3 -m pip install -r docs/books/recovery-source/requirements.txt
python3 docs/books/recovery-source/build_book.py
python3 docs/books/recovery-source/validate_book.py
```

The build script must run before validation because validation also records the final PDF hash and page metadata. The layout uses the locally available DejaVu font family at `/usr/share/fonts/truetype/dejavu`.

`qa/` is an ignored local visual-review directory and is not part of the deliverable.
