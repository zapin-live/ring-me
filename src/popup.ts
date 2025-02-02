import { storageGet, storageSet } from "./helpers/storage";

// UI
const activationToggle = document.getElementById('activation-toggle')
if (!activationToggle) {
  throw Error('Could not find activation-toggle');
}

const updateActivationStatus = (isActive: boolean) => {
  activationToggle.innerText = isActive ? 'Active' : 'Inactive';
}

const toggleActive = (newState: boolean) => {
    storageSet('isActive', newState, () => {
      updateActivationStatus(newState);
    });
}

// event listeners
activationToggle.addEventListener('click', () => {
  storageGet('isActive', (isActive: boolean) => {
    toggleActive(!isActive);
  });
});


