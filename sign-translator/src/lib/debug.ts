/**
 * Utility functions for debugging the hand sign recognition application
 */

// Map of letter indexes to their corresponding letters
const LETTER_MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Draw hand landmarks on a canvas for visualization
export function drawHandLandmarks(
  landmarks: any[],
  canvas: HTMLCanvasElement,
  flipHorizontal: boolean = true
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Set drawing styles
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#30FF30';
  ctx.lineWidth = 2;

  // Draw connections between landmarks
  drawConnections(landmarks, ctx, canvas.width, canvas.height, flipHorizontal);

  // Draw landmarks
  landmarks.forEach((landmark, index) => {
    const x = flipHorizontal ? canvas.width - landmark.x * canvas.width : landmark.x * canvas.width;
    const y = landmark.y * canvas.height;

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = index === 0 ? '#FF3030' : '#30FF30';
    ctx.fill();

    // Add index numbers for debugging
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.fillText(index.toString(), x + 10, y + 5);
  });
}

// Draw connections between landmarks to form a hand skeleton
function drawConnections(
  landmarks: any[], 
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  flipHorizontal: boolean
): void {
  // Define connections between landmarks (finger joints)
  const connections = [
    // Thumb
    [0, 1], [1, 2], [2, 3], [3, 4],
    // Index finger
    [0, 5], [5, 6], [6, 7], [7, 8],
    // Middle finger
    [0, 9], [9, 10], [10, 11], [11, 12],
    // Ring finger
    [0, 13], [13, 14], [14, 15], [15, 16],
    // Pinky
    [0, 17], [17, 18], [18, 19], [19, 20],
    // Palm
    [0, 5], [5, 9], [9, 13], [13, 17]
  ];

  // Draw each connection
  connections.forEach(([i, j]) => {
    const start = landmarks[i];
    const end = landmarks[j];

    if (start && end) {
      const startX = flipHorizontal ? width - start.x * width : start.x * width;
      const startY = start.y * height;
      const endX = flipHorizontal ? width - end.x * width : end.x * width;
      const endY = end.y * height;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  });
}

// Log tensor details to console for debugging
export function logTensorDetails(tensor: any, name: string = 'Tensor'): void {
  console.log(`${name} shape:`, tensor.shape);
  console.log(`${name} dtype:`, tensor.dtype);
  console.log(`${name} values:`, tensor.arraySync());
}

// Format prediction results for display
export function formatPredictions(
  confidences: number[], 
  threshold: number = 0.1
): string {
  let results = '';
  
  for (let i = 0; i < confidences.length; i++) {
    if (confidences[i] >= threshold) {
      results += `${LETTER_MAP[i]}: ${(confidences[i] * 100).toFixed(1)}%\n`;
    }
  }
  
  return results || 'No confident predictions';
}