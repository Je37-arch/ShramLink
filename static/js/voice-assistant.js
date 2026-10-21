// Voice Assistant for ShramLink
// Uses Web Speech API (SpeechRecognition + SpeechSynthesis)

class ShramLinkVoiceAssistant {
    constructor(options = {}) {
        this.language = options.language || 'hi-IN';
        this.fallbackLanguage = options.fallbackLanguage || 'en-IN';
        this.onTranscript = options.onTranscript || (() => {});
        this.onResponse = options.onResponse || (() => {});
        this.onError = options.onError || (() => {});
        this.onStateChange = options.onStateChange || (() => {});
        
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isSpeaking = false;
        this.commands = new Map();
        
        this.initSpeechRecognition();
        this.registerDefaultCommands();
    }
    
    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported in this browser');
            return;
        }
        
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.language;
        this.recognition.maxAlternatives = 1;
        
        this.recognition.onstart = () => {
            this.isListening = true;
            this.onStateChange('listening');
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            this.onStateChange('idle');
            // Auto-restart if still supposed to be listening
            if (this.shouldContinueListening) {
                setTimeout(() => this.startListening(), 100);
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech' || event.error === 'audio-capture') {
                // Silent errors, just restart
                return;
            }
            this.onError(event.error);
        };
        
        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            if (interimTranscript) {
                this.onTranscript(interimTranscript, false);
            }
            
            if (finalTranscript) {
                this.onTranscript(finalTranscript.trim(), true);
                this.processCommand(finalTranscript.trim());
            }
        };
    }
    
    registerDefaultCommands() {
        // Registration commands
        this.addCommand([
            'register', 'रजिस्टर', 'पंजीकरण', 'साइन अप', 'signup'
        ], () => this.handleRegistration());
        
        // Job search commands
        this.addCommand([
            'jobs', 'नौकरी', 'काम', 'जॉब', 'vacancy', 'vacancies'
        ], () => this.handleJobSearch());
        
        this.addCommand([
            'welder', 'वेल्डर', 'welding'
        ], () => this.handleJobSearch('welder'));
        
        this.addCommand([
            'loader', 'लोडर', 'loading'
        ], () => this.handleJobSearch('loader'));
        
        this.addCommand([
            'electrician', 'इलेक्ट्रीशियन', 'बिजली', 'electric'
        ], () => this.handleJobSearch('electrician'));
        
        this.addCommand([
            'construction', 'कंस्ट्रक्शन', 'निर्माण', 'mason', 'मिस्त्री'
        ], () => this.handleJobSearch('construction'));
        
        this.addCommand([
            'painter', 'पेंटर', 'painting'
        ], () => this.handleJobSearch('painter'));
        
        this.addCommand([
            'helper', 'हेल्पर', 'general labour'
        ], () => this.handleJobSearch('helper'));
        
        // My jobs / applications
        this.addCommand([
            'my jobs', 'मेरे काम', 'my applications', 'मेरे आवेदन', 'status', 'स्थिति'
        ], () => this.handleMyJobs());
        
        // Earnings
        this.addCommand([
            'earnings', 'कमाई', 'पैसा', 'salary', 'वेतन', 'income'
        ], () => this.handleEarnings());
        
        // Help
        this.addCommand([
            'help', 'मदद', 'सहायता', 'what can you do', 'क्या कर सकते हो'
        ], () => this.handleHelp());
        
        // Stop/Exit
        this.addCommand([
            'stop', 'रुको', 'बंद', 'exit', 'quit', 'बाहर'
        ], () => this.handleStop());
        
        // Repeat last
        this.addCommand([
            'repeat', 'दोहराओ', 'फिर से', 'again'
        ], () => this.handleRepeat());
    }
    
    addCommand(keywords, handler) {
        keywords.forEach(keyword => {
            this.commands.set(keyword.toLowerCase(), handler);
        });
    }
    
    startListening() {
        if (!this.recognition) {
            this.onError('Speech recognition not supported');
            return false;
        }
        
        this.shouldContinueListening = true;
        try {
            this.recognition.start();
        } catch (e) {
            console.error('Failed to start recognition:', e);
            this.onError('Failed to start listening');
            return false;
        }
        return true;
    }
    
    stopListening() {
        this.shouldContinueListening = false;
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }
    
    speak(text, lang = null) {
        if (this.isSpeaking) {
            this.synthesis.cancel();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang || this.language;
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // Try to find a Hindi/Indian voice
        const voices = this.synthesis.getVoices();
        const hindiVoice = voices.find(v => 
            v.lang.includes('hi') || v.lang.includes('IN') || 
            v.name.toLowerCase().includes('hindi') ||
            v.name.toLowerCase().includes('india')
        );
        if (hindiVoice) {
            utterance.voice = hindiVoice;
        }
        
        utterance.onstart = () => {
            this.isSpeaking = true;
            this.onStateChange('speaking');
        };
        
        utterance.onend = () => {
            this.isSpeaking = false;
            this.onStateChange(this.isListening ? 'listening' : 'idle');
        };
        
        utterance.onerror = (e) => {
            console.error('Speech synthesis error:', e);
            this.isSpeaking = false;
        };
        
        this.synthesis.speak(utterance);
    }
    
    processCommand(transcript) {
        const lower = transcript.toLowerCase();
        console.log('Processing command:', transcript);
        
        // Check for exact matches first
        for (const [keyword, handler] of this.commands) {
            if (lower.includes(keyword)) {
                handler(transcript);
                return;
            }
        }
        
        // No match - provide helpful response
        this.handleUnknown(transcript);
    }
    
    // Command Handlers
    handleRegistration() {
        this.speak('रजिस्ट्रेशन के लिए, मुझे आपका नाम, उम्र, फोन नंबर और कौशल बताएं। आप एक-एक करके बोल सकते हैं।');
        // Could trigger registration flow
        this.onResponse({ action: 'start_registration', transcript: 'registration' });
    }
    
    handleJobSearch(skill = null) {
        if (skill) {
            this.speak(`${this.getSkillHindi(skill)} के काम ढूंढ रहा हूं।`);
        } else {
            this.speak('आपके आस-पास के सभी काम दिखा रहा हूं।');
        }
        this.onResponse({ action: 'search_jobs', skill });
    }
    
    handleMyJobs() {
        this.speak('आपके आवेदन और चुने गए काम दिखा रहा हूं।');
        this.onResponse({ action: 'show_my_jobs' });
    }
    
    handleEarnings() {
        this.speak('इस हफ्ते की कमाई दिखा रहा हूं।');
        this.onResponse({ action: 'show_earnings' });
    }
    
    handleHelp() {
        const helpText = `मैं आपकी इन चीजों में मदद कर सकता हूं:
        1. रजिस्ट्रेशन - "रजिस्टर करो"
        2. काम ढूंढो - "नौकरी दिखाओ" या "वेल्डर का काम"
        3. मेरे आवेदन - "मेरे काम दिखाओ"
        4. कमाई देखो - "कमाई बताओ"
        5. मदद - "मदद करो"
        
        बस बोलें और मैं समझ जाऊंगा।`;
        this.speak(helpText);
    }
    
    handleStop() {
        this.speak('ठीक है, मैं सुनना बंद करता हूं। जब जरूरत हो, फिर बुला लेना।');
        this.stopListening();
    }
    
    handleRepeat() {
        this.speak('पिछला जवाब दोहरा रहा हूं।');
        // Could store last response and repeat
    }
    
    handleUnknown(transcript) {
        const responses = [
            'समझ नहीं आया। "मदद" बोलें ताकि मैं बता सकूं क्या कर सकता हूं।',
            'फिर से बोलें? आप "नौकरी", "रजिस्टर", या "मेरे काम" कह सकते हैं।',
            'माफ करें, मैं समझ नहीं पाया। कृपया दोहराएं।'
        ];
        const response = responses[Math.floor(Math.random() * responses.length)];
        this.speak(response);
    }
    
    getSkillHindi(skill) {
        const skills = {
            'welder': 'वेल्डर',
            'construction': 'निर्माण',
            'loader': 'लोडर',
            'electrician': 'बिजली मिस्त्री',
            'painter': 'पेंटर',
            'helper': 'हेल्पर'
        };
        return skills[skill] || skill;
    }
    
    // Check if voices are loaded
    static waitForVoices() {
        return new Promise(resolve => {
            if (window.speechSynthesis.getVoices().length > 0) {
                resolve();
            } else {
                window.speechSynthesis.onvoiceschanged = () => resolve();
            }
        });
    }
}

