export const storageSet = async (key: string, value: unknown) => {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, function() {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
      } else {
        console.debug(`SET ${key} = ${value}`);
        resolve();
      }
    })
  });
}

export const storageGet = async (key: string) => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, function(result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
      } else {
        console.debug(`-GET ${key} = ${result[key]}`);
        resolve(result[key]);
      }
    });
  });
}


const DefaultValues = {
  isActive: true,
  statusDescription: "",
  urlList: [] as string[],
  disabledUntil: null as number | null | "next-visit",
  volume: 20,
}

export type StorageKey = keyof typeof DefaultValues;

type StorageTypes = typeof DefaultValues;

export class Database {
  constructor(isInitialized: boolean) {
    if (!isInitialized) {
      throw new Error('Database must be initialized with Database.init()');
    }
  }

  static async init() {
    for (const key in DefaultValues) {
      if (await storageGet(key as StorageKey) === undefined) {
        await storageSet(key as StorageKey, DefaultValues[key as StorageKey]);
      }
    }
    return new Database(true);
  }

  async get<T extends StorageKey>(key: T): Promise<StorageTypes[T]> {
    return storageGet(key) as Promise<StorageTypes[T]>;
  }

  async set<T extends StorageKey>(key: T, value: StorageTypes[T]) {
    return storageSet(key, value);
  }

  async currentState() {
    return {
      isActive: await this.get('isActive'),
      disabledUntil: await this.get('disabledUntil'),
      statusDescription: await this.get('statusDescription'),
      urlList: await this.get('urlList'),
      volume: await this.get('volume'),
    }
  }
}
