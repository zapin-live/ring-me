export const storageSet = async (key: string, value: unknown) => {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, function() {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
      } else {
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
        resolve(result[key]);
      }
    });
  });
}


const DefaultValues = {
  isActive: true,
  statusDescription: "", 
  urlList: [] as string[],
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

  async set(key: StorageKey, value: unknown) {
    return storageSet(key, value);
  }

  async currentState() {
    return {
      isActive: await this.get('isActive'),
      statusDescription: await this.get('statusDescription'),
      urlList: await this.get('urlList'),
    }
  }
}
