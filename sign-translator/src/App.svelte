<script lang="ts">
  import { onMount } from 'svelte';
  import { loadModel, predictFromLandmarks } from './lib/model';

  let webcam: HTMLVideoElement;
  let prediction = 'No hand detected';
  let debug = '';
  let handVisible = false;
  let confidence = 0;
  let errorMessage = '';
  let setupStatus = 'initializing'; // 'initializing', 'loading', 'ready', 'failed'

  // New variables for thesaurus functionality
  let inputText = '';
  let countdownActive = false;
  let countdownValue = 3;
  let lastAcceptedAction = ''; 

  // New variables for buffer system
  let signBuffer: string[] = [];
  let bufferThreshold = 0.6; 
  let countdownStartTime: number | null = null;

  // Declare global variables for MediaPipe
  declare global {
    interface Window {
      Hands: any;
      Camera: any;
    }
  }

  // Timer for action input countdown
  let countdownTimer: number | undefined;

  // Function to determine the most frequent action in the buffer
  function getMostFrequentAction(): string {
    if (signBuffer.length === 0) {
      return lastAcceptedAction;
    }
    
    const actionCounts = signBuffer.reduce((counts, action) => {
      counts[action] = (counts[action] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    let mostFrequentAction = signBuffer[0];
    let maxCount = 0;
    
    for (const [action, count] of Object.entries(actionCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentAction = action;
      }
    }
    
    return mostFrequentAction;
  }

  // Execute the recognized action (letter, delete, or space)
  function executeAction(action: string) {
    if (action === 'DELETE') {
      if (inputText.length > 0) {
        inputText = '';
        console.log(`Deleted all text, cleared input`);
      }
    } else if (action === 'SPACE') {
      inputText += ' ';
      console.log(`Added space, new text: "${inputText}"`);
    } else {
      inputText += action;
      console.log(`Added letter: ${action}, new text: "${inputText}"`);
    }
  }

  function startCountdown(action: string, currentConfidence: number) {
    if (!countdownActive) {
      signBuffer = [];
      countdownStartTime = Date.now();
    }
    
    signBuffer.push(action);
    
    if (countdownActive && action === lastAcceptedAction) {
      return;
    }
    
    if (currentConfidence >= bufferThreshold) {
      if (countdownTimer) {
        clearInterval(countdownTimer);
      }
      
      countdownActive = true;
      countdownValue = 3;
      lastAcceptedAction = action;
      
      countdownTimer = setInterval(() => {
        countdownValue--;
        
        if (countdownValue <= 0) {
          try {
            const mostFrequentAction = getMostFrequentAction();
            executeAction(mostFrequentAction);
            signBuffer = [];
            countdownActive = false;
            clearInterval(countdownTimer);
            countdownStartTime = null;
          } catch (e) {
            console.error("Error executing action:", e);
          }
        }
      }, 1000);
    } else {
      if (!countdownActive) {
        resetCountdown();
      }
    }
  }

  function resetCountdown() {
    try {
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = undefined;
      }
      countdownActive = false;
      lastAcceptedAction = '';
      signBuffer = [];
      countdownStartTime = null;
    } catch (e) {
      console.error("Error resetting countdown:", e);
    }
  }

  function submitSearch() {
    if (inputText.trim()) {
      const url = `https://gebaerden-archiv.at/search?q=${encodeURIComponent(inputText.trim())}`;
      window.open(url, '_blank');
    }
  }

  function clearInput() {
    inputText = '';
    resetCountdown();
  }

  function formatPredictionDisplay(pred: string): string {
    if (pred === 'DELETE') {
      return 'DELETE';
    } else if (pred === 'SPACE') {
      return 'SPACE';
    }
    return pred;
  }

  onMount(async () => {
    console.log("onMount triggered");
    setupStatus = 'loading';

    try {
      if (!window.Hands || !window.Camera) {
        throw new Error("MediaPipe libraries not found. Make sure Hands and Camera are loaded from CDN.");
      }
      console.log("✓ MediaPipe libraries found");

      try {
        await loadModel();
        console.log("Model loaded successfully");
      } catch (modelError) {
        console.error("Model loading error:", modelError);
        throw new Error(`Model loading failed: ${modelError.message}`);
      }
      
      try {
        const hands = new window.Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7
        });

        hands.onResults((results: any) => {
          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            handVisible = true;
            
            debug = JSON.stringify(landmarks.slice(0, 3).map((p: any) => 
              [p.x.toFixed(3), p.y.toFixed(3), p.z.toFixed(3)]
            ), null, 2) + "...";
            
            try {
              const result = predictFromLandmarks(landmarks);
              if (result) {
                prediction = result.letter;
                confidence = result.confidence;
                console.log(`Predicted action: ${prediction} (${(confidence * 100).toFixed(1)}%)`);
                
                if (confidence >= bufferThreshold) {
                  startCountdown(prediction, confidence);
                } else {
                  if (countdownActive) {
                    signBuffer.push(prediction);
                  } else {
                    resetCountdown();
                  }
                }
              } else {
                prediction = 'Uncertain';
                confidence = 0;
                resetCountdown();
              }
            } catch (err) {
              console.error("Prediction error:", err);
              prediction = 'Error';
              confidence = 0;
              resetCountdown();
            }
          } else {
            handVisible = false;
            prediction = 'No hand detected';
            confidence = 0;
            resetCountdown();
          }
        });

        console.log("MediaPipe Hands initialized");

        if (!webcam) {
          throw new Error("Webcam element not found in the DOM");
        }

        const camera = new window.Camera(webcam, {
          onFrame: async () => {
            try {
              await hands.send({ image: webcam });
            } catch (err) {
              console.error("MediaPipe processing error:", err);
            }
          },
          width: 640,
          height: 480
        });

        console.log("Camera object created, starting camera...");
        
        await camera.start();
        console.log("Camera started successfully");
        setupStatus = 'ready';
        
      } catch (mediaError) {
        console.error("MediaPipe setup error:", mediaError);
        throw new Error(`MediaPipe setup failed: ${mediaError.message}`);
      }
        
    } catch (err) {
      console.error("Setup error:", err);
      errorMessage = err.message || 'Unknown setup error';
      setupStatus = 'failed';
      prediction = 'Setup failed';
    }
  });
