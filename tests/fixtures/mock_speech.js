// Test adapter only. It exercises browser events, NOT real audio recognition.
window.__speech = {
  last: null,
  spoken: [],
  starts: 0,
  startError: false,
  ttsError: false,
  noVoices: false,
};
class MockRecognition {
  start() {
    if (window.__speech.startError)
      throw new Error("Mock microphone unavailable");
    window.__speech.last = this;
    window.__speech.starts += 1;
    if (this.onstart) this.onstart();
  }
  abort() {
    if (this.onend) queueMicrotask(() => this.onend());
  }
}
Object.defineProperty(window, "SpeechRecognition", {
  configurable: true,
  value: MockRecognition,
});
Object.defineProperty(window, "webkitSpeechRecognition", {
  configurable: true,
  value: undefined,
});
Object.defineProperty(window, "SpeechSynthesisUtterance", {
  configurable: true,
  value: class {
    constructor(text) {
      this.text = text;
    }
  },
});
Object.defineProperty(window, "speechSynthesis", {
  configurable: true,
  value: {
    getVoices() {
      return window.__speech.noVoices
        ? []
        : [{ name: "Mock Hindi voice", lang: "hi-IN" }];
    },
    cancel() {},
    addEventListener() {},
    speak(utterance) {
      window.__speech.spoken.push({
        text: utterance.text,
        lang: utterance.lang,
      });
      queueMicrotask(() => {
        if (window.__speech.ttsError)
          utterance.onerror?.({ error: "synthesis-failed" });
        else utterance.onend?.();
      });
    },
  },
});
window.__speech.result = (text) => {
  const result = [{ transcript: text }];
  result.isFinal = true;
  window.__speech.last.onresult({ resultIndex: 0, results: [result] });
};
window.__speech.error = (code) => window.__speech.last.onerror({ error: code });
