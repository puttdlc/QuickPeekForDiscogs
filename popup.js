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

let visible = false;
toggleBtn.addEventListener("click", () => {
  visible = !visible;
  tokenInput.type = visible ? "text" : "password";

  const eyeIcon = document.getElementById("eyeIcon");
  eyeIcon.innerHTML = visible
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
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
