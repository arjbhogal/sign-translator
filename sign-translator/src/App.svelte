<script>
  let webcam;
  let prediction = 'Waiting...';
  import { onMount } from 'svelte';

onMount(() => {
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
      prediction = `Hand with ${landmarks.length} landmarks detected`;
      // TODO: Call prediction model
    } else {
      prediction = 'No hand detected';
    }
  });

  const camera = new Camera(webcam, {
    onFrame: async () => {
      await hands.send({ image: webcam });
    },
    width: 640,
    height: 480
  });

  camera.start();
});

</script>

<main>
  <h1>Sign Language to Text</h1>
  <video bind:this={webcam} autoplay playsinline width="400"></video>
  <div>Prediction: {prediction}</div>
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
  }
</style>
