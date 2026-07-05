const DEFAULT_INSTANT_LOOKUP = false;

const tokenInput = document.getElementById("tokenInput");
const saveBtn = document.getElementById("saveBtn");
const status = document.getElementById("status");
const toggleBtn = document.getElementById("toggleVisibility");
const instantToggle = document.getElementById("instantToggle");

chrome.storage.sync.get(["token", "instantLookup"], ({ token, instantLookup }) => {
  if (token) tokenInput.value = token;
  instantToggle.checked = instantLookup ?? DEFAULT_INSTANT_LOOKUP;
});

function loadIcon(elementId, fileName) {
  fetch(chrome.runtime.getURL(`svg/${fileName}`))
    .then((res) => res.text())
    .then((svg) => {
      document.getElementById(elementId).innerHTML = svg;
    });
}

loadIcon("lockIcon", "lock.svg");
loadIcon("eyeIcon", "eye.svg");
loadIcon("slidersIcon", "sliders.svg");

let visible = false;
toggleBtn.addEventListener("click", () => {
  visible = !visible;
  tokenInput.type = visible ? "text" : "password";
  loadIcon("eyeIcon", visible ? "eye-off.svg" : "eye.svg");
});

instantToggle.addEventListener("change", () => {
  chrome.storage.sync.set({ instantLookup: instantToggle.checked });
});

saveBtn.addEventListener("click", () => {
  const token = tokenInput.value.trim();

  if (!token) {
    showStatus("Please enter a token.", "error");
    return;
  }

  chrome.storage.sync.set({ token }, () => {
    showStatus("Token saved! Reload any open tabs for the extension to activate.", "success");
    setTimeout(() => {
      status.textContent = "";
      status.className = "";
    }, 5000);
  });
});

function showStatus(msg, type) {
  status.textContent = "";
  status.className = "";
  setTimeout(() => {
    status.textContent = msg;
    status.className = type;
  }, 10);
}

// Advanced Settings screen — scoring weight sliders
const mainScreen = document.getElementById("mainScreen");
const advancedScreen = document.getElementById("advancedScreen");
const advancedBtn = document.getElementById("advancedBtn");
const backBtn = document.getElementById("backBtn");
const weightsList = document.getElementById("weightsList");

// Swaps which screen is visible, forcing a reflow so the incoming screen's
// popIn/fadeUp entrance animations restart every time (not just on first load)
function showScreen(hideEl, showEl) {
  hideEl.style.display = "none";
  showEl.style.display = "none";
  void showEl.offsetWidth; // force reflow between the two style writes
  showEl.style.display = "block";
}

advancedBtn.addEventListener("click", () => showScreen(mainScreen, advancedScreen));
backBtn.addEventListener("click", () => showScreen(advancedScreen, mainScreen));

const SLIDER_MAX = 4;
const WEIGHT_ROW_STAGGER = 0.05; // seconds between each row's fadeUp entrance

function buildWeightRows(weights) {
  weightsList.innerHTML = "";

  WEIGHT_DEFS.forEach((def, i) => {
    const value = weights[def.key];

    const row = document.createElement("div");
    row.className = "weight-row";
    row.style.animationDelay = `${i * WEIGHT_ROW_STAGGER}s`;
    row.innerHTML = `
      <div class="weight-row-top">
        <div>
          <div class="weight-label">${def.label}</div>
          <div class="weight-desc">${def.desc}</div>
        </div>
        <div class="weight-controls">
          <input type="number" class="weight-number" min="0" step="0.1" value="${value}" />
          <button class="rewind-btn" title="Reset to default (${def.default})">
            <span class="rewind-icon"></span>
          </button>
        </div>
      </div>
      <input type="range" class="weight-slider" min="0" max="${SLIDER_MAX}" step="0.1" value="${Math.min(value, SLIDER_MAX)}" />
    `;

    const numberInput = row.querySelector(".weight-number");
    const sliderInput = row.querySelector(".weight-slider");
    const rewindBtn = row.querySelector(".rewind-btn");

    function persist(newValue) {
      chrome.storage.sync.set({ [def.key]: newValue });
    }

    // Slider drag — live-sync the number field, persist once the drag ends
    sliderInput.addEventListener("input", () => {
      numberInput.value = sliderInput.value;
    });
    sliderInput.addEventListener("change", () => {
      persist(parseFloat(sliderInput.value));
    });

    // Typed number — live-sync the slider (browser clamps it to the 0-4 track)
    numberInput.addEventListener("input", () => {
      const num = parseFloat(numberInput.value);
      if (!Number.isNaN(num) && num >= 0) sliderInput.value = num;
    });
    numberInput.addEventListener("change", () => {
      let num = parseFloat(numberInput.value);
      if (Number.isNaN(num) || num < 0) num = 0;
      numberInput.value = num;
      sliderInput.value = num;
      persist(num);
    });

    // Rewind — reset this one weight back to its factory default
    rewindBtn.addEventListener("click", () => {
      numberInput.value = def.default;
      sliderInput.value = Math.min(def.default, SLIDER_MAX);
      persist(def.default);
    });

    weightsList.appendChild(row);
  });

  fetch(chrome.runtime.getURL("svg/rotate-ccw.svg"))
    .then(res => res.text())
    .then(svg => {
      document.querySelectorAll(".rewind-icon").forEach(el => (el.innerHTML = svg));
    });
}

chrome.storage.sync.get(Object.keys(WEIGHT_DEFAULTS), stored => {
  buildWeightRows(resolveWeights(stored));
});