</script>

<div class="app-container">
  <!-- Top Navigation -->
  <header class="top-nav">
    <div class="nav-content">
      <h1 class="app-title">Sign-o-saurus</h1>
      <div class="status-container">
        <span class="status-label">Status:</span>
        <span class="status-badge status-{setupStatus}">
          {setupStatus === 'initializing' ? 'Initializing' : 
           setupStatus === 'loading' ? 'Loading' : 
           setupStatus === 'ready' ? 'Ready' : 'Error'}
        </span>
      </div>
    </div>
  </header>

  {#if setupStatus === 'failed'}
    <div class="error-container">
      <div class="error-card">
        <h2 class="error-title">Setup Failed</h2>
        <p class="error-message">{errorMessage}</p>
        <button 
          on:click={() => window.location.reload()}
          class="error-button"
        >
          Reload Application
        </button>
      </div>
    </div>
  {:else}
    <!-- Main Content -->
    <main class="main-content">
      <div class="content-wrapper">
        <h2 class="main-title">Use Sign Language</h2>

        <!-- Camera Feed -->
        <div class="camera-container">
          <div class="camera-wrapper">
            <video 
              bind:this={webcam} 
              autoplay 
              playsinline 
              class="camera-video"
              aria-label="Webcam feed"
            />
          </div>
        </div>

        <!-- Recognition Display -->
        <div class="recognition-card">
          <p class="recognition-text">
            <span class="recognition-label">Recognized Sign: </span>
            <span class="recognition-value">
              {handVisible ? formatPredictionDisplay(prediction) : 'No hand detected'}
            </span>
          </p>
          {#if handVisible}
            <p class="confidence-text">
              Confidence: {(confidence * 100).toFixed(1)}%
            </p>
          {/if}
        </div>

        <!-- Text Output -->
        <div class="text-output-container">
          <label class="text-output-label">Text Output</label>
          <textarea 
            bind:value={inputText}
            class="text-output-area"
            rows="3"
            placeholder="Your recognized text will appear here..."
          />
        </div>

        <!-- Action Buttons -->
        <div class="button-container">
          <button 
            on:click={clearInput}
            class="action-button clear-button"
          >
            Clear
          </button>
          <button 
            on:click={submitSearch}
            class="action-button search-button"
            disabled={!inputText.trim()}
          >
            Search
          </button>
        </div>

        <!-- Quick Reference -->
        <div class="reference-section">
          <h3 class="reference-title">Quick Reference</h3>
          <div class="reference-grid">
            <!-- Space Sign -->
            <div class="reference-item">
              <div class="reference-icon space-icon">
                <span class="icon-emoji">✋</span>
              </div>
              <div class="reference-name">Space</div>
              <div class="reference-desc">Add space</div>
            </div>
            
            <!-- Delete Sign -->
            <div class="reference-item">
              <div class="reference-icon delete-icon">
                <span class="icon-emoji">✊</span>
              </div>
              <div class="reference-name">Delete</div>
              <div class="reference-desc">Clear all text</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  {/if}
</div>

<style>
  /* Base Styles */
  .app-container {
    min-height: 100vh;
    background-color: #111827;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* Top Navigation */
  .top-nav {
    background-color: #1f2937;
    border-bottom: 1px solid #374151;
  }

  .nav-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
  }

  .app-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .status-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .status-label {
    font-size: 0.875rem;
    color: #d1d5db;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-ready {
    background-color: #10b981;
    color: white;
  }

  .status-loading {
    background-color: #f59e0b;
    color: black;
  }

  .status-failed {
    background-color: #ef4444;
    color: white;
  }

  .status-initializing {
    background-color: #6b7280;
    color: white;
  }

  /* Error Styles */
  .error-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 1rem;
  }

  .error-card {
    max-width: 28rem;
    background-color: rgba(127, 29, 29, 0.5);
    border: 1px solid #ef4444;
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .error-title {
    font-size: 1.125rem;
    font-weight: bold;
    color: #fca5a5;
    margin: 0 0 1rem 0;
  }

  .error-message {
    color: #fecaca;
    margin: 0 0 1rem 0;
  }

  .error-button {
    padding: 0.5rem 1rem;
    background-color: #dc2626;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .error-button:hover {
    background-color: #b91c1c;
  }

  /* Main Content */
  .main-content {
    max-width: 56rem;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }

  .content-wrapper {
    text-align: center;
  }

  .content-wrapper > * + * {
    margin-top: 1.5rem;
  }

  .main-title {
    font-size: 1.875rem;
    font-weight: bold;
    margin: 0 0 2rem 0;
    color: #f9fafb;
  }

  /* Camera Styles */
  .camera-container {
    display: flex;
    justify-content: center;
    margin: 2rem 0;
  }

  .camera-wrapper {
    position: relative;
    background-color: #1f2937;
    border-radius: 0.75rem;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
    border: 2px solid #374151;
  }

  .camera-video {
    width: 600px;
    height: 338px;
    background-color: #374151;
    display: block;
  }

  /* Recognition Display */
  .recognition-card {
    background-color: #1f2937;
    border-radius: 0.75rem;
    padding: 1.25rem 2rem;
    max-width: 24rem;
    margin: 1.5rem auto;
    border: 1px solid #374151;
  }

  .recognition-text {
    font-size: 1rem;
    margin: 0;
    line-height: 1.5;
  }

  .recognition-label {
    color: #9ca3af;
    font-weight: 500;
  }

  .recognition-value {
    font-weight: 600;
    color: #60a5fa;
  }

  .confidence-text {
    font-size: 0.875rem;
    color: #9ca3af;
    margin: 0.5rem 0 0 0;
  }

  /* Text Output */
  .text-output-container {
    max-width: 36rem;
    margin: 2rem auto;
  }

  .text-output-label {
    display: block;
    text-align: left;
    font-size: 0.875rem;
    font-weight: 600;
    color: #d1d5db;
    margin-bottom: 0.75rem;
  }

  .text-output-area {
    width: 100%;
    padding: 1rem 1.25rem;
    background-color: #1f2937;
    border: 2px solid #374151;
    border-radius: 0.75rem;
    color: white;
    font-family: inherit;
    font-size: 0.95rem;
    resize: none;
    outline: none;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  .text-output-area::placeholder {
    color: #6b7280;
  }

  .text-output-area:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  /* Buttons */
  .button-container {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin: 2rem 0;
  }

  .action-button {
    padding: 0.75rem 2rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 100px;
  }

  .clear-button {
    background-color: #dc2626;
    color: white;
  }

  .clear-button:hover {
    background-color: #b91c1c;
    transform: translateY(-1px);
  }

  .search-button {
    background-color: #16a34a;
    color: white;
  }

  .search-button:hover:not(:disabled) {
    background-color: #15803d;
    transform: translateY(-1px);
  }

  .search-button:disabled {
    background-color: #6b7280;
    cursor: not-allowed;
    transform: none;
  }

  /* Quick Reference */
  .reference-section {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid #374151;
  }

  .reference-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 2rem 0;
    color: #f9fafb;
  }

  .reference-grid {
    display: flex;
    justify-content: center;
    gap: 4rem;
  }

  .reference-item {
    text-align: center;
  }

  .reference-icon {
    width: 5rem;
    height: 5rem;
    background-color: #374151;
    border-radius: 0.75rem;
    margin: 0 auto 1rem auto;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid;
    transition: all 0.2s ease;
  }

  .reference-icon:hover {
    transform: translateY(-2px);
  }

  .space-icon {
    border-color: #3b82f6;
  }

  .delete-icon {
    border-color: #ef4444;
  }

  .icon-emoji {
    font-size: 1.5rem;
  }

  .reference-name {
    font-weight: 600;
    margin-bottom: 0.25rem;
    color: #f9fafb;
  }

  .reference-desc {
    font-size: 0.875rem;
    color: #9ca3af;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .camera-video {
      width: 100%;
      max-width: 500px;
      height: auto;
      aspect-ratio: 16/9;
    }

    .reference-grid {
      gap: 2rem;
    }

    .nav-content {
      padding: 1rem;
    }

    .main-content {
      padding: 1.5rem 1rem;
    }

    .text-output-container {
      max-width: 100%;
    }

    .button-container {
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .action-button {
      width: 200px;
    }

    .reference-grid {
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }
  }
</style>