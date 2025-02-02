import { receiveMessage, sendMessageToTab } from './helpers/messenger';
import { Database } from './helpers/storage';

export class ActivationToggle {
  constructor(isActive: boolean, description: string) {
    document.getElementById('btn-activationStatus')!.addEventListener("click", async () => {
      await sendMessageToTab("activation-toggled", {});
    });


    receiveMessage("set-activation-toggle", (message) => {
      this.setStatus(message.isActive, message.description);
    });

    this.setStatus(isActive, description);
  }

  setStatus(isActive: boolean, description: string) {
    document.getElementById('text-activationStatus')!.innerHTML = isActive ? 'Active' : 'Inactive';
    document.getElementById('text-statusDescription')!.innerHTML = description;
  }
}

export class UrlList {
  onRemoveListeners: ((url: string) => Promise<void>)[] = []

  onAddCurrentPage = async (fn: () => Promise<void>) => {
    document.getElementById('btn-addCurrentPage')!.addEventListener('click', async () => {
      await fn();
    });
  }

  onRemoveUrl = async (fn: (url: string) => Promise<void>) => {
    this.onRemoveListeners.push(fn);
  }

  private removeUrl = async (url: string) => {
    for (const fn of this.onRemoveListeners) {
      await fn(url);
    }
  }

  updateList(urls: string[]) {
    const urlContainer = document.getElementById('container-urlList')!;
    urlContainer.innerHTML = '';
    urls.forEach(url => {
      const el = document.createElement('div');
      el.innerHTML = url;
      el.classList.add('urlList-item');
      el.addEventListener('click', async () => {
        await this.removeUrl(url);
      });
      urlContainer.appendChild(el);
    });
  }
}


export const Buttons: { [key: string]: HTMLElement } = {
  'btn-enable': document.getElementById('btn-enable')!,
  'btn-disableUntilNextPage': document.getElementById('btn-disableUntilNextPage')!,
  'btn-disableUntilTomorrow': document.getElementById('btn-disableUntilTomorrow')!,
  'btn-disableForever': document.getElementById('btn-disableForever')!,
  'btn-disableForX': document.getElementById('btn-disableForX')!,
  'btn-addUrl': document.getElementById('btn-addUrl')!,
  'btn-removeUrl': document.getElementById('btn-removeUrl')!,
}



document.addEventListener("DOMContentLoaded", async function() {
  const state = await (await Database.init()).currentState();
  new ActivationToggle(state.isActive, state.statusDescription);
});

