function beep(props: { volume: number; frequency: number; duration: number }) {
  const audio = new (window.AudioContext ||
    (window as any).webkitAudioContext)();

  const volume = audio.createGain();
  volume.gain.value = props.volume / 100;

  const osc = audio.createOscillator();
  osc.type = "square";
  osc.frequency.value = props.frequency;

  osc.connect(volume);
  volume.connect(audio.destination);
  osc.start();

  setTimeout(() => {
    osc.stop();
  }, props.duration);
}

// listerner
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "playSound") {
    beep({
      volume: message.volume,
      frequency: message.frequency,
      duration: message.duration,
    });
  }
});
