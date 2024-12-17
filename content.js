/** @type {NodeListOf<Element>} */
let files = [];

let initialFileStates = {}; // Global variable to store the initial state of all files
const checkboxState = ['n', 'm', 'y'];
let position = 0;

const setInitialFiles = () => {
  // Store the initial state of each file
  files = document.querySelectorAll("input.js-reviewed-checkbox");
  Array.from(files).forEach((checkbox) => {
    initialFileStates[checkbox.id] ??= checkbox.checked;
  });
}

const updatePosition = (numberOfChecked) => {
  position = numberOfChecked === 0 ? 0 : numberOfChecked === files.length ? 2 : 1
}

const calculateState = () => {
  const checked = Array.from(files).reduce((acc, checkbox) => acc + (+checkbox.checked), 0);
  console.log({ checked, files: Array.from(files).map(file => file.checked) });
  updatePosition(checked);
}

const initialize = () => {
  // Ensure this runs only on pull request pages
  if (!(window.location.pathname.match(/.+\/pull\/.+\/files.*/))) return;

  // Check if files section exists
  const filesSection = document.querySelector(".js-diff-progressive-container");
  if (!filesSection) return;
  if (document.querySelector("#viewed-state-checkbox")) return;

  setInitialFiles();

  const checkedLength = Object.values(initialFileStates).filter(Boolean).length;
  updatePosition(checkedLength)
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

  // select the target node
  const target = document.getElementsByClassName('js-review-count')[0];

  // create an observer instance
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      setInitialFiles();
      calculateState();
      setCheckboxState(stateCheckbox, checkboxState[position]);
    });
  });

  // pass in the target node, as well as the observer options
  observer.observe(target, { attributes: true, childList: true, characterData: true });


}

function toggleFileStates(stateCheckbox) {
  if (stateCheckbox.indeterminate) {
    // Revert to the initial state if checkbox is indeterminate
    Array.from(files).forEach((checkbox) => {
      if (checkbox.checked !== initialFileStates[checkbox.id]) {
        checkbox.click();
      }
    });
  } else {
    // Toggle to the target state based on checkbox
    const targetState = stateCheckbox.checked; // true for "mark all as viewed", false for "unmark all"
    Array.from(files).forEach((checkbox) => {
      if (checkbox.checked !== targetState) {
        checkbox.click();
      }
    });
  }
}

let lastUrl = '';
/**
 * GitHub seems to be loading in-place, 
 * so we need to constantly look for url updates to make sure the extension is loaded correctly
 */
function timeoutCB() {
  setTimeout(() => {
    const currUrl = window.location.pathname;
    if (currUrl !== lastUrl) {
      lastUrl = currUrl;
      initialize()
    }
    timeoutCB()
  }, 1000);
}
console.debug('`GitHub Pull Request Mark All Files as` extension has been loaded')
timeoutCB();