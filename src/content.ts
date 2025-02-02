import { receiveMessage } from "./helpers/messenger";
import { Database } from "./helpers/storage";


const main = async () => {
  const db = await Database.init()
  const state = await db.currentState()
  const beeper = new Beeper()

  const maybeEnableBeeper = async () => {
    if (state.isActive) {
      if (state.urlList.includes(window.location.hostname)) {
        if (state.disabledUntil && state.disabledUntil > (new Date()).getTime()) {
          beeper.disableUntil(state.disabledUntil)
        } else {
          beeper.enable()
        }
      }
    }
  }

  // Listeners
  receiveMessage("check-is-loaded", async () => {
    return true
  })

  receiveMessage("check-beeper-temporarily-disabled", async () => {
    return beeper.isTemporarilyDisabled
  })

  receiveMessage("activation-toggled", async (message) => {
    if (message.isActive) {
      maybeEnableBeeper()
    } else {
      beeper.disable()
    }
  })

  receiveMessage("disable-until-next-page", async () => {
    beeper.disableTemporarily()
  })

  receiveMessage("disable-until", async (message) => {
    beeper.disableUntil(message.untilMs)
  })

  receiveMessage("url-added", async (message) => {
    if (message.url === window.location.hostname) {
      beeper.enable()
    }
  })

  receiveMessage("url-removed", async (message) => {
    if (message.url === window.location.hostname) {
      beeper.disable()
    }
  })

  window.addEventListener('focus', function(this: Beeper) {
    beeper.unMute()
    beeper.beepIfActive(1000)
  })

  window.addEventListener('blur', function(this: Beeper) {
    beeper.mute()
  })

  // Loop

  await maybeEnableBeeper()
  await beeper.startLoop()
}


class Beeper {
  isMuted: boolean = false
  isEnabled: boolean = false
  isTemporarilyDisabled: boolean = false
  private disableTimeout: NodeJS.Timeout | null = null

  startLoop = async () => {
    this.beepIfActive()
    while (true) {
      await this.waitRandomInterval()
      await this.beepIfActive()
    }
  }

  beepIfActive = async (delay?: number) => {
    if (delay) {
      await new Promise(r => setTimeout(r, delay))
    }
    if (this.isEnabled && !this.isMuted && !this.isTemporarilyDisabled) {
      try {
        this.beep(90, 1000)
      } catch (e) {
        console.error(e)
      }
    }
  }

  beep = async (frequency: number, duration: number) => {
    const audio = new (window.AudioContext || (window as any).webkitAudioContext)()

    const volume = audio.createGain()
    volume.gain.value = 0.1

    const osc = audio.createOscillator() 
    osc.type = 'square';
    osc.frequency.value = frequency;

    osc.connect(volume)
    volume.connect(audio.destination);
    osc.start();

    setTimeout(() => { osc.stop(); }, duration);
  }

  disable = () => {
    this.isEnabled = false
    this.isTemporarilyDisabled = false
  }

  disableTemporarily = () => {
    this.isTemporarilyDisabled = true
  }

  enable = () => {
    if (this.disableTimeout) {
      clearTimeout(this.disableTimeout)
    }
    this.isEnabled = true
    this.isTemporarilyDisabled = false
  }

  disableUntil = async (timestamp: number) => {
    this.disable()

    const diffMs = timestamp - (new Date()).getTime()

    if (diffMs < 0) {
      return
    }


    if (this.disableTimeout) {
      clearTimeout(this.disableTimeout)
    }
    this.disableTimeout = setTimeout(() => {
      this.enable()
    }, diffMs)

  }


  mute = () => {
    this.isMuted = true
  }

  unMute = () => {
    this.isMuted = false
  }

  waitRandomInterval = async () => {
    await new Promise(r => setTimeout(r, this.MIN_INTERVAL + Math.random() * (this.MAX_INTERVAL - this.MIN_INTERVAL)));
  }

  private MIN_INTERVAL = 5000
  private MAX_INTERVAL = 30000
}


void main()

