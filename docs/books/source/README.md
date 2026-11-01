# Dark Psychology — Premium Workbook redesign

Creator: **Ankit Mahato**

## Files

- `../Ankit_Mahato_Dark_Psychology_Rishton_Ka_Andhera.pdf` — original 850-page content source; unchanged.
- `../Ankit_Mahato_Dark_Psychology_Premium_Edition.pdf` — redesigned deliverable.
- `premium_cover.png` — cover artwork embedded in the redesigned PDF.
- `enrichment.py` — chapter-specific principles, examples, reflection prompts, actions and boundary scripts.
- `redesign_book.py` — deterministic renderer and PDF compatibility normalisation.

## Rebuild

From the repository root, with PyMuPDF installed and the repository's DejaVu/Playfair fonts available:

```bash
python3 docs/books/source/redesign_book.py
```

## Design and content rules

- Preserve all 850 pages and the original body content.
- Use the deep-navy, wine and warm-gold visual system with restrained part-specific accents.
- Rebuild the cover, title page, six part dividers and 42 chapter openers.
- Add learning modules only in measured free space; never overlap original content or footers.
- Add practical examples, reflection prompts, healthy alternatives and writing space—not filler or new diagnostic claims.
- Keep the treatment ethical, non-stereotyping, consent-based and safety-oriented.
- Normalise high-Unicode CMap destinations to UTF-16BE surrogate pairs for strict PDF readers.

## Final validation expectations

- 850 pages; 42 chapter compass cards; 150 unique reference IDs; 57 bookmark entries.
- No blank pages, out-of-page text blocks, footer overlaps or missing original body words.
- Full text extraction works in both PyMuPDF and pypdf without CMap warnings.
