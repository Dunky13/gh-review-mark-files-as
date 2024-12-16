const myInitCode = () => {
  // Ensure this runs only on pull request pages
  if (!window.location.pathname.includes("/pull/")) return;

  // Check if files section exists
  const filesSection = window.location.pathname.endsWith('files') //document.querySelector(".js-diff-progressive-container");
  if (!filesSection) return;

  // Add the custom "Mark All" buttons
  addMarkAllButtons();
};

function addMarkAllButtons() {
  // Check if buttons already exist
  if (document.querySelector("#mark-all-files-viewed")) return;

  // Create a container for the buttons
  // const container = document.createElement("div");
  // container.style.margin = "10px 0";

  // Create "Mark All as Viewed" button
  const markAllBtn = document.createElement("button");
  markAllBtn.id = "mark-all-files-viewed";
  markAllBtn.textContent = "Mark All as Viewed";
  // markAllBtn.style.marginRight = "10px";
  markAllBtn.className = "diffbar-item btn btn-primary"; // GitHub-style button
  markAllBtn.addEventListener("click", markAllAsViewed);

  // Create "Unmark All as Viewed" button
  const unmarkAllBtn = document.createElement("button");
  unmarkAllBtn.id = "unmark-all-files-viewed";
  unmarkAllBtn.textContent = "Unmark All as Viewed";
  unmarkAllBtn.className = "diffbar-item btn btn-secondary";
  unmarkAllBtn.addEventListener("click", unmarkAllAsViewed);

  // Append buttons to the container
  // container.appendChild(markAllBtn);
  // container.appendChild(unmarkAllBtn);

  // Insert the container at the top of the files list
  const filesHeader = document.querySelector(".diffbar");
  if (filesHeader) {
    filesHeader.appendChild(markAllBtn);
    filesHeader.appendChild(unmarkAllBtn);
    // filesHeader.parentNode.insertBefore(container, filesHeader.nextSibling);
  }
}

function markAllAsViewed() {
  const viewedCheckboxes = document.querySelectorAll(
    'input.js-reviewed-checkbox:not(:checked)'
  );
  viewedCheckboxes.forEach((checkbox) => checkbox.click());
}

function unmarkAllAsViewed() {
  const viewedCheckboxes = document.querySelectorAll(
    'input.js-reviewed-checkbox:checked'
  );
  viewedCheckboxes.forEach((checkbox) => checkbox.click());
}


if (document.readyState !== 'loading') {
  console.log('document is already ready, just execute code here');
  myInitCode();
} else {
  console.log('dom loading event listener');
  document.addEventListener('DOMContentLoaded', function () {
    console.log('document was not ready, place code here');
    myInitCode();
  });
}