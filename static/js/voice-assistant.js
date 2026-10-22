/* ShramLink Hindi profile assistant. Bounded state machine, no AI service.
 * Audio states: idle -> speaking OR listening -> idle.
 * Profile states: answer -> confirm-answer -> next question -> review -> submit.
 * Every microphone session requires a user gesture. No automatic restarts.
 */
(function (root) {
  "use strict";
  const NUMBER_WORDS =
    "शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उनासी अस्सी".split(
      " ",
    );
  const NUMBER_ALIASES = {
    जीरो: 0,
    ज़ीरो: 0,
    पांच: 5,
    छः: 6,
    छे: 6,
    पन्द्रह: 15,
    अठ्ठाईस: 28,
    अड़तीस: 38,
    अड़तालीस: 48,
    अड़तालिस: 48,
  };
  const SKILLS = {
    welder: ["वेल्डर", "वेल्डिंग", "welder", "welding"],
    construction: [
      "निर्माण",
      "राजमिस्त्री",
      "राज मिस्त्री",
      "कंस्ट्रक्शन",
      "construction",
      "mason",
    ],
    loader: ["लोडर", "लोडिंग", "loader", "loading"],
    electrician: [
      "बिजली",
      "इलेक्ट्रीशियन",
      "इलेक्ट्रिशियन",
      "electrician",
      "electrical",
    ],
    painter: ["पेंटर", "पेंटिंग", "रंगाई", "painter", "painting"],
    helper: ["हेल्पर", "सहायक", "helper", "मददगार"],
  };
  const DOMAINS = {
    manufacturing: [
      "कारखाना",
      "फैक्ट्री",
      "फ़ैक्ट्री",
      "मैन्युफैक्चरिंग",
      "manufacturing",
      "factory",
    ],
    construction: ["निर्माण", "कंस्ट्रक्शन", "construction"],
    warehouse: ["गोदाम", "वेयरहाउस", "warehouse"],
    maintenance: ["रखरखाव", "मेंटेनेंस", "maintenance"],
  };
  const CITIES = {
    "Greater Noida": ["ग्रेटर नोएडा", "greater noida"],
    Delhi: ["दिल्ली", "delhi"],
    Noida: ["नोएडा", "noida"],
    Ghaziabad: ["गाजियाबाद", "गाज़ियाबाद", "ghaziabad"],
    Faridabad: ["फरीदाबाद", "फ़रीदाबाद", "faridabad"],
    Gurugram: [
      "गुरुग्राम",
      "गुड़गांव",
      "गुड़गाँव",
      "गुड़गांव",
      "gurugram",
      "gurgaon",
    ],
  };
  const STEPS = [
    { key: "name", label: "नाम", question: "आपका पूरा नाम क्या है?" },
    {
      key: "age",
      label: "उम्र",
      question: "आपकी उम्र कितनी है? पूरे वर्ष में बताएँ।",
    },
    {
      key: "skills",
      label: "कौशल",
      question:
        "आपको कौन सा काम आता है? वेल्डर, निर्माण मिस्त्री, लोडर, बिजली मिस्त्री, पेंटर या हेल्पर। एक से अधिक बता सकते हैं।",
    },
    {
      key: "preferred_domain",
      label: "काम का क्षेत्र",
      question:
        "आप किस क्षेत्र में काम करना चाहते हैं? कारखाना, निर्माण, गोदाम या रखरखाव।",
    },
    {
      key: "experience_years",
      label: "अनुभव",
      question:
        "आपको कितने पूरे वर्ष का अनुभव है? नए हैं तो शून्य कहें। अठारह वर्ष की उम्र के बाद का अनुभव बताएँ।",
    },
    {
      key: "location",
      label: "शहर",
      question:
        "किस शहर में काम चाहिए? दिल्ली, नोएडा, ग्रेटर नोएडा, गाज़ियाबाद, फ़रीदाबाद या गुरुग्राम।",
    },
    {
      key: "eshram_number",
      label: "e-Shram ID",
      question:
        "आपका बारह अंकों का ई श्रम नंबर क्या है? यह ज़रूरी नहीं है। नहीं देना चाहते तो छोड़ें कहें।",
      optional: true,
    },
  ];
  function normalize(text) {
    return String(text)
      .normalize("NFC")
      .toLowerCase()
      .replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - 0x0966))
      .replace(/[।.!?,;:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function number(text) {
    let value = normalize(text)
      .replace(
        /^(मेरी उम्र|मेरी आयु|उम्र|आयु|मुझे|मेरा अनुभव|मैं|लगभग)\s*/u,
        "",
      )
      .replace(
        /\s*(साल|वर्ष|की उम्र|का अनुभव|अनुभव|है|हूँ|हूं|years|year|old|का|की)\s*/gu,
        " ",
      )
      .trim();
    if (/^\d{1,2}$/.test(value)) return Number(value);
    if (Object.hasOwn(NUMBER_ALIASES, value)) return NUMBER_ALIASES[value];
    const index = NUMBER_WORDS.indexOf(value);
    return index < 0 ? null : index;
  }
  function choices(text, dictionary) {
    const value = normalize(text);
    return Object.keys(dictionary).filter((key) =>
      dictionary[key].some((alias) => value.includes(alias)),
    );
  }
  function idDigits(text) {
    const value = normalize(text).replace(/[-\s]/g, "");
    if (/^\d{12}$/.test(value)) return value;
    const pieces = normalize(text)
      .split(" ")
      .map((piece) => (/^\d$/.test(piece) ? Number(piece) : number(piece)));
    return pieces.length === 12 &&
      pieces.every((n) => n !== null && n >= 0 && n <= 9)
      ? pieces.join("")
      : null;
  }
  function parse(key, text) {
    if (key === "age" || key === "experience_years") return number(text);
    if (key === "skills") return choices(text, SKILLS);
    if (key === "preferred_domain") return choices(text, DOMAINS)[0] || null;
    if (key === "location") return choices(text, CITIES)[0] || null;
    if (key === "eshram_number") return idDigits(text);
    return String(text)
      .trim()
      .replace(/^(मेरा नाम|नाम|मैं)\s+/u, "")
      .replace(/\s+(है|हूँ|हूं)[।.!]?$/u, "")
      .trim()
      .replace(/[।.!]$/u, "");
  }
  const ERRORS = {
    "not-allowed":
      "माइक की अनुमति नहीं मिली। ब्राउज़र की साइट सेटिंग में अनुमति दें या जवाब टाइप करें।",
    "service-not-allowed":
      "इस ब्राउज़र में आवाज़ की सेवा उपलब्ध नहीं है। जवाब टाइप करें।",
    "audio-capture": "माइक्रोफ़ोन नहीं मिला। माइक जोड़ें या जवाब टाइप करें।",
    "no-speech": "कोई आवाज़ नहीं मिली। फिर से माइक दबाएँ या जवाब टाइप करें।",
    network:
      "आवाज़ पहचानने की सेवा से संपर्क नहीं हुआ। इंटरनेट जाँचें या जवाब टाइप करें।",
    "language-not-supported":
      "हिंदी आवाज़ पहचान उपलब्ध नहीं है। जवाब टाइप करें।",
    aborted: "सुनना रोक दिया। फिर से माइक दबाएँ या टाइप करें।",
  };

  class ShramLinkVoiceAssistant {
    constructor(win, doc) {
      this.win = win;
      this.doc = doc;
      this.form = doc.getElementById("profile-form");
      this.recognitionClass =
        win.SpeechRecognition || win.webkitSpeechRecognition;
      this.synthesis = win.speechSynthesis;
      this.mode = "typed";
      this.phase = "answer";
      this.index = 0;
      this.recognition = null;
      this.audioToken = 0;
      this.timers = [];
      this.el = {};
      [
        "start-voice",
        "typed-mode",
        "speech-support",
        "voice-panel",
        "voice-progress",
        "voice-state",
        "step-progress",
        "voice-question",
        "voice-status",
        "voice-transcript",
        "listen",
        "repeat",
        "stop-voice",
        "voice-next-controls",
        "previous",
        "skip",
        "next",
        "confirmation",
        "confirmed",
        "save-profile",
        "save-status",
      ].forEach((id) => (this.el[id] = doc.getElementById(id)));
      this.groups = Array.from(this.form.querySelectorAll("[data-step]"));
      this.el["start-voice"].hidden = false;
      this.el["typed-mode"].hidden = false;
      this.el["start-voice"].disabled =
        !this.recognitionClass || !win.isSecureContext;
      this.el["speech-support"].textContent = !win.isSecureContext
        ? "माइक के लिए HTTPS या localhost चाहिए। नीचे टाइप करके पूरा करें।"
        : !this.recognitionClass
          ? "यह ब्राउज़र आवाज़ पहचान नहीं करता। नीचे टाइप करके पूरा फ़ॉर्म भरें।"
          : "माइक समर्थित है। हिंदी की आवाज़ आपके ब्राउज़र और डिवाइस पर निर्भर है। टाइपिंग हमेशा उपलब्ध है।";
      this.el["start-voice"].addEventListener("click", () => this.start());
      this.el["typed-mode"].addEventListener("click", () => this.typed());
      this.el.listen.addEventListener("click", () => this.listen());
      this.el.repeat.addEventListener("click", () => this.repeat());
      this.el["stop-voice"].addEventListener("click", () => {
        this.stopAudio();
        this.message("आवाज़ रोक दी। जवाब लिखें या माइक फिर दबाएँ।");
      });
      this.el.previous.addEventListener("click", () => this.back());
      this.el.next.addEventListener("click", () => this.next());
      this.el.skip.addEventListener("click", () => this.skip());
      this.form.addEventListener("input", (event) => {
        if (event.target.name !== "confirmed") {
          this.el.confirmed.checked = false;
          this.phase = this.index === STEPS.length ? "review" : "answer";
        }
      });
      this.form.addEventListener("keydown", (event) => {
        if (
          this.mode === "voice" &&
          this.phase !== "review" &&
          event.key === "Enter" &&
          event.target.matches("input,select")
        ) {
          event.preventDefault();
          this.next();
        }
      });
      this.form.addEventListener("submit", (event) => {
        if (this.mode === "voice" && this.phase !== "review") {
          event.preventDefault();
          this.next();
          return;
        }
        if (this.phase === "submitting") {
          event.preventDefault();
          return;
        }
        if (!this.form.querySelector('[name="skills"]:checked')) {
          event.preventDefault();
          this.typed();
          this.el["save-status"].textContent = "कम से कम एक कौशल चुनें।";
          this.doc.getElementById("skills").scrollIntoView();
          return;
        }
        this.stopAudio();
        this.phase = "submitting";
        this.el["save-status"].textContent = "जानकारी सेव हो रही है…";
        this.form.setAttribute("aria-busy", "true");
      });
      win.addEventListener("pagehide", () => this.stopAudio());
      win.addEventListener("pageshow", () => {
        if (this.phase === "submitting") {
          this.phase = this.mode === "voice" ? "review" : "answer";
          this.form.removeAttribute("aria-busy");
          this.el["save-profile"].removeAttribute("aria-busy");
          this.el["save-status"].textContent = "";
        }
      });
      doc.addEventListener("visibilitychange", () => {
        if (doc.hidden) this.stopAudio();
      });
      if (this.synthesis && this.synthesis.addEventListener)
        this.synthesis.addEventListener("voiceschanged", () =>
          this.voiceAvailability(),
        );
      this.voiceAvailability();
    }
    message(text) {
      this.el["voice-status"].textContent = text;
    }
    setAudio(state) {
      this.el["voice-state"].textContent = {
        idle: "तैयार",
        speaking: "बोल रहा है",
        listening: "सुन रहा है",
      }[state];
      this.el.listen.disabled = state === "listening";
    }
    voiceAvailability() {
      if (!this.synthesis || !this.win.SpeechSynthesisUtterance) {
        this.el["speech-support"].textContent +=
          " सवाल सुनाने की सुविधा नहीं है; सवाल स्क्रीन पर पढ़ें।";
        return;
      }
      // Voices can arrive later. Never block onboarding waiting for this event.
      this.hindiVoice = this.synthesis
        .getVoices()
        .find((v) => /^hi(?:-|_)/i.test(v.lang) || v.lang === "hi");
    }
    stopAudio() {
      this.audioToken += 1;
      this.timers.forEach((timer) => this.win.clearTimeout(timer));
      this.timers = [];
      if (this.recognition) {
        const old = this.recognition;
        this.recognition = null;
        try {
          old.abort();
        } catch (e) {
          /* already stopped */
        }
      }
      if (this.synthesis) {
        try {
          this.synthesis.cancel();
        } catch (e) {
          /* typed input remains available */
        }
      }
      this.setAudio("idle");
    }
    speak(text) {
      this.stopAudio();
      if (!this.synthesis || !this.win.SpeechSynthesisUtterance) {
        this.message(
          "सवाल सुनाना उपलब्ध नहीं है। स्क्रीन से पढ़ें या टाइप करें।",
        );
        return;
      }
      this.voiceAvailability();
      const token = this.audioToken,
        utterance = new this.win.SpeechSynthesisUtterance(text);
      utterance.lang = "hi-IN";
      utterance.rate = 0.88;
      if (this.hindiVoice) utterance.voice = this.hindiVoice;
      this.setAudio("speaking");
      const finish = (failed) => {
        if (token !== this.audioToken) return;
        this.stopAudio();
        if (failed)
          this.message(
            "हिंदी आवाज़ नहीं चल पाई। सवाल स्क्रीन पर है। जवाब बोलें या टाइप करें।",
          );
      };
      utterance.onend = () => finish(false);
      utterance.onerror = () => finish(true);
      this.timers.push(this.win.setTimeout(() => finish(true), 18000));
      try {
        this.synthesis.speak(utterance);
      } catch (e) {
        finish(true);
      }
    }
    start() {
      this.mode = "voice";
      this.index = 0;
      this.el.confirmed.checked = false;
      this.render();
    }
    typed() {
      this.stopAudio();
      this.mode = "typed";
      this.form.noValidate = false;
      this.groups.forEach((g) => (g.hidden = false));
      this.el["voice-panel"].hidden = true;
      this.el["voice-next-controls"].hidden = true;
      this.el.confirmation.hidden = false;
      this.el["save-status"].textContent = "सभी जवाब नीचे लिख या बदल सकते हैं।";
      this.doc.getElementById("name").focus();
    }
    render() {
      this.stopAudio();
      this.phase = this.index >= STEPS.length ? "review" : "answer";
      const review = this.phase === "review";
      this.form.noValidate = !review;
      this.el["voice-panel"].hidden = false;
      this.el["voice-next-controls"].hidden = review;
      this.el.confirmation.hidden = !review;
      this.groups.forEach(
        (g) => (g.hidden = !review && g.dataset.step !== STEPS[this.index].key),
      );
      this.el["voice-progress"].textContent = review
        ? "आखिरी कदम · जानकारी जाँचें"
        : `सवाल ${this.index + 1} / ${STEPS.length}`;
      this.el["step-progress"].value = review ? STEPS.length : this.index + 1;
      this.el["voice-question"].textContent = review
        ? "आपकी जानकारी तैयार है। नीचे सब जाँच लें।"
        : STEPS[this.index].question;
      this.el.previous.disabled = this.index === 0;
      this.el.skip.hidden = review || !STEPS[this.index].optional;
      this.el.listen.textContent = review ? "◉ पुष्टि बोलें" : "◉ जवाब बोलें";
      this.el["voice-transcript"].textContent = "";
      this.message(
        review
          ? "बदलना हो तो नीचे फ़ील्ड बदलें या “नाम बदलें” जैसे शब्द बोलें। सेव करने के लिए “सेव करें” कहें या पुष्टि का बॉक्स चुनें।"
          : "माइक दबाकर जवाब दें। लिखकर भी जवाब बदल सकते हैं।",
      );
      this.el["voice-question"].focus();
      this.repeat();
    }
    repeat() {
      const question =
        this.phase === "review"
          ? "सारी जानकारी नीचे देख लें। गलत हो तो फ़ील्ड बदलें। पुष्टि के बाद सेव करने के लिए माइक दबाकर सेव करें कहें।"
          : STEPS[this.index]?.question;
      if (question) this.speak(question);
    }
    value(key) {
      if (key === "skills")
        return Array.from(
          this.form.querySelectorAll('[name="skills"]:checked'),
        ).map((el) => el.value);
      return this.form.elements[key].value.trim();
    }
    validStep() {
      const key = STEPS[this.index].key,
        value = this.value(key),
        group = this.groups[this.index];
      if (key === "skills" && !value.length) {
        this.message("कम से कम एक कौशल चुनें या बोलें।");
        return false;
      }
      if (
        key === "eshram_number" &&
        value &&
        !/^\d{12}$/.test(value.replace(/[\s-]/g, ""))
      ) {
        this.message("e-Shram में 12 अंक लिखें या यह सवाल छोड़ें।");
        return false;
      }
      if (key === "name" && value.length < 2) {
        this.message("पूरा नाम लिखें या फिर बोलें।");
        return false;
      }
      if (
        key === "experience_years" &&
        Number(value) > Number(this.value("age")) - 18
      ) {
        this.message("18 वर्ष की उम्र के बाद का अनुभव बताएँ।");
        return false;
      }
      for (const control of group.querySelectorAll("input,select"))
        if (!control.checkValidity()) {
          control.reportValidity();
          this.message("जवाब सही नहीं है। फ़ील्ड जाँचें या फिर बोलें।");
          return false;
        }
      return true;
    }
    next() {
      if (this.index >= STEPS.length) return;
      if (this.validStep()) {
        this.index += 1;
        this.render();
      }
    }
    back() {
      this.index = Math.max(0, Math.min(STEPS.length - 1, this.index - 1));
      this.render();
    }
    skip() {
      if (STEPS[this.index]?.optional) {
        this.form.elements.eshram_number.value = "";
        this.next();
      } else {
        this.message("यह सवाल ज़रूरी है। जवाब दें या टाइप करें।");
      }
    }
    listen() {
      this.stopAudio();
      if (!this.recognitionClass || !this.win.isSecureContext) {
        this.message("माइक उपलब्ध नहीं है। नीचे जवाब टाइप करें।");
        return;
      }
      let recognition;
      try {
        recognition = new this.recognitionClass();
      } catch (e) {
        this.message("आवाज़ की सेवा शुरू नहीं हुई। जवाब टाइप करें।");
        return;
      }
      this.recognition = recognition;
      recognition.lang = "hi-IN";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      this.setAudio("listening");
      this.message("सुन रहे हैं… अब बोलें।");
      this.el["voice-transcript"].textContent = "";
      const active = () =>
        this.recognition === recognition && this.mode === "voice";
      const failed = (code) => {
        if (!active()) return;
        this.stopAudio();
        this.message(
          ERRORS[code] || "जवाब समझ नहीं आया। फिर बोलें या नीचे लिखें।",
        );
      };
      recognition.onerror = (event) => failed(event.error);
      recognition.onend = () => failed("no-speech");
      recognition.onresult = (event) => {
        if (!active()) return;
        let final = "",
          interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += text;
          else interim += text;
        }
        if (interim)
          this.el["voice-transcript"].textContent =
            STEPS[this.index]?.key === "eshram_number"
              ? "अंक सुन रहे हैं…"
              : interim;
        if (final.trim()) {
          this.stopAudio();
          this.receive(final.trim());
        }
      };
      this.timers.push(this.win.setTimeout(() => failed("no-speech"), 10000));
      try {
        recognition.start();
      } catch (e) {
        failed("audio-capture");
      }
    }
    receive(raw) {
      if (this.phase === "submitting") return;
      const command = normalize(raw);
      if (
        [
          "दोहराएँ",
          "दोहराएं",
          "दोहराओ",
          "फिर से",
          "फिर सुनें",
          "repeat",
        ].includes(command)
      ) {
        this.repeat();
        return;
      }
      if (["पीछे", "पिछला", "वापस", "back"].includes(command)) {
        this.back();
        return;
      }
      if (["रुको", "बंद करो", "stop"].includes(command)) {
        this.stopAudio();
        this.message("आवाज़ रोक दी।");
        return;
      }
      if (
        ["छोड़ें", "छोड़ो", "छोड़ दें", "नहीं है", "skip", "स्किप"].includes(
          command,
        )
      ) {
        this.skip();
        return;
      }
      const correction = STEPS.findIndex(
        (step) =>
          command.includes(step.label.toLowerCase()) &&
          /(बदल|ठीक)/u.test(command),
      );
      if (correction >= 0) {
        this.index = correction;
        this.render();
        return;
      }
      const yes = [
        "हाँ",
        "हां",
        "जी हाँ",
        "जी हां",
        "सही है",
        "आगे",
        "yes",
        "सेव करें",
        "सेव करो",
        "save",
      ].includes(command);
      if (this.phase === "review") {
        if (yes) {
          this.el.confirmed.checked = true;
          this.form.requestSubmit(this.el["save-profile"]);
        } else
          this.message(
            "किसी फ़ील्ड में बदलाव करें, या सेव करने के लिए “सेव करें” कहें।",
          );
        return;
      }
      if (yes) {
        this.next();
        return;
      }
      if (["गलत है", "बदलें", "नहीं", "no"].includes(command)) {
        this.phase = "answer";
        this.message("जवाब फिर बोलें या फ़ील्ड में बदलें।");
        this.speak(STEPS[this.index].question);
        return;
      }
      const step = STEPS[this.index],
        value = parse(step.key, raw);
      if (
        value === null ||
        value === "" ||
        (Array.isArray(value) && !value.length)
      ) {
        this.message("जवाब समझ नहीं आया। नीचे दिए विकल्प चुनें या फिर बोलें।");
        return;
      }
      if (step.key === "skills")
        this.form
          .querySelectorAll('[name="skills"]')
          .forEach((el) => (el.checked = value.includes(el.value)));
      else this.form.elements[step.key].value = value;
      this.el.confirmed.checked = false;
      this.el["voice-transcript"].textContent =
        step.key === "eshram_number"
          ? "नंबर फ़ील्ड में भरा है। कृपया जाँचें।"
          : `आपने कहा: ${raw}`;
      if (!this.validStep()) return;
      this.phase = "confirm-answer";
      const control = this.form.elements[step.key];
      let answer = Array.isArray(value)
        ? Array.from(this.form.querySelectorAll('[name="skills"]:checked'))
            .map((el) => el.closest("label").textContent.trim())
            .join(", ")
        : control.tagName === "SELECT"
          ? control.selectedOptions[0].textContent
          : value;
      if (step.key === "eshram_number")
        answer = `आखिरी चार अंक ${String(value).slice(-4).split("").join(" ")}`;
      this.message(
        `जवाब जाँचें: ${answer}। सही है तो “आगे” बटन दबाएँ या माइक दबाकर “हाँ” कहें।`,
      );
      this.speak(
        `आपका जवाब है, ${answer}। सही हो तो माइक दबाकर हाँ कहें। गलत हो तो दोबारा जवाब दें।`,
      );
    }
  }
  if (typeof module !== "undefined" && module.exports)
    module.exports = {
      normalize,
      number,
      idDigits,
      parse,
      STEPS,
      ShramLinkVoiceAssistant,
    };
  if (root && root.document)
    root.document.addEventListener("DOMContentLoaded", () => {
      if (root.document.getElementById("profile-form"))
        root.shramLinkVoiceAssistant = new ShramLinkVoiceAssistant(
          root,
          root.document,
        );
    });
})(typeof window !== "undefined" ? window : null);
