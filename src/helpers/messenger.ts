export type Message = {
  "activation-toggled": {
    type: "activation-toggled"
    isActive: boolean
  }

  "beep": {
    type: "beep",
  }

  "disable-until-next-page": {
    type: "disable-until-next-page",
  }

  "disable-until": {
    type: "disable-until",
    untilMs: number
  }

  "url-added": {
    type: "url-added",
    url: string
  }

  "url-removed": {
    type: "url-removed",
    url: string
  }
}

export const sendMessageToTab = async <T extends keyof Message>(type: T, message: Omit<Message[T], "type">) => {
  console.debug("sendMessageToTab", type, message)
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const tabId = tabs[0].id;
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type, ...message });
    }
  })
}

export const receiveMessage = async <T extends keyof Message>(type: T, handler: (message: Message[T]) => void | Promise<void>) => {
  chrome.runtime.onMessage.addListener(async (message) => {
    if (message.type === type) {
      console.debug("receiveMessage", message)
      handler(message)
    }
  });
}
