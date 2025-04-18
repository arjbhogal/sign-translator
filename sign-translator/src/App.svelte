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

  // Declare global variables for MediaPipe
  declare global {
    interface Window {
      Hands: any;
      Camera: any;
    }
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
                console.log(`Predicted letter: ${prediction} (${(confidence * 100).toFixed(1)}%)`);
              } else {
                prediction = 'Uncertain';
                confidence = 0;
              }
            } catch (err) {
              console.error("Prediction error:", err);
              prediction = 'Error';
              confidence = 0;
            }
          } else {
            handVisible = false;
            prediction = 'No hand detected';
            confidence = 0;
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
  <h1>Sign Language to Text</h1>
  
  {#if setupStatus === 'failed'}
    <div class="error-container">
      <h2>Setup Failed</h2>
      <p>There was an error setting up the application:</p>
      <p class="error-message">{errorMessage}</p>
      <div class="troubleshooting">
        <h3>Troubleshooting steps:</h3>
        <ol>
          <li>Make sure you're using a modern browser (Chrome, Firefox, Edge)</li>
          <li>Check that your camera is connected and working</li>
          <li>Allow camera permissions when prompted</li>
          <li>Make sure you're connected to the internet (MediaPipe libraries are loaded from CDN)</li>
          <li>Check the browser console (F12) for more detailed error messages</li>
        </ol>
        <button on:click={() => window.location.reload()}>Reload Application</button>
      </div>
    </div>
  {:else}
    <div class="status-indicator">
      Status: {setupStatus === 'initializing' ? 'Initializing...' : 
              setupStatus === 'loading' ? 'Loading components...' : 
              setupStatus === 'ready' ? 'Ready' : 'Error'}
    </div>
    
    <div class="camera-container">
      <video bind:this={webcam} autoplay playsinline width="400" aria-label="Webcam feed"></video>
      <div class="overlay {handVisible ? 'hand-visible' : ''}">
        {#if !handVisible && setupStatus === 'ready'}
          <div class="instructions">Show your hand in the camera</div>
        {/if}
        {#if setupStatus === 'loading'}
          <div class="loading">Loading components...</div>
        {/if}
      </div>
    </div>

    <div class="prediction-container">
      <div class="prediction-label">Prediction:</div>
      <div class="prediction-value">{prediction}</div>
      {#if confidence > 0}
        <div class="confidence">Confidence: {(confidence * 100).toFixed(1)}%</div>
      {/if}
    </div>

    {#if debug && handVisible}
      <div class="debug-container">
        <details>
          <summary>Debug Info</summary>
          <pre>{debug}</pre>
        </details>
      </div>
    {/if}
  {/if}
</main>

<style>
  main {
    text-align: center;
    padding: 2rem;
    font-family: sans-serif;
    max-width: 800px;
    margin: 0 auto;
  }

  .camera-container {
    position: relative;
    margin: 0 auto;
    width: 400px;
  }

  video {
    margin-top: 1rem;
    border-radius: 10px;
    border: 2px solid #333;
    background-color: black;
    display: block;
  }

  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .instructions, .loading {
    background-color: rgba(0,0,0,0.7);
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    font-weight: bold;
  }

  .loading {
    background-color: rgba(0,70,150,0.7);
  }

  .prediction-container {
    margin-top: 1.5rem;
    font-size: 1.8rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .prediction-value {
    font-weight: bold;
    font-size: 3rem;
    margin: 0.5rem 0;
  }

  .confidence {
    font-size: 1rem;
    color: #555;
  }

  .debug-container {
    margin-top: 1rem;
    text-align: left;
    font-size: 0.8rem;
  }

  details {
    border: 1px solid #ddd;
    border-radius: 5px;
    padding: 0.5rem;
    margin-top: 1rem;
  }

  summary {
    cursor: pointer;
    font-weight: bold;
  }

  pre {
    max-height: 200px;
    overflow: auto;
    background-color: #f5f5f5;
    padding: 10px;
    border-radius: 5px;
  }

  .hand-visible {
    border: 2px solid #4CAF50;
  }

  .error-container {
    margin-top: 2rem;
    padding: 1rem;
    border: 2px solid #ff6b6b;
    border-radius: 10px;
    background-color: #fff5f5;
    color: #333;
    text-align: left;
  }

  .error-message {
    padding: 10px;
    background-color: #f8d7da;
    border-radius: 5px;
    font-family: monospace;
    font-weight: bold;
    color: #721c24;
  }

  .troubleshooting {
    margin-top: 1.5rem;
  }

  .troubleshooting ol {
    text-align: left;
  }

  .troubleshooting li {
    margin-bottom: 0.5rem;
  }

  .status-indicator {
    display: inline-block;
    padding: 5px 10px;
    border-radius: 5px;
    background-color: #f0f0f0;
    color: #333;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }

  button {
    background-color: #4CAF50;
    color: white;
    padding: 10px 15px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1rem;
    margin-top: 1rem;
  }

  button:hover {
    background-color: #45a049;
  }
</style>