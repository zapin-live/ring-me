import { receiveMessage } from "./helpers/messenger";
import { Database } from "./helpers/storage";

const main = async () => {
  const db = await Database.init();
  const state = await db.currentState();
  const beeper = new Beeper(state.volume);

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
      await db.set("disabledUntil", null);
      beeper.enable();
    } else {
      beeper.disable();
    }

    await db.set("isActive", newIsActive);
    return newIsActive;
  });

  receiveMessage("disable-until-next-visit", async () => {
    await db.set("disabledUntil", "next-visit");
    beeper.disableTemporarily();
  });

  receiveMessage("disable-until", async (message) => {
    await db.set("disabledUntil", message.untilMs);

    beeper.disableUntil(message.untilMs);
  });

  receiveMessage("url-added", async (message) => {
    const urls = (await db.get("urlList")) as string[];
    if (urls.includes(message.url)) {
      return;
    }
    await db.set("urlList", [...urls, message.url]);

    if (message.url === (await getCurrentUrl())) {
      beeper.enable();
    }
  });

  receiveMessage("url-removed", async (message) => {
    const urls = await db.get("urlList");
    const newUrls = urls.filter((u) => u !== message.url);
    await db.set("urlList", newUrls);

    if (message.url === (await getCurrentUrl())) {
      beeper.disable();
    }
  });

  receiveMessage("volume-changed", async (message) => {
    await db.set("volume", message.volume);
    beeper.setVolume(message.volume);
  });

  chrome.tabs.onActivated.addListener(async () => {
    const urlList = await db.get("urlList");

    if (urlList.includes(await getCurrentUrl())) {
      if ((await db.get("disabledUntil")) == "next-visit") {
        await db.set("disabledUntil", null);
        beeper.isTemporarilyDisabled = false;
      }

      beeper.unMute();
      beeper.beepIfActive({ delay: 1000 });
    } else {
      beeper.mute();
    }
  });

  chrome.windows.onFocusChanged.addListener(async (e) => {
    if (e === chrome.windows.WINDOW_ID_NONE) {
      beeper.mute();
    }
  });

  await beeper.startLoop();
};

class Beeper {
  isMuted: boolean = true;
  isEnabled: boolean = true;
  isTemporarilyDisabled: boolean = false;
  volume: number;
  private disableTimeout: NodeJS.Timeout | null = null;

  constructor(volume: number) {
    this.volume = volume;
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
    if (this.isEnabled && !this.isMuted && !this.isTemporarilyDisabled) {
      try {
        this.beep(90, 1000);
      } catch (e) {
        console.error(e);
      }
    }
  };

  beep = async (frequency: number, duration: number) => {
    await this.createAudioOffscreen();
    chrome.runtime.sendMessage({
      type: "playSound",
      volume: this.volume,
      frequency,
      duration,
    });
  };

  createAudioOffscreen = async () => {
    if (await chrome.offscreen.hasDocument()) {
      return;
    }

    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "Playing audio",
    });
  };

  disable = () => {
    this.isEnabled = false;
    this.isTemporarilyDisabled = false;
  };

  disableTemporarily = () => {
    this.isTemporarilyDisabled = true;
  };

  enable = () => {
    if (this.disableTimeout) {
      clearTimeout(this.disableTimeout);
    }
    this.isEnabled = true;
    this.isTemporarilyDisabled = false;
  };

  disableUntil = async (timestamp: number) => {
    this.disable();

    const diffMs = timestamp - new Date().getTime();

    if (diffMs < 0) {
      return;
    }

    if (this.disableTimeout) {
      clearTimeout(this.disableTimeout);
    }
    this.disableTimeout = setTimeout(() => {
      this.enable();
    }, diffMs);
  };

  mute = () => {
    this.isMuted = true;
  };

  unMute = () => {
    this.isMuted = false;
  };

  setVolume = (volume: number) => {
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

const getCurrentUrl = async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return tab.url ? new URL(tab.url).hostname : "";
};

void main();