// Voice Assistant UI Component
function createVoiceAssistantUI(assistant) {
    const container = document.createElement('div');
    container.id = 'voice-assistant';
    container.innerHTML = `
        <style>
            #voice-assistant {
                position: fixed;
                bottom: 90px;
                right: 20px;
                z-index: 1000;
                font-family: 'Noto Sans', system-ui, sans-serif;
            }
            .va-button {
                width: 64px;
                height: 64px;
                border-radius: 50%;
                background: linear-gradient(135deg, #059669, #047857);
                border: none;
                box-shadow: 0 4px 20px rgba(5, 150, 105, 0.4);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            .va-button:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 25px rgba(5, 150, 105, 0.5);
            }
            .va-button.listening {
                background: linear-gradient(135deg, #dc2626, #b91c1c);
                animation: va-pulse 1.5s infinite;
            }
            .va-button.speaking {
                background: linear-gradient(135deg, #2563eb, #1d4ed8);
            }
            @keyframes va-pulse {
                0%, 100% { box-shadow: 0 4px 20px rgba(220, 38, 38, 0.4); }
                50% { box-shadow: 0 6px 30px rgba(220, 38, 38, 0.6); }
            }
            .va-button svg {
                width: 28px;
                height: 28px;
                color: white;
            }
            .va-panel {
                position: absolute;
                bottom: 80px;
                right: 0;
                width: 320px;
                max-height: 400px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                border: 1px solid #e5e7eb;
                display: none;
                flex-direction: column;
                overflow: hidden;
            }
            .va-panel.open {
                display: flex;
                animation: va-slide-up 0.3s ease;
            }
            @keyframes va-slide-up {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .va-header {
                padding: 16px;
                background: linear-gradient(135deg, #059669, #047857);
                color: white;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .va-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: rgba(255,255,255,0.2);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .va-title {
                font-weight: 700;
                font-size: 16px;
            }
            .va-subtitle {
                font-size: 12px;
                opacity: 0.9;
            }
            .va-status {
                padding: 8px 16px;
                font-size: 13px;
                font-weight: 600;
                text-align: center;
                background: #f9fafb;
                border-bottom: 1px solid #e5e7eb;
            }
            .va-status.listening { background: #fef2f2; color: #dc2626; }
            .va-status.speaking { background: #eff6ff; color: #2563eb; }
            .va-transcript {
                padding: 12px 16px;
                max-height: 150px;
                overflow-y: auto;
                font-size: 14px;
                line-height: 1.5;
            }
            .va-transcript .user { color: #111827; font-weight: 600; }
            .va-transcript .assistant { color: #059669; font-weight: 600; }
            .va-suggestions {
                padding: 8px 16px;
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                border-top: 1px solid #e5e7eb;
            }
            .va-suggestion {
                padding: 6px 12px;
                background: #f3f4f6;
                border-radius: 20px;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s;
            }
            .va-suggestion:hover {
                background: #e5e7eb;
            }
            .va-close {
                position: absolute;
                top: 8px;
                right: 8px;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: rgba(0,0,0,0.1);
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
        </style>
        <button class="va-button" id="va-toggle" aria-label="Voice Assistant">
            <svg id="va-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 19v3"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <rect x="9" y="2" width="6" height="13" rx="3"></rect>
            </svg>
        </button>
        <div class="va-panel" id="va-panel">
            <button class="va-close" id="va-close" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="va-header">
                <div class="va-avatar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M12 19v3"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        <rect x="9" y="2" width="6" height="13" rx="3"></rect>
                    </svg>
                </div>
                <div>
                    <div class="va-title">ShramLink सहायक</div>
                    <div class="va-subtitle">बोलकर काम करें</div>
                </div>
            </div>
            <div class="va-status" id="va-status">तैयार - बटन दबाकर बोलें</div>
            <div class="va-transcript" id="va-transcript"></div>
            <div class="va-suggestions" id="va-suggestions">
                <span class="va-suggestion" data-cmd="नौकरी दिखाओ">🔍 नौकरी दिखाओ</span>
                <span class="va-suggestion" data-cmd="रजिस्टर करो">📝 रजिस्टर करो</span>
                <span class="va-suggestion" data-cmd="मेरे काम">📋 मेरे काम</span>
                <span class="va-suggestion" data-cmd="कमाई बताओ">💰 कमाई बताओ</span>
            </div>
        </div>
    `;
    
    document.body.appendChild(container);
    
    const toggleBtn = container.querySelector('#va-toggle');
    const panel = container.querySelector('#va-panel');
    const closeBtn = container.querySelector('#va-close');
    const statusEl = container.querySelector('#va-status');
    const transcriptEl = container.querySelector('#va-transcript');
    const suggestionsEl = container.querySelector('#va-suggestions');
    
    let panelOpen = false;
    
    toggleBtn.addEventListener('click', () => {
        if (panelOpen) {
            closePanel();
        } else {
            openPanel();
            if (!assistant.isListening) {
                assistant.startListening();
            }
        }
    });
    
    closeBtn.addEventListener('click', closePanel);
    
    // Click outside to close
    document.addEventListener('click', (e) => {
        if (panelOpen && !container.contains(e.target)) {
            closePanel();
        }
    });
    
    // Suggestion chips
    suggestionsEl.addEventListener('click', (e) => {
        const chip = e.target.closest('.va-suggestion');
        if (chip) {
            const cmd = chip.dataset.cmd;
            assistant.processCommand(cmd);
            addTranscript('आप', cmd);
        }
    });
    
    // Hook into assistant events
    assistant.onStateChange = (state) => {
        toggleBtn.classList.remove('listening', 'speaking');
        if (state === 'listening') {
            toggleBtn.classList.add('listening');
            statusEl.textContent = 'सुन रहा हूं... बोलें';
            statusEl.className = 'va-status listening';
        } else if (state === 'speaking') {
            toggleBtn.classList.add('speaking');
            statusEl.textContent = 'बोल रहा हूं...';
            statusEl.className = 'va-status speaking';
        } else {
            statusEl.textContent = panelOpen ? 'तैयार - बटन दबाकर बोलें' : 'तैयार';
            statusEl.className = 'va-status';
        }
    };
    
    const originalOnTranscript = assistant.onTranscript;
    assistant.onTranscript = (text, isFinal) => {
        originalOnTranscript(text, isFinal);
        if (isFinal) {
            addTranscript('आप', text);
        } else {
            // Show interim
            updateLastTranscript('आप', text + '...');
        }
    };
    
    const originalOnResponse = assistant.onResponse;
    assistant.onResponse = (response) => {
        originalOnResponse(response);
        if (response.spokenText) {
            addTranscript('सहायक', response.spokenText);
        }
    };
    
    function addTranscript(sender, text) {
        const div = document.createElement('div');
        div.style.marginBottom = '8px';
        div.innerHTML = `<span class="${sender === 'आप' ? 'user' : 'assistant'}">${sender}:</span> ${text}`;
        transcriptEl.appendChild(div);
        transcriptEl.scrollTop = transcriptEl.scrollHeight;
    }
    
    function updateLastTranscript(sender, text) {
        const children = transcriptEl.children;
        if (children.length > 0) {
            const last = children[children.length - 1];
            if (last.textContent.startsWith(sender + ':')) {
                last.innerHTML = `<span class="${sender === 'आप' ? 'user' : 'assistant'}">${sender}:</span> ${text}`;
            }
        }
    }
    
    function openPanel() {
        panel.classList.add('open');
        panelOpen = true;
        toggleBtn.setAttribute('aria-expanded', 'true');
    }
    
    function closePanel() {
        panel.classList.remove('open');
        panelOpen = false;
        toggleBtn.setAttribute('aria-expanded', 'false');
    }
    
    return container;
}

// Auto-initialize on laborer dashboard
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for voices to load
    await ShramLinkVoiceAssistant.waitForVoices();
    
    // Check if we're on laborer dashboard
    if (document.getElementById('laborer-main') || window.location.pathname.includes('/laborer')) {
        const assistant = new ShramLinkVoiceAssistant({
            language: 'hi-IN',
            onTranscript: (text, isFinal) => {
                console.log('Transcript:', text, isFinal);
            },
            onResponse: (response) => {
                console.log('Response:', response);
            },
            onError: (error) => {
                console.error('Voice error:', error);
            },
            onStateChange: (state) => {
                console.log('State:', state);
            }
        });
        
        createVoiceAssistantUI(assistant);
        
        // Make globally accessible
        window.shramLinkVoiceAssistant = assistant;
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShramLinkVoiceAssistant, createVoiceAssistantUI };
}