let files = [];
let initialFileStates = {}; // Global variable to store the initial state of all files
const checkboxState = ['n', 'm', 'y'];
let position = 0;

const setInitialFiles = () => {
  // Store the initial state of each file
  files = document.querySelectorAll("input.js-reviewed-checkbox");
  const fileStates = Array.from(files).reduce((acc, checkbox) => {
    acc[checkbox.id] ??= checkbox.checked;
    return acc;
  }, initialFileStates);
}

const initialize = () => {
  // Ensure this runs only on pull request pages
  if (!(window.location.pathname.includes("/pull/") && window.location.pathname.includes("/files"))) return;

  // Check if files section exists
  const filesSection = document.querySelector(".js-diff-progressive-container");
  if (!filesSection) return;

  setInitialFiles();

  const checkboxList = Object.values(initialFileStates);
  const checkedLength = checkboxList.filter(Boolean).length;
  position = checkedLength === 0 ? 0 : checkedLength === checkboxList.length ? 2 : 1;
  // Add the custom checkbox
  addStateCheckbox();
};



const togglePosition = () => {
  position = (position + 1) % checkboxState.length;
  return checkboxState[position];
}

const setCheckboxState = (stateCheckbox, newState) => {
  switch (newState) {
    case 'y':
      stateCheckbox.checked = true;
      stateCheckbox.indeterminate = false;
      break;
    case 'n':
      stateCheckbox.checked = false;
      stateCheckbox.indeterminate = false;
      break;
    case 'm':
      stateCheckbox.checked = false;
      stateCheckbox.indeterminate = true;
      break;
    default:
      stateCheckbox.checked = false;
      stateCheckbox.indeterminate = true;
      break;
  }
}

function addStateCheckbox() {
  // Check if the checkbox already exists
  if (document.querySelector("#viewed-state-checkbox")) return;

  // Create the checkbox
  const stateCheckbox = document.createElement("input");
  stateCheckbox.id = "viewed-state-checkbox";
  stateCheckbox.type = "checkbox";
  stateCheckbox.style.marginRight = "10px";
  stateCheckbox.title = "Toggle all files viewed state";

  // Label for the checkbox
  const label = document.createElement("label");
  label.textContent = "Mark All Files";
  label.style.fontWeight = "bold";
  label.style.marginRight = "10px";
  label.className = "diffbar-item Button--primary Button--small Button"; // GitHub-style button
  label.appendChild(stateCheckbox);

  // Append the checkbox to the GitHub pull request tools header
  const filesHeader = document.querySelector(".pr-review-tools");
  if (filesHeader) {
    filesHeader.prepend(label);
  }

  setCheckboxState(stateCheckbox, checkboxState[position]);

  // Add event listener to toggle file states
  stateCheckbox.addEventListener("click", () => {
    const newState = togglePosition();
    setCheckboxState(stateCheckbox, newState);
    setInitialFiles();
    toggleFileStates(stateCheckbox);
  });
}

function toggleFileStates(stateCheckbox) {
  if (stateCheckbox.indeterminate) {
    // Revert to the initial state if checkbox is indeterminate
    files.forEach((checkbox) => {
      if (checkbox.checked !== initialFileStates[checkbox.id]) {
        checkbox.click();
      }
    });
  } else {
    // Toggle to the target state based on checkbox
    const targetState = stateCheckbox.checked; // true for "mark all as viewed", false for "unmark all"
    files.forEach((checkbox) => {
      if (checkbox.checked !== targetState) {
        checkbox.click();
      }
    });
  }
}

// Initialize when the DOM is ready
if (document.readyState !== "loading") {
  console.log("Document was ready");
  initialize();
} else {
  document.addEventListener("DOMContentLoaded", initialize);
}