# Mascot assets

`<expression>.png` — the files the app loads. **Generated, don't edit by hand.**
`source/<expression>.png` — the untouched 3D renders.

The eight expressions are `happy`, `proud`, `motivated`, `surprised`,
`delighted`, `worried`, `sad`, `sleepy`.

## Updating a pose

1. Drop the new render in `source/` under the same name (transparent PNG).
2. Run `node scripts/normalize-mascot.mjs`.

The script re-frames every pose on the character's body so expressions can
replace one another without the mascot changing size or jumping — see the
comments at the top of the script for how it does it.
