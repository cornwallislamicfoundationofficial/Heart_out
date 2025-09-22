import { ChangeDetectionStrategy, Component, signal, OnInit, ViewChild, ElementRef, computed } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { CommonModule } from '@angular/common'; // Import for ngIf and other directives

// This import would come from your environment.ts file
// For this example, let's define them here for clarity
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDUQOGSDhl44H1srJweILNrxTZ6GJ719Hw",
  authDomain: "your-ai-therapist.firebaseapp.com",
  projectId: "your-ai-therapist",
  storageBucket: "your-ai-therapist.firebasestorage.app",
  messagingSenderId: "341357985732",
  appId: "1:341357985732:web:ba04d5a0b9d9f2a800ae91",
  measurementId: "G-B6HNZJFZQ4"
};

const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY'; // 🔑 Fill this in

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule], // Add CommonModule for directives
  template: `
    <div class="bg-gray-100 min-h-screen flex items-center justify-center p-4">
      <div *ngIf="isAuthReady()">
        <div *ngIf="!isChatting(); else chatScreen" class="w-full max-w-2xl bg-white p-8 rounded-2xl shadow-xl transition-all duration-500 ease-in-out">
          <h1 class="text-4xl md:text-5xl font-bold text-center text-gray-800 mb-4">Heart Out</h1>
          <p class="text-center text-gray-600 text-lg mb-8">A space to talk through situations where your brain feels stuck. Let's rewire your thinking, one conversation at a time.</p>
          <div class="space-y-4">
            <textarea
              [value]="initialInput()"
              (input)="initialInput.set($any($event.target).value)"
              rows="4"
              placeholder="Start by describing a situation where you felt angry or didn't know what to say."
              class="w-full p-4 text-lg border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all resize-none"
            ></textarea>
            <button
              (click)="startConversation()"
              class="w-full py-4 bg-indigo-600 text-white text-xl font-semibold rounded-xl shadow-lg hover:bg-indigo-700 transition-all transform hover:scale-105 active:scale-95"
            >
              Start Conversation
            </button>
          </div>
          <p class="mt-4 text-xs text-center text-gray-400">User ID: {{ userId() }}</p>
        </div>

        <ng-template #chatScreen>
          <div class="w-full max-w-2xl bg-white p-6 rounded-2xl shadow-xl flex flex-col">
            <div #chatLogElement class="flex-grow overflow-y-auto space-y-4 p-2 mb-4 max-h-[70vh]">
              @for (message of chatMessages(); track $index) {
                <div [ngClass]="{'bg-indigo-500 text-white self-end text-right rounded-br-none': message.sender === 'user', 'bg-gray-200 text-gray-800 self-start rounded-bl-none': message.sender === 'ai'}"
                     class="max-w-[85%] p-4 rounded-xl shadow-md">
                  {{ message.text }}
                </div>
              }
            </div>

            <div class="flex items-center space-x-2">
              <textarea
                [value]="chatInput()"
                (input)="chatInput.set($any($event.target).value)"
                (keydown.enter)="sendMessage()"
                [disabled]="isLoading()"
                rows="1"
                placeholder="Type your thoughts here..."
                class="flex-grow p-3 text-lg border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 resize-none"
              ></textarea>
              <button
                (click)="sendMessage()"
                [disabled]="isLoading()"
                class="p-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all transform hover:scale-105 active:scale-95 disabled:bg-indigo-300"
              >
                <i class="fas fa-paper-plane text-xl"></i>
              </button>
            </div>
            <div *ngIf="message()" [ngClass]="messageClass()" class="mt-4 p-3 text-sm font-medium rounded-xl text-center">
              {{ message() }}
            </div>
            <div *ngIf="isLoading()" class="mt-4 flex justify-center">
              <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          </div>
        </ng-template>
      </div>
      <div *ngIf="!isAuthReady()" class="animate-pulse text-lg text-gray-500">Loading app...</div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;
      font-family: 'Inter', sans-serif;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit { // 👈 Renamed to match the file
  @ViewChild('chatLogElement') private chatLogElement!: ElementRef;

  isChatting = signal(false);
  chatMessages = signal<{ sender: string, text: string }[]>([]);
  initialInput = signal('');
  chatInput = signal('');
  isLoading = signal(false);
  message = signal('');
  messageClass = signal('');
  userId = signal('Loading...');
  isAuthReady = signal(false);

  private db: any;
  private auth: any;

  ngOnInit() {
    this.initializeFirebase();
  }

  private async initializeFirebase() {
    try {
      const app = initializeApp(FIREBASE_CONFIG); // 🔑 Use the imported config
      this.auth = getAuth(app);
      this.db = getFirestore(app);

      onAuthStateChanged(this.auth, async (user: User | null) => {
        if (user) {
          this.userId.set(user.uid);
        } else {
          // This path handles anonymous sign-in
          const result = await signInAnonymously(this.auth);
          this.userId.set(result.user.uid);
        }
        this.isAuthReady.set(true);
      });
    } catch (error) {
      console.error("Firebase Initialization/Auth Error:", error);
      this.showMessage("Authentication failed. Please refresh the page.", 'bg-red-200 text-red-800');
      this.isAuthReady.set(true);
    }
  }

  startConversation() {
    const userText = this.initialInput().trim();
    if (userText) {
      this.isChatting.set(true);
      this.addMessage('user', userText);
      this.fetchGeminiResponse(userText);
    } else {
      this.showMessage("Please describe a situation to start.", 'bg-yellow-200 text-yellow-800');
    }
  }

  sendMessage() {
    const userText = this.chatInput().trim();
    if (userText) {
      this.addMessage('user', userText);
      this.chatInput.set('');
      this.fetchGeminiResponse(userText);
    }
  }

  addMessage(sender: string, text: string) {
    this.chatMessages.update(messages => [...messages, { sender, text }]);
    setTimeout(() => {
      this.chatLogElement.nativeElement.scrollTop = this.chatLogElement.nativeElement.scrollHeight;
    }, 0);
  }

  showMessage(text: string, colorClass: string) {
    this.message.set(text);
    this.messageClass.set(colorClass);
    setTimeout(() => {
      this.message.set('');
    }, 5000);
  }

  async fetchGeminiResponse(userQuery: string) {
    this.isLoading.set(true);

    const systemPrompt = "You are a compassionate AI speech therapist named 'Heart Out.' Your goal is to help a person who is stuck in a loop of anger or frustration. Listen to their situation. Your response should reframe their thoughts, provide calming techniques, and help them identify actionable steps to move forward. Do not use overly complex or clinical language. Be empathetic and encouraging. Keep your responses concise and to the point, guiding them gently to the next step of the conversation. Never tell the user they are 'wrong' or 'incorrect'.";
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`; // 🔑 Use the imported key
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };

    const maxRetries = 3;
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const result = await response.json();
          const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            this.addMessage('ai', text);
            success = true;
          } else {
            console.error("API response missing text content.");
            this.showMessage("Sorry, I'm having trouble understanding. Could you rephrase that?", 'bg-red-200 text-red-800');
          }
        } else {
          throw new Error(`API returned status ${response.status}`);
        }
      } catch (error) {
        console.error("API call error:", error);
        retries++;
        if (retries < maxRetries) {
          await new Promise(res => setTimeout(res, 1000 * Math.pow(2, retries)));
        } else {
          this.showMessage("I'm having a hard time connecting right now. Please try again later.", 'bg-red-200 text-red-800');
        }
      }
    }

    this.isLoading.set(false);
  }
}
