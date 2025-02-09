import { checkIsLoaded, sendMessageToTab } from './helpers/messenger';
import { Database } from './helpers/storage';


document.addEventListener("DOMContentLoaded", async function() {
  if (!await checkIsLoaded()) {
    return
  }

  const url = await getCurrentBaseurl();
  if (!url || url === "newtab") {
    document.getElementById("text-notification")!.innerHTML = await getCurrentBaseurl();
    return
  }

  const db = await Database.init()

  await Activation.init(db);
  await UrlList.init(db);
  await Settings.init(db);
});

class Settings {
  db: Database;
  static async init(db: Database) {
    const settings = new Settings(db);
    const state = await db.currentState();
    const rangeInput = document.getElementById('input-volume') as HTMLInputElement;
    rangeInput.value = state.volume.toString();

    rangeInput.addEventListener("change", async (e) => {
      const volume = Number((e.target as HTMLInputElement).value)
      await db.set("volume", volume);
      await sendMessageToTab("volume-changed", {volume: volume});
    })
    return settings;
  }
  constructor(db: Database) {
    this.db = db;
  }
}

class Activation {
  db: Database;

  static async init(db: Database) {
    const activation = new Activation(db)

    document.getElementById('btn-disableUntilNextPage')!.addEventListener("click", async () => {
      await activation.disableUntilNextPage();
    })

    document.getElementById('btn-disableUntilTomorrow')!.addEventListener("click", async () => {
      await activation.disableUntilTomorrow();
    })

    document.getElementById('form-disableForX')!.addEventListener("submit", async (e) => {
      e.preventDefault();

      activation.disableForTime(
        parseInt((document.getElementById('input-disableForHours') as HTMLInputElement)?.value) || 0,
        parseInt((document.getElementById('input-disableForMinutes') as HTMLInputElement)?.value) || 0,
      );
    })
    await activation.updateUi();
    return activation;
  }

  constructor(db: Database) {
    this.db = db;

    document.getElementById('btn-activationStatus')!.addEventListener("click", async () => {
      this.toggleActivation();
    });
  }

  async toggleActivation() {
    const isTemporarilyDisabled = await sendMessageToTab("check-beeper-temporarily-disabled", {});
    const isActive = await this.db.get("isActive") && !await this.db.get("disabledUntil") && !isTemporarilyDisabled;
    const newIsActive = !isActive

    if (newIsActive) {
      await this.db.set("disabledUntil", null);
    }

    await this.db.set("isActive", newIsActive)

    await sendMessageToTab("activation-toggled", { isActive: newIsActive });
    await this.updateUi();
  }

  async updateUi() {
    const isTemporarilyDisabled = await sendMessageToTab("check-beeper-temporarily-disabled", {});
    if (isTemporarilyDisabled) {
      this.uiSetStatus(false, `until page reload`);
      return
    }

    const disabledUntil = await this.db.get("disabledUntil");
    if (disabledUntil && disabledUntil > Date.now()) {
      this.uiSetStatus(false, `until ${new Date(disabledUntil).toLocaleString(getClientLocale())}`);
      return
    }

    const isActive = await this.db.get("isActive");
    this.uiSetStatus(isActive, "");
  }

  uiSetStatus(isActive: boolean, statusDescription: string) {
    const containerActivation = document.getElementById('container-activation-deactivation')!;
    containerActivation.classList.remove("active", "inactive")

    containerActivation.classList.add(isActive ? 'active' : 'inactive')
    document.getElementById('text-activationStatus')!.innerHTML = isActive ? 'Active' : 'Inactive';
    document.getElementById('text-statusDescription')!.innerHTML = statusDescription;
  }

  async disableUntilNextPage() {
    await this.db.set("disabledUntil", null);

    await sendMessageToTab("disable-until-next-page", {});
    await this.updateUi();
  }

  async disableUntilTomorrow() {
    const dateTomorrowMorning = new Date();
    dateTomorrowMorning.setDate(dateTomorrowMorning.getDate() + 1);
    dateTomorrowMorning.setHours(8, 0, 0, 0);
    const ts = dateTomorrowMorning.getTime();

    await sendMessageToTab("disable-until", { untilMs: ts });

    await this.db.set("disabledUntil", ts);
    await this.updateUi();
  }

  async disableForTime(hours: number, minutes: number) {
    const diffMs = (hours * 60 * 60 + minutes * 60) * 1000;
    if (diffMs <= 0) {
      return;
    }

    const ts = Date.now() + diffMs;

    await sendMessageToTab("disable-until", { untilMs: ts });

    await this.db.set("disabledUntil", ts);
    await this.updateUi();
  }
}


class UrlList {
  db: Database;
  btnAddCurrentPage = document.getElementById('btn-addUrl')!
  urlContainer = document.getElementById('container-urlList')!;

  static async init(db: Database) {
    const urlList = new UrlList(db);
    const state = await db.currentState();

    if (!await urlList.isInUrlList(await getCurrentBaseurl())) {
      document.getElementById('container-controls')!.classList.add('hidden');
      document.getElementById('container-activation-deactivation')!.classList.add('hidden');
      document.getElementById('text-notification')!.classList.remove('hidden');
    }

    urlList.btnAddCurrentPage.innerHTML = `&#65291; Add website '${await getCurrentBaseurl()}'`;
    urlList.updateList(state.urlList);
    return urlList;
  }

  constructor(db: Database) {
    this.btnAddCurrentPage.addEventListener('click', async () => {
      const url = await getCurrentBaseurl();
      if (url) {
        await this.addUrl(url);
      }
    })

    this.db = db;
  }


  addUrl = async (url: string) => {
    const urls = await this.db.get("urlList") as string[];
    if (urls.includes(url)) {
      return;
    }
    urls.push(url);
    await this.db.set("urlList", urls);
    sendMessageToTab("url-added", { url });

    document.getElementById('container-activation-deactivation')!.classList.remove('hidden');
    document.getElementById('text-notification')!.classList.add('hidden');
    this.updateList(urls);
  }

  removeUrl = async (url: string) => {
    const urls = await this.db.get("urlList") as string[];
    const newUrls = urls.filter(u => u !== url);
    await this.db.set("urlList", newUrls);
    sendMessageToTab("url-removed", { url });

    this.updateList(newUrls);
  }

  isInUrlList = async (url: string) => {
    const urls = await this.db.get("urlList") as string[];
    return urls.includes(url);
  }

  updateList(urls: string[]) {
    this.urlContainer.innerHTML = '';
    urls.forEach(url => {
      const btnRemove = document.createElement('button');
      btnRemove.innerHTML = "&#10005;";
      btnRemove.classList.add('btn-remove');
      btnRemove.addEventListener('click', async () => {
        await this.removeUrl(url);
      });

      const listItemText = document.createElement('span');
      listItemText.innerHTML = url;
      listItemText.classList.add('list-item-text');


      const el = document.createElement('div');
      el.classList.add('list-item');
      el.prepend(btnRemove);
      el.appendChild(listItemText);

      this.urlContainer.appendChild(el);
    });
  }
}


const getCurrentBaseurl = async () => {
  const url = await new Promise<string | null>((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const url = tabs[0].url;
      if (!url) {
        return resolve(null);
      }
      resolve(url);
    });
  });

  return url ? new URL(url).hostname : "";
}

const getClientLocale = () => {
  if (typeof Intl !== 'undefined') {
    return Intl.NumberFormat().resolvedOptions().locale;
  }
  return "en-GB";
}

