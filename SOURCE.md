# Reference snapshots

## Ryan's Colordle (default)

The inspected deployment at [colordle.ryantanen.com](https://colordle.ryantanen.com/) serves [main.984e0cc7.js](https://colordle.ryantanen.com/static/js/main.984e0cc7.js). Its [published source map](https://colordle.ryantanen.com/static/js/main.984e0cc7.js.map) contains the application, color-name dictionary, conversion routines, and CIEDE2000 implementation used for this snapshot.

Relevant source-map entries:

- `App.js`: `nameToColor` uses the first dictionary name matching after lowercasing and removing spaces. `colorDiff` calls `space.rgb.lab`, then `DeltaE.getDeltaE00`, then `Math.abs(100 - distance)`.
- `ColorDisplay.js`: formats the score with `toFixed(2)`.
- `color-space/rgb.js`, `xyz.js`, and `lab.js`: the RGB → XYZ → Lab conversion path uses D65 and the library's specific constants and thresholds.
- `delta-e/src/dE00.js`: deployed CIEDE2000 implementation.
- `color-name-list/dist/colornames.esm.js`: 31,900 raw names. Four duplicate normalized names are unreachable because lookup returns the first match, leaving 31,896 accepted names.
- `dailyColor.js`: uses the legacy schedule and then generates daily names from a pool, excluding blocked names.

The solver pins **color-space 2.3.2** and **delta-e 0.0.8**. The installed forward conversion produced exactly the same coordinates as the extracted deployed routines for the fixture pairs; the distance implementation likewise matched. This identifies compatible routines, rather than claiming those package versions are exposed by the deployment. A newer color-space conversion was not compatible.

### Data

- [colors.json](https://colordle.ryantanen.com/colors.json): legacy schedule (1,016 entries).
- [color-pool.json](https://colordle.ryantanen.com/color-pool.json): generation pool (551 entries) and blocklist (18 entries).
- `src/data/ryan-colornames.json`: extracted dictionary, with an eligibility flag derived from those published pools.
- `src/data/ryan-target-pools.json`: the legacy schedule, generation pool, and blocklist used to derive eligibility.
- `src/data/ryan-provenance.json`: SHA-256 hashes of the downloaded bundle/map and bundled data/fixtures.

The **479-name daily pool** is the union of resolvable legacy names and unblocked generation-pool names. It intentionally spans all dates and does not narrow by today's date or generated schedule history. The all-names option supports custom challenges.

### Independent regression fixtures

`tests/ryan-score-fixtures.json` contains 2,000 scores computed with the conversion and distance routines extracted directly from the deployed source map. For fixture index `i` from 0 to 1999, target index is `(i * 137) % 31900` and guess index is `(i * 971 + 19) % 31900` in the raw deployed dictionary.

To reproduce a fixture: parse the hex channels as bytes, apply the extracted RGB → XYZ → Lab conversion, pass the resulting uppercase `{ L, A, B }` objects into the extracted CIEDE2000 implementation, and evaluate `Number(Math.abs(100 - distance).toFixed(2))`. Tests compare the solver against these fixed expected values.

Separate regressions check **Silver / Green = 66.87%** and **Pig Pink / Aurora = 60.33%** and ensure the true targets survive filtering. Using Ryan's conversion with Culori's distance implementation also reproduces these two rounded scores, confirming that conversion differences explain the reported failures.

## Osmanyo original reference

Inspected 2026-10-06. Revision: `dfc773e9e0d1ab57074350abbb2ff82ad918d550`.

- [index.html](https://github.com/osmanyo/colordle/blob/dfc773e9e0d1ab57074350abbb2ff82ad918d550/index.html): import at line 560; converters at lines 582–583; target pool at lines 644–648; target conversion at line 652; scoring and NaN guard at lines 713–716.
- [dictionary.js](https://github.com/osmanyo/colordle/blob/dfc773e9e0d1ab57074350abbb2ff82ad918d550/dictionary.js): full-list selection, CSV parsing and eligibility markers.
- [colornames.csv](https://github.com/osmanyo/colordle/blob/dfc773e9e0d1ab57074350abbb2ff82ad918d550/colornames.csv): preserved byte-for-byte at `src/data/colornames.csv`.

CSV SHA-256:

```text
26b4dd64ac4778ece55777e82450d63f2aa021a8fd91f331c293b45029e774d7
```

Parsed names: **30,020**. Eligible `x` names: **4,736**.

The game's `https://esm.sh/culori@3` endpoint resolved to **3.3.0** when inspected. Its `differenceCiede2000` internally converts inputs to D65 Lab. This application preserves the game's initial D50 conversion and internal D65 conversion, followed by its NaN guard, `Math.max(0, 100 - distance)`, and two-decimal rounding.

## Local inspection artifacts

Downloaded source files under ignored `reference/` are inspection artifacts. Runtime code does not execute the downloaded application or call the game's services. Data and score fixtures are bundled snapshots; upstream changes require an explicit refresh.
