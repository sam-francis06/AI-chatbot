import { GoogleGenAI } from "@google/genai";

// --- STATE MANAGEMENT ---
const state = {
    theme: localStorage.getItem('theme') || 'light',
    messages: [],
    bookmarks: JSON.parse(localStorage.getItem('bookmarks')) || [],
    isRecording: false,
};

// --- CONSTANTS ---
const API_KEY = process.env.API_KEY;
const CHATBOT_NAME = "Cyber Law Bot";
const SYSTEM_INSTRUCTION = "You are an expert on Indian Cyber Law. Provide clear, concise, and accurate information based on the latest legal frameworks in India. Do not provide legal advice, but rather educational and informative responses. Structure your answers with headings and bullet points for clarity where appropriate.";

// --- DOM ELEMENTS ---
const appContainer = document.getElementById('app-container');
const themeToggle = document.getElementById('theme-toggle');
const themeIconDark = document.getElementById('theme-icon-dark');
const themeIconLight = document.getElementById('theme-icon-light');
const chatWindow = document.getElementById('chat-window');
const messageContainer = document.getElementById('message-container');
const typingIndicator = document.getElementById('typing-indicator');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatSubmit = document.getElementById('chat-submit');
const voiceInputBtn = document.getElementById('voice-input-btn');
const bookmarkPanelToggle = document.getElementById('bookmark-panel-toggle');
const bookmarkPanel = document.getElementById('bookmark-panel');
const bookmarkPanelClose = document.getElementById('bookmark-panel-close');
const bookmarkList = document.getElementById('bookmark-list');
const bookmarkCount = document.getElementById('bookmark-count');


// --- SPEECH RECOGNITION SETUP ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Set to Indian English for better accuracy
} else {
    console.warn("Speech Recognition API not supported in this browser.");
    if(voiceInputBtn) voiceInputBtn.style.display = 'none';
}


