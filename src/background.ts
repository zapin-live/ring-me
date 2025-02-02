chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({
    text: "",
  });
});


chrome.action.onClicked.addListener(async (tab) => {
    const prevState = await chrome.action.getBadgeText({ tabId: tab.id });
    const nextState = prevState === '' ? 'OFF' : '';

    await chrome.action.setBadgeText({
      tabId: tab.id,
      text: nextState,
    });
});
