chrome.action.onClicked.addListener(async () => {
  try {
    await chrome.runtime.openOptionsPage();
  } catch (error) {
    console.error('Could not open file review settings:', error);
  }
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'open-file-review-settings') return;
  void (async () => {
    try {
      await chrome.runtime.openOptionsPage();
      respond({ opened: true });
    } catch (error) {
      respond({ opened: false, error: error.message });
    }
  })();
  return true;
});
