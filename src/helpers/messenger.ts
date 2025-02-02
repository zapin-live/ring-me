export type Message = {
  "activation-toggled": {
    type: "activation-toggled"
  }

  "set-activation-toggle": {
    type: "set-activation-toggle",
    isActive: boolean,
    description: string
  }
}

export const sendMessageToTab = async <T extends keyof Message>(type: T, message: Omit<Message[T], "type">) => {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const tabId = tabs[0].id;
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type, ...message });
    }
  })
}

export const sendMessageToUi = async <T extends keyof Message>(type: T, message: Omit<Message[T], "type">) => {
  chrome.runtime.sendMessage({ type, ...message });
}

export const receiveMessage = async <T extends keyof Message>(type: T, handler: (message: Message[T]) => void | Promise<void>) => {
  chrome.runtime.onMessage.addListener(async (message) => {
    if (message.type === type) {
      handler(message)
    }
  });
}