// --- API SERVICE ---
async function getChatbotResponse(prompt) {
    if (!API_KEY) {
        throw new Error("API_KEY is not set. Please configure your environment.");
    }
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    let retries = 0;
    const maxRetries = 2;
    const baseDelay = 1000; // 1 second

    while (retries <= maxRetries) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                }
            });

            return response.text;
        } catch (error) {
            console.error("Gemini API call failed:", error);
            if (retries < maxRetries) {
                const delay = baseDelay * Math.pow(2, retries);
                console.log(`Retrying in ${delay}ms... (${retries + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retries++;
            } else {
                 if (error.message && error.message.includes('400')) {
                    return "I cannot answer this question as it may violate content safety policies.";
                } else if (error.message && error.message.includes('API key not valid')) {
                    return "There seems to be an issue with the API configuration. Please contact support.";
                }
                // Final attempt failed
                throw new Error("Failed to get a response from the chatbot after multiple retries. Please check your connection.");
            }
        }
    }
}


// --- RENDER FUNCTIONS ---
function renderMessages() {
    messageContainer.innerHTML = state.messages.map((msg, index) =>
        createMessageBubble(msg, index)
    ).join('');
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function createMessageBubble(message, index) {
    const isUser = message.sender === 'user';
    const isBookmarked = state.bookmarks.some(b => b.id === message.id);

    const messageText = !isUser && window.marked ? marked.parse(message.text) : escapeHTML(message.text);

    return `
    <div class="flex ${isUser ? 'justify-end' : 'justify-start'} group">
      <div class="max-w-lg lg:max-w-2xl px-4 py-3 rounded-2xl ${isUser ? 'bg-blue-600 text-white rounded-br-lg' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-lg'} shadow-md">
        <div class="prose prose-sm dark:prose-invert max-w-none">
         ${messageText}
        </div>
        ${!isUser && message.id ? `
          <div class="mt-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="bookmark-btn p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none" data-message-id="${message.id}" aria-label="Bookmark this answer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="${isBookmarked ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 ${isBookmarked ? 'text-yellow-500' : 'text-gray-500 dark:text-gray-400'}">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.5 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
              </svg>
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderBookmarks() {
    if (state.bookmarks.length === 0) {
        bookmarkList.innerHTML = `<p class="text-gray-500 dark:text-gray-400 text-center">You haven't bookmarked any answers yet.</p>`;
    } else {
        bookmarkList.innerHTML = state.bookmarks.map(bookmark => {
            const answerHtml = window.marked ? marked.parse(bookmark.answer) : escapeHTML(bookmark.answer);
            return `
                <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg mb-3">
                  <p class="font-semibold text-sm text-gray-600 dark:text-gray-300 mb-1">Q: ${escapeHTML(bookmark.question)}</p>
                  <div class="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200">${answerHtml}</div>
                </div>
            `;
        }).join('');
    }
    updateBookmarkCount();
    localStorage.setItem('bookmarks', JSON.stringify(state.bookmarks));
}

function updateBookmarkCount() {
    if (state.bookmarks.length > 0) {
        bookmarkCount.textContent = state.bookmarks.length;
        bookmarkCount.classList.remove('hidden');
    } else {
        bookmarkCount.classList.add('hidden');
    }
}

function renderTheme() {
    if (state.theme === 'dark') {
        document.documentElement.classList.add('dark');
        themeIconDark.classList.remove('hidden');
        themeIconLight.classList.add('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        themeIconDark.classList.add('hidden');
        themeIconLight.classList.remove('hidden');
    }
}

function showTypingIndicator() {
  typingIndicator.innerHTML = `
    <div class="flex justify-start">
      <div class="max-w-lg px-4 py-3 rounded-2xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-lg shadow-md flex items-center space-x-2">
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: -0.3s;"></div>
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: -0.15s;"></div>
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
      </div>
    </div>
  `;
  typingIndicator.classList.remove('hidden');
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function hideTypingIndicator() {
    typingIndicator.classList.add('hidden');
    typingIndicator.innerHTML = '';
}

// --- EVENT HANDLERS ---
function handleThemeToggle() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
    renderTheme();
}

async function handleSendMessage(event) {
    event.preventDefault();
    const userMessageText = chatInput.value.trim();
    if (!userMessageText) return;

    if (state.isRecording) {
        recognition.stop();
    }

    const userMessage = {
        sender: 'user',
        text: userMessageText,
    };
    state.messages.push(userMessage);
    renderMessages();
    
    const prompt = userMessageText;

    chatInput.value = '';
    toggleForm(false);
    showTypingIndicator();

    try {
        const botResponseText = await getChatbotResponse(prompt);
        const messageId = `msg-${Date.now()}`;
        state.messages.push({ id: messageId, sender: CHATBOT_NAME, text: botResponseText, question: userMessageText });
    } catch (error) {
        console.error("Failed to get chatbot response:", error);
        state.messages.push({ sender: CHATBOT_NAME, text: `Sorry, something went wrong. ${error.message}` });
    } finally {
        hideTypingIndicator();
        renderMessages();
        toggleForm(true);
    }
}

function handleBookmarkToggle(event) {
    const button = event.target.closest('.bookmark-btn');
    if (!button) return;
    
    const messageId = button.dataset.messageId;
    const messageIndex = state.messages.findIndex(m => m.id === messageId);
    
    if (messageIndex === -1) return;

    const bookmarkIndex = state.bookmarks.findIndex(b => b.id === messageId);

    if (bookmarkIndex > -1) {
        state.bookmarks.splice(bookmarkIndex, 1);
    } else {
        const messageToBookmark = state.messages[messageIndex];
        state.bookmarks.push({
            id: messageId,
            question: messageToBookmark.question,
            answer: messageToBookmark.text,
        });
    }
    
    renderMessages();
    renderBookmarks();
}

function handleVoiceInput() {
    if (!recognition) return;

    if (state.isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
}

function setupSpeechRecognition() {
    if (!recognition) return;

    recognition.onstart = () => {
        state.isRecording = true;
        voiceInputBtn.classList.add('text-red-500', 'animate-pulse');
        chatInput.value = '';
        chatInput.placeholder = 'Listening...';
        toggleForm(false, true); 
    };

    recognition.onend = () => {
        state.isRecording = false;
        voiceInputBtn.classList.remove('text-red-500', 'animate-pulse');
        chatInput.placeholder = 'Ask about Indian Cyber Law...';
        toggleForm(true);
        if (chatInput.value.trim()) {
            chatForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            alert('Microphone access was denied. Please allow microphone access in your browser settings to use voice input.');
        }
    };
    
    let finalTranscript = '';
    recognition.onresult = (event) => {
        let interimTranscript = '';
        finalTranscript = ''; // Reset final transcript to prevent concatenation
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        chatInput.value = finalTranscript + interimTranscript;
    };
}


// --- UTILITY FUNCTIONS ---
function toggleForm(enabled, keepVoiceBtn = false) {
    chatInput.disabled = !enabled;
    chatSubmit.disabled = !enabled;

    if (!keepVoiceBtn) {
        voiceInputBtn.disabled = !enabled;
    }
}

function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

// --- INITIALIZATION ---
function initialize() {
    // Add marked.js for markdown rendering
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
    script.onload = () => {
        // Initial render after marked is loaded
        if (state.messages.length > 0) {
            renderMessages();
        }
    };
    document.head.appendChild(script);

    // Initial welcome message
    if (state.messages.length === 0) {
        state.messages.push({
            sender: CHATBOT_NAME,
            text: "Hello! I'm your guide to Indian Cyber Law. How can I help you today? You can ask me about topics like data privacy or online fraud.",
        });
    }

    renderTheme();
    renderMessages();
    renderBookmarks();
    setupSpeechRecognition();

    // Event Listeners
    themeToggle.addEventListener('click', handleThemeToggle);
    chatForm.addEventListener('submit', handleSendMessage);
    voiceInputBtn.addEventListener('click', handleVoiceInput);
    
    bookmarkPanelToggle.addEventListener('click', () => bookmarkPanel.classList.remove('translate-x-full'));
    bookmarkPanelClose.addEventListener('click', () => bookmarkPanel.classList.add('translate-x-full'));
    messageContainer.addEventListener('click', handleBookmarkToggle);

    chatInput.focus();
}

// Start the app
initialize();