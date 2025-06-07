import { sendMessage } from "./helpers/messenger";
import { Database } from "./helpers/storage";

document.addEventListener("DOMContentLoaded", async function() {
  const db = await Database.init();

  Status.init(db);
  Status.updateUi();

  UrlList.init(db);
  UrlList.updateUi();

  Settings.init(db);
  Settings.updateUi();
});

const Settings = {
  db: null as unknown as Database,
  rangeInput: document.getElementById("input-volume") as HTMLInputElement,

  init(db: Database) {
    this.db = db;

    this.rangeInput.addEventListener("change", async (e) => {
      await sendMessage("volume-changed", {
        volume: Number((e.target as HTMLInputElement).value),
      });
    });
  },

  async updateUi() {
    const volume = await this.db.get("volume");
    this.rangeInput.value = volume.toString();
  },
};

const Status = {
  db: null as unknown as Database,

  async init(db: Database) {
    this.db = db;

    document
      .getElementById("btn-disableUntilNextPage")!
      .addEventListener("click", async () => {
        await this.disableUntilNextPage();
      });

    document
      .getElementById("btn-disableUntilTomorrow")!
      .addEventListener("click", async () => {
        await this.disableUntilTomorrow();
      });

    document
      .getElementById("form-disableForX")!
      .addEventListener("submit", async (e) => {
        e.preventDefault();

        this.disableForTime(
          parseInt(
            (
              document.getElementById(
                "input-disableForHours",
              ) as HTMLInputElement
            )?.value,
          ) || 0,
          parseInt(
            (
              document.getElementById(
                "input-disableForMinutes",
              ) as HTMLInputElement
            )?.value,
          ) || 0,
        );
      });

    document
      .getElementById("btn-activationStatus")!
      .addEventListener("click", async () => {
        await this.toggleActivation();
      });
  },

  async toggleActivation() {
    await sendMessage("activation-toggled", {});
    await this.updateUi();
  },

  async disableUntilNextPage() {
    await sendMessage("disable-until-next-visit", {});
    await this.updateUi();
  },

  async disableUntilTomorrow() {
    const dateTomorrowMorning = new Date();
    dateTomorrowMorning.setDate(dateTomorrowMorning.getDate() + 1);
    dateTomorrowMorning.setHours(8, 0, 0, 0);
    const ts = dateTomorrowMorning.getTime();

    await sendMessage("disable-until", { untilMs: ts });

    await this.updateUi();
  },

  async disableForTime(hours: number, minutes: number) {
    const diffMs = (hours * 60 * 60 + minutes * 60) * 1000;
    if (diffMs <= 0) {
      return;
    }
    const ts = Date.now() + diffMs;

    await sendMessage("disable-until", { untilMs: ts });

    await this.updateUi();
  },

  async updateUi() {
    const url = await getCurrentBaseurl();
    const urlList = (await this.db.get("urlList")) as string[];
    const disabledUntil = await this.db.get("disabledUntil");
    const isDisabledTemporarily = await this.db.get("isDisabledTemporarily");
    const isActive = await this.db.get("isActive");

    if (!(url && url.includes("."))) {
      this.uiSetStatus("websiteInvalid", "");
    } else if (!urlList.includes(url)) {
      this.uiSetStatus("websiteNotAdded", "");
    } else if (isDisabledTemporarily) {
      this.uiSetStatus("inactive", "until next visit");
    } else if (disabledUntil && disabledUntil > Date.now()) {
      this.uiSetStatus(
        "inactive",
        formatDisableUntil(disabledUntil),
      );
    } else if (!isActive) {
      this.uiSetStatus("inactive", "");
    } else {
      this.uiSetStatus("active", "");
    }
  },

  uiSetStatus(
    status: "active" | "inactive" | "websiteNotAdded" | "websiteInvalid",
    statusDescription: string,
  ) {
    const containerActivation = document.getElementById(
      "container-activation-deactivation",
    )!;
    const elementStatusText = document.getElementById("text-activationStatus")!;

    containerActivation.classList.remove("active", "inactive", "standby");
    switch (status) {
      case "active":
        elementStatusText.innerHTML = "Active";
        containerActivation.classList.add("active");
        break;
      case "inactive":
        elementStatusText.innerHTML = "Inactive";
        containerActivation.classList.add("inactive");
        break;
      case "websiteNotAdded":
        elementStatusText.innerHTML = "Website<br>not added";
        containerActivation.classList.add("standby");
        break;
      case "websiteInvalid":
        elementStatusText.innerHTML = "Standby";
        containerActivation.classList.add("standby");
    }

    document.getElementById("text-statusDescription")!.innerHTML =
      statusDescription;
  },
};

const UrlList = {
  db: null as unknown as Database,
  btnAddCurrentPage: document.getElementById("btn-addUrl")!,
  urlContainer: document.getElementById("container-urlList")!,

  async init(db: Database) {
    this.db = db;

    this.btnAddCurrentPage.addEventListener("click", async () => {
      const url = await getCurrentBaseurl();
      if (url) {
        await this.addUrl(url);
      }
    });
  },

  async addUrl(url: string) {
    if (!url.includes(".")) {
      return;
    }

    await sendMessage("url-added", { url });
    await this.updateUi();
    await Status.updateUi();
  },

  async removeUrl(url: string) {
    await sendMessage("url-removed", { url });
    await this.updateUi();
    await Status.updateUi();
  },

  async updateUi() {
    const isInUrlList = (await this.db.get("urlList")).includes(
      await getCurrentBaseurl(),
    );
    if (isInUrlList) {
      hideElement(this.btnAddCurrentPage);
    } else {
      unhideElement(this.btnAddCurrentPage);
    }

    this.btnAddCurrentPage.innerHTML = `&#65291; Add website '${await getCurrentBaseurl()}'`;

    const urls = await this.db.get("urlList");

    this.urlContainer.innerHTML = "";
    urls.forEach((url) => {
      const btnRemove = document.createElement("button");
      btnRemove.innerHTML = "&#10005;";
      btnRemove.classList.add("btn-remove");
      btnRemove.addEventListener("click", async () => {
        await this.removeUrl(url);
      });

      const listItemText = document.createElement("span");
      listItemText.innerHTML = url;
      listItemText.classList.add("list-item-text");

      const el = document.createElement("div");
      el.classList.add("list-item");
      el.prepend(btnRemove);
      el.appendChild(listItemText);

      this.urlContainer.appendChild(el);
    });
  },
};

const hideElement = (el: HTMLElement) => {
  el.classList.add("hidden");
};

const unhideElement = (el: HTMLElement) => {
  el.classList.remove("hidden");
};

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
};

function formatDisableUntil(disabledUntilMs: number): string {
  const now = new Date();
  const targetDate = new Date(disabledUntilMs);
  const diffMs = disabledUntilMs - now.getTime();
  const locale = getClientLocale();

  const isToday = targetDate.toDateString() === now.toDateString();
  if (isToday) {
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);

    if (hours > 0) {
      return `for ${hours}&thinsp;h ${minutes + 1}&thinsp;min`;
    } else if (minutes > 0) {
      return `for ${minutes + 1} minutes`;
    } else {
      return `for less than a minute`;
    }
  }

  const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === targetDate.toDateString();
  if (isTomorrow) {
    const formatter = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `until tomorrow, ${formatter.format(targetDate)}`;
  } else {
    const dateFormatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `on ${dateFormatter.format(targetDate)}`;
  }
}

const getClientLocale = () => {
  if (typeof Intl !== "undefined") {
    return Intl.NumberFormat().resolvedOptions().locale;
  }
  return "en-GB";
};
