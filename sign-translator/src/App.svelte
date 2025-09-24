<script lang="ts">
  import { onMount } from 'svelte';
  import { loadModel, predictFromLandmarks } from './lib/model';

  let webcam: HTMLVideoElement;
  let prediction = 'Waiting...';
  let debug = '';
  let handVisible = false;
  let confidence = 0;
  let errorMessage = '';
  let setupStatus = 'initializing'; // 'initializing', 'loading', 'ready', 'failed'

  // New variables for thesaurus functionality
  let inputText = '';
  let countdownActive = false;
  let countdownValue = 3;
  let lastAcceptedAction = ''; // Kann jetzt auch DELETE oder SPACE sein

  // New variables for buffer system
  let signBuffer: string[] = [];
  let bufferThreshold = 0.6; // 60% confidence threshold for buffering
  let countdownStartTime: number | null = null;

  // Slider variable for tracking time (0.5 to 3 seconds)
  let trackingTime = 3; // Default 3 seconds
  
  // Variables for precise timing
  let countdownStartMs = 0;
  let countdownDurationMs = 3000;

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
    // If buffer is empty (shouldn't happen), return the lastAcceptedAction
    if (signBuffer.length === 0) {
      return lastAcceptedAction;
    }
    
    // Count occurrences of each action
    const actionCounts = signBuffer.reduce((counts, action) => {
      counts[action] = (counts[action] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    // Find the action with highest count
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
      // Delete all text
      if (inputText.length > 0) {
        inputText = '';
        console.log(`Deleted all text, cleared input`);
      }
    } else if (action === 'SPACE') {
      // Trigger search directly - always works, even with empty text
      console.log(`SPACE detected - triggering search with text: "${inputText}"`);
      submitSearch();
    } else {
      // Add the letter
      inputText += action;
      console.log(`Added letter: ${action}, new text: "${inputText}"`);
    }
  }

  function startCountdown(action: string, currentConfidence: number) {
    // Reset buffer if countdown is not active or if it's a different action starting the countdown
    if (!countdownActive) {
      signBuffer = [];
      countdownStartTime = Date.now();
    }
    
    // Add the current action to the buffer every time we detect a sign
    signBuffer.push(action);
    
    // If already counting down with same action, just update buffer
    if (countdownActive && action === lastAcceptedAction) {
      return;
    }
    
    // Check if we meet the threshold to start/continue countdown
    if (currentConfidence >= bufferThreshold) {
      // Clear any existing countdown
      if (countdownTimer) {
        clearInterval(countdownTimer);
      }
      
      // Start new countdown
      countdownActive = true;
      countdownDurationMs = trackingTime * 1000; // Convert to milliseconds
      countdownStartMs = Date.now();
      countdownValue = trackingTime; // Start with full time
      lastAcceptedAction = action;
      
      countdownTimer = setInterval(() => {
        const elapsed = Date.now() - countdownStartMs;
        const remaining = Math.max(0, countdownDurationMs - elapsed);
        countdownValue = remaining / 1000; // Convert back to seconds for display
        
        if (remaining <= 0) {
          try {
            // Get the most frequent action from the buffer
            const mostFrequentAction = getMostFrequentAction();
            
            // Execute the action (add letter, delete, or space)
            executeAction(mostFrequentAction);
            
            // Reset buffer and countdown
            signBuffer = [];
            countdownActive = false;
            clearInterval(countdownTimer);
            countdownStartTime = null;
          } catch (e) {
            console.error("Error executing action:", e);
          }
        }
      }, 100); // Update every 100ms for smoother countdown
    } else {
      // If below threshold but countdown is active, don't reset immediately
      // Just update the buffer
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
    // Always open search, even if input is empty
    const searchText = inputText.trim();
    const url = searchText 
      ? `https://gebaerden-archiv.at/search?q=${encodeURIComponent(searchText)}`
      : `https://gebaerden-archiv.at/search`;
    
    console.log(`Opening search URL: ${url}`);
    window.open(url, '_blank');
  }

  function clearInput() {
    inputText = '';
    resetCountdown();
  }

  // Format the prediction display to show special actions differently
  function formatPredictionDisplay(pred: string): string {
    if (pred === 'DELETE') {
      return '🗑️ DELETE';
    } else if (pred === 'SPACE') {
      return '🔍 SEARCH';
    }
    return pred;
  }

  onMount(async () => {
    console.log("onMount triggered");
    setupStatus = 'loading';

    try {
      // Check if MediaPipe libraries are available
      if (!window.Hands || !window.Camera) {
        throw new Error("MediaPipe libraries not found. Make sure Hands and Camera are loaded from CDN.");
      }
      console.log("✓ MediaPipe libraries found");

      // Load the TF model
      try {
        await loadModel();
        console.log("Model loaded successfully");
      } catch (modelError) {
        console.error("Model loading error:", modelError);
        throw new Error(`Model loading failed: ${modelError.message}`);
      }
      
      // Initialize MediaPipe Hands
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
            
            // Format landmarks for debugging
            debug = JSON.stringify(landmarks.slice(0, 3).map((p: any) => 
              [p.x.toFixed(3), p.y.toFixed(3), p.z.toFixed(3)]
            ), null, 2) + "...";
            
            try {
              const result = predictFromLandmarks(landmarks);
              if (result) {
                prediction = result.letter;
                confidence = result.confidence;
                console.log(`Predicted action: ${prediction} (${(confidence * 100).toFixed(1)}%)`);
                
                // Use the new threshold for buffering (60%)
                if (confidence >= bufferThreshold) {
                  startCountdown(prediction, confidence);
                } else {
                  // If below threshold but countdown is active, still add to buffer
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

        // Make sure webcam is available
        if (!webcam) {
          throw new Error("Webcam element not found in the DOM");
        }

        // Initialize camera
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

<main>
  <!-- Header -->
  <h1>Sign Language Thesaurus</h1>

  <!-- Status -->
  {#if setupStatus === 'failed'}
    <div class="error-container">
      <h2>Setup Failed</h2>
      <p class="error-message">{errorMessage}</p>
    </div>
  {:else}
    <div class="status-indicator">
      Status: {setupStatus === 'ready' ? 'Ready' : 'Loading...'}
    </div>

    <div class="workspace">
      <!-- Webcam and prediction section -->
      <div class="camera-section">
        <div class="camera-container">
          <video bind:this={webcam} autoplay playsinline width="400"></video>
          {#if !handVisible && setupStatus === 'ready'}
            <div class="overlay">Show your hand in the camera</div>
          {/if}
        </div>

        <div class="prediction-container">
          <div class="prediction-label">Current Sign:</div>
          <div class="prediction-value {prediction === 'DELETE' ? 'delete-action' : prediction === 'SPACE' ? 'search-action' : ''}">
            {formatPredictionDisplay(prediction)}
          </div>
          {#if confidence > 0}
            <div class="confidence">Confidence: {(confidence * 100).toFixed(1)}%</div>
          {/if}
          {#if countdownActive && confidence >= bufferThreshold}
            <div class="countdown">
              Executing in: {countdownValue.toFixed(1)}s
              <div class="current-prediction">Current best: {formatPredictionDisplay(getMostFrequentAction())}</div>
            </div>
          {/if}
        </div>

        <!-- Settings -->
        <div class="settings-panel">
          <h3>Settings:</h3>
          <label for="trackingTime">Tracking Time: {trackingTime.toFixed(1)}s</label>
          <input type="range" id="trackingTime" bind:value={trackingTime} min="0.5" max="3" step="0.1" class="time-slider" />
        </div>
      </div>

      <!-- Input and legend section -->
      <div class="input-section">
        <div class="text-input-container">
          <div class="input-label">Your Text:</div>
          <div class="input-display" contenteditable="true" bind:innerText={inputText}></div>
          <div class="button-group">
            <button on:click={clearInput} class="clear-btn">Delete</button>
            <button on:click={submitSearch} class="submit-btn">Search</button>
          </div>
        </div>

        <!-- Legend moved directly below the input -->
        <div class="legend">
          <h3>Available Actions:</h3>
          <div class="legend-items">
            <div class="legend-card">
              <span class="legend-title">A-Z: Add letter</span>
            </div>
            <div class="legend-card delete-legend">
              <span class="legend-title">DELETE: Delete all text</span>
              <img src="/assets/del18.jpg" alt="Delete Action" class="legend-preview" />
            </div>
            <div class="legend-card search-legend">
              <span class="legend-title">SEARCH: Execute search</span>
              <img src="/assets/space2.jpg" alt="Search Action" class="legend-preview" />
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</main>


<style>
  /* === General layout & base styling === */
main {
  text-align: center;
  padding: 2rem;
  font-family: 'Segoe UI', sans-serif;
  max-width: 1000px;
  margin: 0 auto;
  background-color: #1e1e1e;
  color: #eee;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.status-indicator {
  background-color: #2e2e2e;
  color: #90ee90;
  padding: 5px 12px;
  border-radius: 8px;
  font-weight: bold;
  font-size: 0.95rem;
  display: inline-block;
  margin-bottom: 1.5rem;
}

/* === Camera and Input Panels === */
.workspace {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

@media (min-width: 900px) {
  .workspace {
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;
  }
}

.camera-section, .input-section {
  background-color: #f4f4f4;
  color: #333;
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  width: 420px;
}

/* === Webcam & Overlay === */
.camera-container video {
  border-radius: 10px;
  width: 100%;
  border: 2px solid #444;
}

.overlay {
  background: rgba(0,0,0,0.5);
  color: white;
  font-weight: bold;
  padding: 0.5rem 1rem;
  border-radius: 6px;
}

/* === Input display & buttons === */
.input-display {
  min-height: 100px;
  max-height: 300px;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: white;
  margin-bottom: 1rem;
  text-align: left;
  font-size: 1.2rem;
}

.button-group button {
  padding: 10px 16px;
  font-weight: bold;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s ease;
}

.clear-btn {
  background-color: #e74c3c;
  color: white;
}
.clear-btn:hover {
  background-color: #c0392b;
}

.submit-btn {
  background-color: #27ae60;
  color: white;
}
.submit-btn:hover {
  background-color: #1e8449;
}

/* === Legend Section === */
.legend {
  margin-top: 2rem;
  padding: 1rem;
  background-color: #f4f4f4;
  border-radius: 12px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.1);
}

.legend h3 {
  margin-bottom: 0.5rem;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.legend-card {
  background-color: white;
  padding: 10px;
  border-left: 5px solid #888;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.08);
}

.legend-card img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  border: 2px solid #3498db;
}

.prediction-value {
  font-size: 1.5rem;
  font-weight: bold;
  margin-top: 0.5rem;
}

.legend-title {
  font-weight: bold;
  font-size: 1rem;
}

.delete-legend {
  border-left-color: #e74c3c;
}

.delete-legend .legend-title {
  color: #e74c3c;
}

.search-legend {
  border-left-color: #f39c12;
}

.search-legend .legend-title {
  color: #f39c12;
}

/* === Settings === */
.settings-panel {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #f4f4f4;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}

  
</style>