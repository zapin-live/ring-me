// UI
const updateActivationStatus = (isActive) => {
  document.getElementById('activation-toggle').innerText = isActive ? 'Active' : 'Inactive';
  console.log('isActive', isActive);
}

const toggleActive = (newState) => {
    storageSet('isActive', newState, () => {
      updateActivationStatus(newState);
    });
}

// event listeners
document.getElementById('activation-toggle').addEventListener('click', (event) => {
  storageGet('isActive', (isActive) => {
    toggleActive(!isActive);
  });
});


// init
storageGet('isActive', (isActive) => {
  if(isActive === undefined) {
    storageSet('isActive', true, () => {
      updateActivationStatus(true);
    });
  }
  updateActivationStatus(isActive);
});

function storageSet(key, value, callback) {
  chrome.storage.local.set({[key] : value}, function(){
    if(chrome.runtime.lastError) {
      throw Error(chrome.runtime.lastError);
    } else {
      callback();
    }
  });
}

function storageGet(key, callback) {
  chrome.storage.local.get(key, function(result){
    if(chrome.runtime.lastError) {
      throw Error(chrome.runtime.lastError);
    } else {
      callback(result[key]);
    }
  });
}
