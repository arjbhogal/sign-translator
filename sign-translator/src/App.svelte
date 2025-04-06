<script lang="ts">
  import { onMount } from 'svelte';
  import { loadModel, predictFromLandmarks } from './lib/model';

  let webcam: HTMLVideoElement;
  let prediction = 'Waiting...';
  let debug = '';

  onMount(async () => {
    console.log("🎬 onMount triggered");

    const hands = new Hands({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    hands.onResults(results => {
      if (results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        console.log("🖐️ Landmarks detected:", landmarks);
        debug = JSON.stringify(landmarks.map(p => [p.x, p.y, p.z]).flat(), null, 2);


        const result = predictFromLandmarks(landmarks);
        console.log("🔤 Predicted letter:", result);
        prediction = result || 'No prediction';
      } else {
        prediction = 'No hand detected';
        console.log("No hand detected");
      }
    });

    console.log("Webcam element:", webcam);

    const camera = new Camera(webcam, {
      onFrame: async () => {
        await hands.send({ image: webcam });
      },
      width: 640,
      height: 480
    });

    await camera.start()
      .then(() => console.log("✅ Camera started"))
      .catch(err => console.error("🚨 Camera error:", err));

    await loadModel();
    console.log("✅ Model loaded");
  });
</script>

<main>
  <h1>Sign Language to Text</h1>
  <video bind:this={webcam} autoplay playsinline width="400" aria-label="Webcam feed"></video>

  <div style="font-size: 2rem; margin-top: 1rem;">
    Prediction: {prediction}
    <pre style="max-height: 200px; overflow: auto; text-align: left; font-size: 0.7rem;">{debug}</pre>

  </div>
</main>

<style>
  main {
    text-align: center;
    padding: 2rem;
    font-family: sans-serif;
  }

  video {
    margin-top: 1rem;
    border-radius: 10px;
    border: 2px solid #333;
    background-color: black;
    display: block;
  }
</style>
