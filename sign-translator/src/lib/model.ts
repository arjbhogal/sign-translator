import * as tf from '@tensorflow/tfjs';

let model: tf.LayersModel | tf.GraphModel | null = null;
let labelMap: string[] = [];
let isModelLoaded = false;

interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

interface PredictionResult {
  letter: string;
  confidence: number;
  isSpecialAction?: boolean; // Kennzeichnet DELETE oder SPACE
}

// Try multiple approaches to load the model
export async function loadModel(): Promise<void> {
  try {
    console.log("Starting model loading process...");
    
    // Check if TensorFlow.js is properly loaded
    if (!tf) {
      throw new Error("TensorFlow.js is not properly loaded. Check script inclusion in HTML.");
    }
    
    // Initialize TensorFlow.js
    console.log("Initializing TensorFlow.js...");
    await tf.ready();
    console.log("TensorFlow.js ready, backend:", tf.getBackend());
    
    // Initialize label mapping with 26 letters + DELETE + SPACE = 28 classes
    labelMap = [
      ...('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), // 26 Buchstaben
      'DELETE', // Index 26
      'SPACE'   // Index 27
    ];
    console.log("Label map initialized:", labelMap);
    
    // Try different model loading approaches
    const modelUrl = '/tfjs_model/model.json';
    console.log(`Attempting to load model from: ${modelUrl}`);
    
    try {
      // First, try to load as a GraphModel (converted from TensorFlow SavedModel)
      console.log("Trying to load as GraphModel...");
      model = await tf.loadGraphModel(modelUrl);
      console.log("Successfully loaded as GraphModel");
    } catch (graphError) {
      console.warn("Failed to load as GraphModel:", graphError);
      
      try {
        // If GraphModel fails, try to load as a LayersModel (converted from Keras)
        console.log("Trying to load as LayersModel...");
        model = await tf.loadLayersModel(modelUrl);
        console.log("Successfully loaded as LayersModel");
      } catch (layersError) {
        console.error("Failed to load as LayersModel:", layersError);
        
        // As a last resort, create a simple model with the expected shape
        console.warn("Creating a fallback model for testing...");
        try {
          model = createFallbackModel();
          console.log("Created fallback model for testing");
        } catch (fallbackError) {
          console.error("Failed to create fallback model:", fallbackError);
          throw new Error("All model loading attempts failed");
        }
      }
    }
    
    // Test the model with dummy data
    console.log("Testing model with dummy data...");
    const dummyInput = tf.zeros([1, 63]);
    const result = model.predict(dummyInput);
    
    if (Array.isArray(result)) {
      console.log("Model outputs multiple tensors");
      result.forEach((tensor, i) => {
        console.log(`Output ${i} shape:`, tensor.shape);
        tensor.dispose();
      });
    } else {
      console.log("Model output shape:", result.shape);
      result.dispose();
    }
    
    dummyInput.dispose();
    
    isModelLoaded = true;
    console.log("Model initialization complete, ready for predictions");
  } catch (error) {
    console.error("Failed to load model:", error);
    throw new Error(`Model loading failed: ${error.message}`);
  }
}

// Create a simple fallback model for testing purposes (now with 28 outputs)
function createFallbackModel(): tf.LayersModel {
  const input = tf.input({shape: [63]});
  const dense1 = tf.layers.dense({units: 128, activation: 'relu'}).apply(input);
  const dense2 = tf.layers.dense({units: 64, activation: 'relu'}).apply(dense1);
  const output = tf.layers.dense({units: 28, activation: 'softmax'}).apply(dense2); // 28 statt 26
  
  const fallbackModel = tf.model({inputs: input, outputs: output as tf.SymbolicTensor});
  
  // Initialize with random weights
  fallbackModel.weights.forEach(w => {
    const randomValues = tf.randomNormal(w.shape);
    w.val.assign(randomValues);
    randomValues.dispose();
  });
  
  return fallbackModel;
}

export function predictFromLandmarks(landmarks: HandLandmark[]): PredictionResult | null {
  if (!isModelLoaded || !model) {
    console.warn("⚠️ Model not loaded yet");
    return null;
  }

  if (!landmarks || landmarks.length !== 21) {
    console.warn(`⚠️ Invalid landmarks: expected 21, got ${landmarks?.length || 0}`);
    return null;
  }

  try {
    // Convert landmarks to flat array
    const inputData = landmarks.flatMap(p => [p.x, p.y, p.z]);
    
    // Validate input data
    if (inputData.length !== 63) {
      console.error(`Invalid input data length: expected 63, got ${inputData.length}`);
      return null;
    }
    
    // Create input tensor
    const input = tf.tensor2d([inputData], [1, 63]);
    
    // Get prediction
    const prediction = model.predict(input) as tf.Tensor;
    const predictionArray = prediction.arraySync() as number[][];
    const confidences = predictionArray[0];
    
    // Get the highest confidence prediction
    const maxConfidence = Math.max(...confidences);
    const predictedIndex = confidences.indexOf(maxConfidence);
    
    // Ensure index is valid
    if (predictedIndex < 0 || predictedIndex >= labelMap.length) {
      console.error(`Invalid prediction index: ${predictedIndex}`);
      return null;
    }
    
    const letter = labelMap[predictedIndex];
    const isSpecialAction = letter === 'DELETE' || letter === 'SPACE';
    
    // Log top 5 predictions for debugging (jetzt mehr da wir 28 Klassen haben)
    const top5 = [...confidences]
      .map((conf, idx) => ({ letter: labelMap[idx], confidence: conf }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
    
    console.log("Top 5 predictions:", top5);
    
    // Clean up tensors
    input.dispose();
    prediction.dispose();
    
    return {
      letter,
      confidence: maxConfidence,
      isSpecialAction
    };
  } catch (error) {
    console.error("Prediction error:", error);
    return null;
  }
}