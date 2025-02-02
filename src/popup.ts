import { sendMessageToTab } from './helpers/messenger';
import { Database } from './helpers/storage';

export class Activation {
  db: Database;

  static async init(db: Database) {
    const activation = new Activation(db)
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
    const isActive = await this.db.get("isActive") && !await this.db.get("disabledUntil");
    const newIsActive = !isActive

    if (newIsActive) {
      await this.db.set("disabledUntil", null);
    }

    await this.db.set("isActive", newIsActive)

    await sendMessageToTab("activation-toggled", { isActive: newIsActive });
    await this.updateUi();
  }

  async updateUi() {
    const disabledUntil = await this.db.get("disabledUntil");
    if (disabledUntil) {
      document.getElementById('text-activationStatus')!.innerHTML = 'Disabled';
      document.getElementById('text-statusDescription')!.innerHTML = `until ${new Date(disabledUntil).toLocaleString()}`;
      return
    }

    const isActive = await this.db.get("isActive");

    document.getElementById('text-activationStatus')!.innerHTML = isActive ? 'Active' : 'Inactive';
    document.getElementById('text-statusDescription')!.innerHTML = "";
  }

  async disableUntilNextPage() {
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

  async disableForTime(days: number, hours: number, minutes: number) {
    console.log(days, hours, minutes);
    const diffMs = (days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60) * 1000;
    const ts = Date.now() + diffMs;


    await sendMessageToTab("disable-until", { untilMs: ts });

    await this.db.set("disabledUntil", ts);
    await this.updateUi();
  }
}

export class UrlList {
  db: Database;
  btnAddCurrentPage = document.getElementById('btn-addUrl')!
  urlContainer = document.getElementById('container-urlList')!;

  static async init(db: Database) {
    const urlList = new UrlList(db);
    const state = await db.currentState();

    urlList.btnAddCurrentPage.innerHTML = "Add current page (" + (await getCurrentBaseurl()) + ")";
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

    this.updateList(urls);
  }

  removeUrl = async (url: string) => {
    const urls = await this.db.get("urlList") as string[];
    const newUrls = urls.filter(u => u !== url);
    await this.db.set("urlList", newUrls);
    sendMessageToTab("url-removed", { url });

    this.updateList(newUrls);
  }

  updateList(urls: string[]) {
    this.urlContainer.innerHTML = '';
    urls.forEach(url => {
      const btnRemove = document.createElement('button');
      btnRemove.innerHTML = "X";
      btnRemove.addEventListener('click', async () => {
        await this.removeUrl(url);
      });

      const el = document.createElement('div');
      el.innerHTML = url;
      el.classList.add('urlList-item');
      el.prepend(btnRemove);

      this.urlContainer.appendChild(el);
    });
  }
}



document.addEventListener("DOMContentLoaded", async function() {
  const db = await Database.init()

  const activation = await Activation.init(db);
  await UrlList.init(db);

  console.log(await getCurrentBaseurl());


  document.getElementById('btn-disableUntilNextPage')!.addEventListener("click", async () => {
    await activation.disableUntilNextPage();
  })

  document.getElementById('btn-disableUntilTomorrow')!.addEventListener("click", async () => {
    await activation.disableUntilTomorrow();
  })

  document.getElementById('form-disableForX')!.addEventListener("submit", async (e) => {
    e.preventDefault();
    activation.disableForTime(
      parseInt((document.getElementById('input-disableForDays') as HTMLInputElement).value) || 0,
      parseInt((document.getElementById('input-disableForHours') as HTMLInputElement).value) || 0,
      parseInt((document.getElementById('input-disableForMinutes') as HTMLInputElement).value) || 0,
    );
  })
});


const getCurrentUrl = async () => {
  return new Promise<string | null>((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const url = tabs[0].url;
      if (!url) {
        return resolve(null);
      }
      resolve(url);
    });
  });
}

const getCurrentBaseurl = async () => {
  const url = await getCurrentUrl();
  if (!url) {
    return null;
  }
  return new URL(url).hostname;
}
