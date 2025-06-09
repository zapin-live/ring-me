import { receiveMessage } from "./helpers/messenger";
import { Database } from "./helpers/storage";
import { getVersionHash } from "./helpers/version";

const main = async () => {
  const db = await Database.init();
  const beeper = await Beeper.init(db);

  // Listeners
  receiveMessage("activation-toggled", async () => {
    const isActive =
      (await db.get("isActive")) &&
      !(await db.get("disabledUntil"))
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
    const hostnameDidChange = hostname !== lastHostname;
    lastHostname = hostname;

    console.debug(`Focus changed to "${hostname}"`,);

    const urlList = await db.get("urlList");
    if (urlList.includes(hostname)) {
      if (hostnameDidChange) {
        beeper.startLoop();
        await beeper.unsetDisableTemporarily();
        await beeper.preBeepIfActive();
      }
    } else {
      beeper.stopLoop();
    }
  };

  chrome.tabs.onUpdated.addListener(async (_, changeInfo, __) => {
    if (changeInfo?.url) {
      await onFocus(await getCurrentUrl());
    }
  });

  chrome.tabs.onActivated.addListener(async () => {
    await onFocus(await getCurrentUrl());
  });


  let hasWindowFocus = false;

  let lastIdleState: chrome.idle.IdleState = "active";
  chrome.idle.onStateChanged.addListener(async (state) => {
    console.debug("Idle state changed:", state);
    if (!hasWindowFocus) {
      return
    }

    if (state === "active" && lastIdleState === "locked") {
      await onFocus(await getCurrentUrl());

      // used to prevent beeping after browser autoupdate
      await db.set("lastVersionHash", 0);
    } else if (state === "locked") {
      console.debug("Browser is locked, disabling beeper");

      await onFocus("");

      // used to prevent beeping after browser autoupdate
      db.set("lastVersionHash", await getVersionHash());
    }
    lastIdleState = state;
  })

  chrome.windows.onFocusChanged.addListener(async (e) => {
    if (e === chrome.windows.WINDOW_ID_NONE) {
      hasWindowFocus = false;
      await onFocus("");
    } else {
      hasWindowFocus = true;
      await onFocus(await getCurrentUrl());
    }
  });


  const lastVersionHash = await db.get("lastVersionHash")
  const isVersionChange = lastVersionHash && lastVersionHash !== await getVersionHash()
  if (isVersionChange) {
    // Skip beeper activation if the browser was updated
    await beeper.disableTemporarily();
  }
};

class Beeper {
  volume: number;
  private disableTimeout: NodeJS.Timeout | null = null;
  private loopTimeout: NodeJS.Timeout | null = null;
  private isLoopRunning: boolean = false;

  constructor(
    readonly db: Database,
    props: { volume: number; isEnabled: boolean; disabledUntil?: number },
  ) {
    this.volume = props.volume;

    if (props.disabledUntil) {
      this.setReactivationTimeout(props.disabledUntil);
    }
  }

  static async init(db: Database) {
    const disabledUntil = await db.get("disabledUntil") as number

    const beeper = new Beeper(db, {
      volume: await db.get("volume"),
      isEnabled: await db.get("isActive"),
      disabledUntil: isNaN(disabledUntil) ? 0 : disabledUntil,
    });

    return beeper;
  }

  startLoop = async () => {
    console.debug("Starting beeper loop");
    if (this.isLoopRunning) {
      return;
    }

    const loop = () => {
      this.loopTimeout = setTimeout(async () => {
        if (!this.isLoopRunning) { return }
        await this.beepIfActive();
        if (!this.isLoopRunning) { return }
        loop();
      }, this.MIN_INTERVAL + Math.random() * (this.MAX_INTERVAL - this.MIN_INTERVAL));
    }

    this.isLoopRunning = true
    loop();
  };

  stopLoop = async () => {
    if (this.loopTimeout) {
      console.debug("Stopping beeper loop");
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
      this.isLoopRunning = false;
    }
  };

  beepIfActive = async (props?: Partial<BeepSoundSetting>) => {
    const isLocked = await chrome.idle.queryState(15) === "locked";

    if (await this.db.get("isActive") && !isLocked) {
      console.debug(`BEEP! freq:${props?.frequency} dur:${props?.duration} isEnabled:${await this.db.get("isActive")} isLocked:${isLocked}`);
      this.beep({
        frequency: props?.frequency ?? 90,
        duration: props?.duration ?? 1000,
        randomness: props?.randomness ?? 0.1,
        volume: props?.volume ?? this.volume,
        waveType: props?.waveType ?? "square",
      });
    }
  };

  preBeepIfActive = async () => {
    const duration = 250
    await this.beepIfActive({ frequency: 340, duration, randomness: 0, waveType: "triangle" });
    await new Promise((resolve) => setTimeout(resolve, duration));
    await this.beepIfActive({ frequency: 220, duration, randomness: 0, waveType: "triangle" });
  }

  beep = async (p: BeepSoundSetting) => {
    try {
      await createAudioOffscreen();
      chrome.runtime.sendMessage({
        type: "playSound",
        volume: p.volume ?? this.volume,
        frequency: p.frequency * (1 + p.randomness * (Math.random() - 0.5)),
        duration: p.duration,
        waveType: p.waveType,
      });
    } catch (e) {
      console.error(e);
    }
  };

  disable = async () => {
    await this.db.set("isDisabledTemporarily", false);
    await this.db.set("isActive", false);
    await this.clearTimeout();
  };

  disableTemporarily = async () => {
    this.enable();
    await this.db.set("isDisabledTemporarily", true);
    this.stopLoop()
  };

  unsetDisableTemporarily = async () => {
    await this.db.set("isDisabledTemporarily", false);
  };

  enable = async () => {
    await this.db.set("isDisabledTemporarily", false);
    await this.db.set("isActive", true);
    await this.clearTimeout();
  };

  disableUntil = async (timestamp: number) => {
    await this.disable();

    await this.db.set("disabledUntil", timestamp);
    this.setReactivationTimeout(timestamp)
    console.debug("Set timeout", new Date(timestamp));
  };

  setReactivationTimeout = async (timestamp: number) => {
    const diffMs = timestamp - new Date().getTime();

    if (diffMs < 0) {
      await this.db.set("disabledUntil", null);
      return;
    }

    if (this.disableTimeout) {
      clearTimeout(this.disableTimeout);
    }

    this.disableTimeout = setTimeout(async () => {
      console.debug("Re-enabling after timeout");
      await this.enable();
      if (this.isLoopRunning) {
        await this.preBeepIfActive();
      }
      await this.db.set("disabledUntil", null);
    }, diffMs);
  }

  clearTimeout = async () => {
    await this.db.set("disabledUntil", null);

    if (this.disableTimeout) {
      clearTimeout(this.disableTimeout);
    }
    this.disableTimeout = null;
  };

  setVolume = async (volume: number) => {
    await this.db.set("volume", volume);
    this.volume = volume;
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

type BeepSoundSetting = {
  frequency: number,
  duration: number,
  randomness: number,
  volume: number
  waveType: OscillatorType
}


void main();
