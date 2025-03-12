import { receiveMessage } from "./helpers/messenger";
import { Database } from "./helpers/storage";

const main = async () => {
  const db = await Database.init();
  const beeper = await Beeper.init(db);

  // Listeners
  receiveMessage("check-beeper-temporarily-disabled", async () => {
    return beeper.isTemporarilyDisabled;
  });

  receiveMessage("activation-toggled", async () => {
    const isActive =
      (await db.get("isActive")) &&
      !(await db.get("disabledUntil")) &&
      !beeper.isTemporarilyDisabled;
    const newIsActive = !isActive;

    if (newIsActive) {
      await beeper.enable();
    } else {
      await beeper.disable();
    }

    return newIsActive;
  });

  receiveMessage("disable-until-next-visit", async () => {
    await beeper.disableTemporarily();
  });

  receiveMessage("disable-until", async (message) => {
    await beeper.disableUntil(message.untilMs);
  });

  receiveMessage("url-added", async (message) => {
    const urls = (await db.get("urlList")) as string[];
    if (urls.includes(message.url)) {
      return;
    }
    await db.set("urlList", [...urls, message.url]);

    if (message.url === (await getCurrentUrl())) {
      await beeper.enable();
    }
  });

  receiveMessage("url-removed", async (message) => {
    const urls = await db.get("urlList");
    const newUrls = urls.filter((u) => u !== message.url);
    await db.set("urlList", newUrls);

    if (message.url === (await getCurrentUrl())) {
      await beeper.disable();
    }
  });

  receiveMessage("volume-changed", async (message) => {
    await beeper.setVolume(message.volume);
  });

  let lastHostname = "";
  const onFocus = async (hostname: string) => {
    console.debug("Focus changed to", hostname);
    const urlList = await db.get("urlList");

    if (urlList.includes(hostname)) {
      if (hostname === lastHostname) {
        console.debug("Hostname did not change");
        return;
      }

      if ((await db.get("disabledUntil")) == "next-visit") {
        await beeper.enable();
      }

      beeper.unMute();
      await beeper.beepIfActive({ delay: 900 });
    } else {
      beeper.mute();
    }

    lastHostname = hostname;
  };

  chrome.tabs.onUpdated.addListener(async (_, changeInfo, __) => {
    if (changeInfo?.url) {
      const hostname = new URL(changeInfo.url).hostname;
      await onFocus(hostname);
    }
  });

  chrome.tabs.onActivated.addListener(async () => {
    await onFocus(await getCurrentUrl());
  });

  chrome.idle.onStateChanged.addListener(async (state) => {
    if (state === "active") {
      await onFocus(await getCurrentUrl());
    } else {
      beeper.mute();
    }
  })

  chrome.windows.onFocusChanged.addListener(async (e) => {
    if (e === chrome.windows.WINDOW_ID_NONE) {
      beeper.mute();
    } else {
      await onFocus(await getCurrentUrl());
    }
  });

  await beeper.startLoop();
};

class Beeper {
  isMuted: boolean = true;
  isEnabled: boolean;
  isTemporarilyDisabled: boolean = false;
  volume: number;
  private disableTimeout: NodeJS.Timeout | null = null;

  constructor(
    readonly db: Database,
    props: { volume: number; isEnabled: boolean },
  ) {
    this.volume = props.volume;
    this.isEnabled = props.isEnabled;
  }

  static async init(db: Database) {
    return new Beeper(db, {
      volume: await db.get("volume"),
      isEnabled: await db.get("isActive"),
    });
  }

  startLoop = async () => {
    this.beepIfActive();
    while (true) {
      await this.waitRandomInterval();
      await this.beepIfActive();
    }
  };

  beepIfActive = async (props?: { delay?: number }) => {
    if (props?.delay) {
      await new Promise((r) => setTimeout(r, props.delay));
    }

    console.debug(`BEEPING IF ACTIVE. Enabled: ${this.isEnabled}, Muted: ${this.isMuted}, Temporarily Disabled: ${this.isTemporarilyDisabled}`);
    if (this.isEnabled && !this.isMuted && !this.isTemporarilyDisabled) {
      console.debug("BEEP!");
      this.beep(90, 1000);
    }
  };

  beep = async (frequency: number, duration: number) => {
    try {
      await createAudioOffscreen();
      chrome.runtime.sendMessage({
        type: "playSound",
        volume: this.volume,
        frequency,
        duration,
      });
    } catch (e) {
      console.error(e);
    }
  };

  disable = async () => {
    await this.db.set("isActive", false);
    this.clearTimeout();

    this.isEnabled = false;
    this.isTemporarilyDisabled = false;
  };

  disableTemporarily = async () => {
    await this.db.set("disabledUntil", "next-visit");
    this.clearTimeout();

    this.isTemporarilyDisabled = true;
  };

  enable = async () => {
    await this.db.set("isActive", true);
    await this.db.set("disabledUntil", null);
    this.clearTimeout();

    this.isEnabled = true;
    this.isTemporarilyDisabled = false;
  };

  disableUntil = async (timestamp: number) => {
    await this.db.set("disabledUntil", timestamp);
    await this.disable();

    const diffMs = timestamp - new Date().getTime();

    if (diffMs < 0) {
      return;
    }

    this.disableTimeout = setTimeout(() => {
      console.debug("Re-enabling after timeout");
      this.enable();
    }, diffMs);
  };

  clearTimeout = () => {
    if (this.disableTimeout) {
      clearTimeout(this.disableTimeout);
    }
  };

  mute = () => {
    console.debug("Muting");
    this.isMuted = true;
  };

  unMute = () => {
    console.debug("Unmute");
    this.isMuted = false;
  };

  setVolume = async (volume: number) => {
    await this.db.set("volume", volume);
    this.volume = volume;
  };

  waitRandomInterval = async () => {
    await new Promise((r) =>
      setTimeout(
        r,
        this.MIN_INTERVAL +
        Math.random() * (this.MAX_INTERVAL - this.MIN_INTERVAL),
      ),
    );
  };

  private MIN_INTERVAL = 5000;
  private MAX_INTERVAL = 30000;
}

let creationTask: Promise<void> | null;
const createAudioOffscreen = async () => {
  const path = "offscreen.html";
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [offscreenUrl],
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creationTask) {
    await creationTask;
  } else {
    creationTask = chrome.offscreen.createDocument({
      url: path,
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "Playing audio",
    });
    await creationTask;
    creationTask = null;
  }
};

const getCurrentUrl = async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return tab?.url ? new URL(tab.url).hostname : "";
};

void main();
