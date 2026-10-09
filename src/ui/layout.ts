export function renderLayout(root: HTMLElement) {
  root.innerHTML = `
    <header class="masthead">
      <h1><a class="brand" href="./">Colordle Solver</a></h1>
    </header>
    <main>
      <div class="workspace">
        <aside class="control-panel panel" aria-label="Solver controls">
          <div class="game-settings">
            <label for="game-profile">Colordle version</label>
            <select id="game-profile"><option value="ryan" selected>Ryan · colordle.ryantanen.com</option><option value="osmanyo">Osmanyo</option></select>
            <label for="target-scope">Possible targets</label>
            <select id="target-scope"><option value="eligible" selected>Daily target pool</option><option value="all">All named colors</option></select>
          </div>
          <form id="observation-form" novalidate>
            <label for="guess">Color name or hex</label>
            <div class="guess-field"><span id="input-swatch" class="swatch" aria-hidden="true"></span><input id="guess" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="suggestions" aria-expanded="false" /></div>
            <div class="autocomplete-wrap"><ul id="suggestions" role="listbox" hidden></ul></div>
            <div class="score-row"><div><label for="score">Displayed score</label><div class="score-field"><input id="score" inputmode="decimal" /><span>%</span></div></div><button id="submit-observation" class="button primary" type="submit">Add observation</button></div>
            <p id="form-error" class="error" role="alert" hidden></p>
            <button id="cancel-edit" class="text-button" type="button" hidden>Cancel edit</button>
          </form>
          <section class="history-section" aria-labelledby="history-heading">
            <div class="history-header"><h2 id="history-heading">Guess history</h2><button id="reset" class="button quiet" type="button">Clear observations</button></div>
            <div id="history" class="history"></div>
          </section>
        </aside>
        <section class="scene-panel panel" aria-labelledby="scene-heading">
          <div class="scene-toolbar"><h2 id="scene-heading">Color space</h2><button id="reset-camera" class="button scene-button">Reset view</button></div>
          <div id="scene" class="scene"><span id="geometry-status" class="sr-only" role="status">Preparing gamut</span><div id="scene-tooltip" class="scene-tooltip" hidden></div></div>
          <div class="scene-settings">
            <div class="layer-toggles" aria-label="Scene layers">
              <label><input type="checkbox" data-layer="gamut" checked />Gamut</label>
              <label><input type="checkbox" data-layer="candidates" checked />Remaining candidates</label>
              <label><input type="checkbox" data-layer="guesses" checked />Guess points</label>
              <label><input type="checkbox" data-layer="shells" checked />Distance shells</label>
              <label><input type="checkbox" data-layer="eliminated" />Eliminated targets</label>
            </div>
            <div class="render-controls"><label>Quality<select id="quality"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></label><label>Shell opacity<input id="opacity" type="range" min="0.02" max="0.6" step="0.01" value="0.2" /></label><label>Candidate size<input id="point-size" type="range" min="2" max="12" step="1" value="5" /></label></div>
          </div>
        </section>
      </div>
      <section class="candidate-panel panel" aria-labelledby="candidates-heading">
        <div class="panel-heading"><h2 id="candidates-heading">Remaining candidates <span id="candidate-total" class="count-pill" aria-live="polite"></span></h2><label class="sort-label">Sort by<select id="candidate-sort"><option value="name">Name</option><option value="estimate">Nearest estimate</option><option value="latest">Distance from latest guess</option></select></label></div>
        <div id="candidate-detail" class="candidate-detail" hidden></div>
        <div class="table-scroll"><table id="candidate-table"><thead id="candidate-head"></thead><tbody id="candidate-body"></tbody></table></div>
        <div class="pagination"><span id="page-label"></span><div><button id="previous-page" class="button quiet">Previous</button><button id="next-page" class="button quiet">Next</button></div></div>
      </section>
    </main>
  `;
}
