const optionsButton = document.getElementById('open-options');

if (optionsButton) {
  optionsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}
