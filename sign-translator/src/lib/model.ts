import * as tf from '@tensorflow/tfjs';

let model: tf.LayersModel | null = null;
let labelMap: string[] = [];

export async function loadModel() {
  model = await tf.loadLayersModel('/tfjs_model/model.json');
  console.log("✅ Model loaded from /tfjs_model/model.json");
  labelMap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
}

export function predictFromLandmarks(landmarks: any[]): string | null {
  if (!model) {
    console.warn("⚠️ Model not loaded yet");
    return null;
  }

  if (!landmarks || landmarks.length !== 21) {
    console.warn("⚠️ Invalid landmarks:", landmarks);
    return null;
  }

  const input = tf.tensor([landmarks.flatMap(p => [p.x, p.y, p.z])]); // shape [1, 63]
  const prediction = model.predict(input) as tf.Tensor;
  const predictionArray = prediction.arraySync() as number[][];
  const confidences = predictionArray[0];

  const max = Math.max(...confidences);
  const predictedIndex = confidences.indexOf(max);
  const letter = labelMap[predictedIndex];

  console.log(`📈 Predicted index: ${predictedIndex} → ${letter} (Confidence: ${max.toFixed(2)})`);
  return letter;
}
