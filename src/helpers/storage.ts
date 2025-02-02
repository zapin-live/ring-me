export const storageSet = (key: string, value: unknown, callback: () => void) => {
  chrome.storage.local.set({[key] : value}, function(){
    if(chrome.runtime.lastError) {
      throw Error(chrome.runtime.lastError.message);
    } else {
      callback();
    }
  });
}

export const storageGet = (key: string, callback: (value: any) => void) => {
  chrome.storage.local.get(key, function(result){
    if(chrome.runtime.lastError) {
      throw Error(chrome.runtime.lastError.message);
    } else {
      callback(result[key]);
    }
  });
}
