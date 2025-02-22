export type Message = {
  "activation-toggled": {
    type: "activation-toggled"
  }

  "beep": {
    type: "beep",
  }

  "check-beeper-temporarily-disabled": {
    type: "check-beeper-temporarily-disabled"
  }

  "disable-until-next-visit": {
    type: "disable-until-next-visit",
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

export const sendMessage = async <T extends keyof Message>(type: T, message: Omit<Message[T], "type">) => {
  console.debug("sendMessage", type, message)
  return await chrome.runtime.sendMessage({ type, ...message })
}

export const receiveMessage = async <T extends keyof Message>(type: T, handler: (message: Message[T]) => Promise<unknown>) => {
  chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    if (message.type === type) {
      console.debug("receiveMessage", message)
      handler(message).then((res) => {
        sendResponse(res)
      })
      return true
    }
  });
}
