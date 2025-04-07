<script lang="ts">
  import * as tf from '@tensorflow/tfjs';
  import { onMount } from 'svelte';

  let model: tf.LayersModel | null = null;

  onMount(async () => {
    model = await tf.loadLayersModel('/tfjs_model/model.json');
    console.log("Model loaded");

    const dummyInput = tf.zeros([1, 63]);
    const prediction = model.predict(dummyInput) as tf.Tensor;
    prediction.print();
  });
</script>

<p>Sign predictor initialized ✅</p>
