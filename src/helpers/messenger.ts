export type Message = {
  "activation-toggled": {
    type: "activation-toggled";
  };

  beep: {
    type: "beep";
  };

  "check-beeper-temporarily-disabled": {
    type: "check-beeper-temporarily-disabled";
  };

  "disable-until-next-visit": {
    type: "disable-until-next-visit";
  };

  "disable-until": {
    type: "disable-until";
    untilMs: number;
  };

  "url-added": {
    type: "url-added";
    url: string;
  };

  "url-removed": {
    type: "url-removed";
    url: string;
  };

  "volume-changed": {
    type: "volume-changed";
    volume: number; // 1-100
  };
};

export const sendMessage = async <T extends keyof Message>(
  type: T,
  message: Omit<Message[T], "type">,
) => {
  console.debug("sendMessage", type, message);
  return await chrome.runtime.sendMessage({ type, ...message });
};

const receivers: Record<string, ((message: any) => Promise<unknown>)[]> = {};

export const receiveMessage = async <T extends keyof Message>(
  type: T,
  handler: (message: Message[T]) => Promise<unknown>,
) => {
  if (!receivers[type]) {
    receivers[type] = [];
  }
  receivers[type].push(handler);
};

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (receivers[message.type]) {
    console.debug(
      `received Message for ${receivers[message.type].length} subs:`,
      message,
    );
    receivers[message.type].forEach((handler) => {
      handler(message).then((res) => {
        sendResponse(res);
      });
    });

    return true;
  }
});
