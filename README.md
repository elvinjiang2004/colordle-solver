# Colordle Solver

[Open the live site](https://elvinjiang2004.github.io/colordle-solver/) · [GitHub repository](https://github.com/elvinjiang2004/colordle-solver)

A standalone local app that filters named colors by Colordle's exact displayed scores and visualizes the remaining possibilities in CIELAB space. **Ryan's Colordle is the default.** The original Osmanyo reference remains available in the version selector.

## Run

Use Node.js **22.12 or newer**. From this project folder:

```bash
npm install
npm run dev
```

Open the URL printed by Vite, normally http://127.0.0.1:5173.

For this workspace, a checksum-verified portable Node 22 runtime is available under the ignored `.tools/` directory. If `npm` is not on your PATH, run `./start-local.ps1` in PowerShell. It uses that runtime for its own process without changing your system settings.

```bash
npm test
npm run build
npm run preview
```

The production app is generated in `dist/`. Serve it over HTTP; module workers do not work by double-clicking `index.html` with `file://`. There is no backend, account, analytics, remote font, or runtime data request. Libraries and both dictionaries are bundled, so the built app works without internet access.

## Publish updates

The editable source is on `main`. GitHub Pages serves the built site from the root of the `gh-pages` branch.

With Node.js, Git, and GitHub authentication available, run:

```bash
npm run deploy
```

This runs the math tests and production build, then publishes `dist/` to `gh-pages`. The live URL is https://elvinjiang2004.github.io/colordle-solver/. GitHub may take a minute to finish publishing.

Commit and push source changes to `main` separately; publishing the site does not commit your source files. The local `node_modules/`, `dist/`, portable runtime, inspection downloads, and test screenshots are excluded from the source branch.

For a new clone, run `npm install` first. If authentication is needed, use `gh auth login` and `gh auth setup-git`. Repository Settings → Pages should use **Deploy from a branch**, **gh-pages**, **/(root)**.

## Use

1. Leave **Colordle version** set to **Ryan · colordle.ryantanen.com** when playing [Ryan's game](https://colordle.ryantanen.com/). Select Osmanyo for the original reference game's Full List (30k) mode.
2. Use **Daily target pool (all dates)** for Ryan's daily game. For a custom challenge, choose **All named colors**.
3. Enter a color name or 3- or 6-digit hex code, then the displayed percentage. Autocomplete supports arrow keys and Enter. Values such as `95`, `95.8`, and `95.80` normalize with JavaScript `toFixed(2)`.
4. Add observations and inspect matching colors. Enter each new guess and the percentage the game returns.
5. Select history rows to highlight their surfaces; edit or remove rows to recompute from the full selected pool.

Switching game versions clears observations because their scores are not interchangeable. Changing the target pool preserves observations. **Clear observations**, beside Guess history, clears the history and restores the selected pool. Reloading resets the page, including observations and the selected version.

The page contains the solver controls, color-space visualization, and a full-width candidate table. Explanatory subtext, the method dropdown, progression, recommendation, and estimate panels have been removed.

The scene supports rotation, zoom, reset view, layer togggles, shell opacity, point size, and three quality levels. When the canvas has keyboard focus, arrows rotate, +/− zoom, and Home resets. The candidate table also supports inspecting colors without using the scene.

The **Remaining candidates** layer contains only the selected target pool after applying every observation. Before any guesses, daily mode displays 479 named targets and all-names mode displays 31,896 for Ryan's dictionary. The **Eliminated targets** layer also stays within the selected pool. **Gamut** is a separate sample of displayable RGB colors.

## Compatibility and exact filtering

Both games use **CIEDE2000**, but their RGB-to-Lab implementations differ. This changes some scores by hundredths. The solver now reproduces these reported cases with Ryan selected:

| Target | Guess | Displayed score |
| --- | --- | ---: |
| Silver | Green | 66.87% |
| Pig Pink | Aurora | 60.33% |

The canonical scoring path is `src/color/colordleScore.ts`. Dependencies are pinned to matching implementations:

| Version | Conversion and distance | Score before formatting |
| --- | --- | --- |
| Ryan (default) | `color-space@2.3.2` RGB → XYZ → D65 Lab; `delta-e@0.0.8` CIEDE2000 | `Math.abs(100 - deltaE)` |
| Osmanyo reference | `culori@3.3.0` D50 Lab input, converted internally to D65 by its CIEDE2000 function | `Math.max(0, 100 - deltaE)` |

Both format the result with `toFixed(2)`. The Osmanyo path also preserves its NaN-to-zero distance guard. Ryan's pinned conversion and distance routines were checked against the published bundle; see [SOURCE.md](SOURCE.md).

A candidate survives only when its rounded score equals every normalized observation exactly. **There is no added score tolerance.** Approximate meshes and optimizer results never determine the candidate list. Different names sharing a hex value remain separate possibilities. A displayed 100.00% can include aliases or extremely close colors; the candidate table retains every matching name.

### Dictionaries and target pools

Ryan's deployed dictionary contains **31,900 entries**, resolving to **31,896 accepted names** after applying the game's first-match lookup, which ignores case and spaces. The daily pool contains **479 names**: the resolvable union of its published legacy schedule and unblocked generation pool. This is a conservative pool across all dates, not a calculation of today's scheduled answer. Custom challenges can use any accepted name.

The Osmanyo snapshot preserves its **30,020-name CSV** byte for byte. The **4,736 names marked `x`** form its normal target pool. The parser preserves the game's trim, comma-split, quote-removal, and marker rules, including falling back to all names if no markers exist.

All accepted names are available as guesses regardless of the selected target pool. Direct hex input lets the solver represent a known guess color; it does not imply the game accepts hex guesses.

These are bundled snapshots, not automatically updated lists. If upstream data changes, this snapshot may need updating. Optional alternate Color Pizza lists and a 2D slice view are not implemented.

## Geometry

CIEDE2000 distance constraints are distorted surfaces in Lab space. The app samples the selected game's distance function on a regular Lab grid and uses **marching tetrahedra** (six tetrahedra per grid cell) to extract a numerical surface for each central distance. Triangles are retained when their centroids lie in or close to the sRGB gamut (RGB channel tolerance 0.035); edges may slightly cross its boundary.

The gamut is an RGB sample cloud converted using the selected game's conversion. Ryan uses its D65 Lab coordinates; Osmanyo uses its D50 input coordinates. The enclosing grid is an orientation aid.

- **Ryan:** a score `s` permits central distances `100 - s` or `100 + s` because the game uses an absolute value. Both branches are included in the surfaces and continuous fit. A 0.00% score means distance near 100, not all distances above 100.
- **Osmanyo:** positive scores use distance `100 - s`. A 0.00% score is censored: distances approximately 99.995 and above qualify, so the surface marks the boundary and the fit uses a one-sided constraint.
- Score rounding permits a band of about **±0.005 ΔE00** around a central distance. Exact boundary inclusion depends on JavaScript floating-point formatting. Zero-distance surfaces collapse to the guess marker.

Exact candidate points remain authoritative. Mesh interpolation can be inaccurate near sharp curvature or hue discontinuities.

The continuous estimate uses deterministic, bounded, multi-start pattern search in continuous sRGB. It minimizes squared residuals to the closest allowed distance branch, with the one-sided constraint for Osmanyo zero scores. The optimizer may miss a better solution, and few observations can leave multiple solutions. The estimate is used only for candidate sorting; the estimated-region layer and its marker have been removed. These estimates do not modify candidates.

Ryan's geometry-only Lab-to-RGB conversion inverts the deployed forward mapping; it avoids a low-light bug in the library's bundled inverse. All exact scoring uses the unmodified forward conversion.

## Performance

- A worker computes meshes and the continuous estimate used for sorting. Version tags discard obsolete results.
- Converted coordinates are cached. Surface keys include the game version, guess hex, score, and resolution, with an 18-entry cache limit.
- The scene redraws on changes instead of continuously while idle. Replaced geometry, materials, and textures are disposed.

| Quality | RGB gamut samples | Lab grid cells per axis |
| --- | ---: | ---: |
| Low | 13³ = 2,197 | 20 |
| Medium | 21³ = 9,261 | 30 |
| High | 31³ = 29,791 | 44 |

Performance depends on the browser and target pool. Both dictionaries are bundled, increasing the initial load size. If WebGL is unavailable, exact filtering and the candidate table remain usable.

## Structure and verification

- `src/color/`: game selection, dictionary loading, conversion, exact scoring.
- `src/solver/`: exact filtering and continuous estimation for sorting.
- `src/visualization/`: Lab scene, gamut samples, numerical surfaces.
- `src/workers/`: geometry and estimate computation.
- `src/ui/`: layout, autocomplete, history, candidate table.
- `src/main.ts`: state, events, worker coordination.
- `src/data/`: dictionary snapshots, target pools, provenance, color-name license.
- `tests/`: math tests, independent score fixtures, browser checks.

`npm run build` includes TypeScript checks for unused locals and parameters.

`npm test` covers both reported regressions, 2,000 independently generated Ryan score fixtures, 2,000 original-reference pairs, name normalization, target preservation in synthetic puzzles, filtering and editing, aliases, rounding, both zero-score behaviors, numerical geometry, valid-gamut estimation, and cache separation. It also includes a published Sharma CIEDE2000 reference pair.

```bash
# Uses installed Chrome on Windows when found; otherwise install Chromium:
npx playwright install chromium
npm run test:browser
```

Set `BROWSER_PATH` for another Chromium executable. Browser checks cover both versions, the reported examples through the real form, profile/pool changes, keyboard autocomplete and submission, the geometry worker, editing/removal, contradictions, camera and layer controls, narrow layouts, and console errors. Screenshots are saved under ignored `test-results/`.

## Attribution

- [Ryan's Colordle](https://colordle.ryantanen.com/): default game behavior and deployed data snapshot.
- [Osmanyo's Colordle](https://github.com/osmanyo/colordle): original reference behavior and CSV snapshot.
- [Color Names / Color Pizza](https://github.com/meodai/color-names): color-name data; upstream license included as `src/data/LICENSE.color-names`.
- [color-space](https://github.com/colorjs/color-space) and [DeltaE](https://github.com/zschuessler/DeltaE): Ryan-compatible conversion and distance (Unlicense).
- [Culori](https://culorijs.org/): original-reference scoring and geometry conversions (MIT).
- [Three.js](https://threejs.org/): rendering and OrbitControls (MIT).
- [Sharma, Wu, and Dalal (2005)](https://www2.ece.rochester.edu/~gsharma/ciede2000/): CIEDE2000 implementation notes and supplementary test data.

This independent companion computes locally and does not modify the game's saved data.
