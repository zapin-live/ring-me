export type Message = {
  "activation-toggled": {
    type: "activation-toggled"
    isActive: boolean
  }

  "beep": {
    type: "beep",
  }

  "check-beeper-temporarily-disabled": {
    type: "check-beeper-temporarily-disabled"
  }

  "check-is-loaded": {
    type: "check-is-loaded"
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

  "volume-changed": {
    type: "volume-changed",
    volume: number // 1-100
  }
}

export const sendMessageToTab = async <T extends keyof Message>(type: T, message: Omit<Message[T], "type">) => {
  console.debug("sendMessageToTab", type, message)
  const tabId = await getTabId()
  if (tabId) {
    return chrome.tabs.sendMessage(tabId, { type, ...message })
  }
}

export const receiveMessage = async <T extends keyof Message>(type: T, handler: (message: Message[T]) => unknown | Promise<unknown>) => {
  chrome.runtime.onMessage.addListener(async (message, _, sendResponse) => {
    if (message.type === type) {
      console.debug("receiveMessage", message)
      const res = await handler(message)
      if (res !== undefined) {
        sendResponse(res)
      }
      return true
    }
  });
}


export const checkIsLoaded = async () => {
  const tabId = await getTabId()
  if (tabId) {
    return new Promise<boolean>((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: "check-is-loaded" }, () => {
        if (chrome.runtime.lastError) {
          resolve(false)
        } else {
          resolve(true)
        }
      })
    })
  }
}

const getTabId = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0].id;
}
