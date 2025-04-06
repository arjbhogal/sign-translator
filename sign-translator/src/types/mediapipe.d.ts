// Type definitions for MediaPipe libraries

interface HandLandmark {
    x: number;
    y: number;
    z: number;
  }
  
  interface HandsResults {
    multiHandLandmarks: HandLandmark[][];
    multiHandedness: {
      index: number;
      score: number;
      label: 'Left' | 'Right';
    }[];
    image: HTMLCanvasElement;
  }
  
  interface HandsOptions {
    maxNumHands?: number;
    modelComplexity?: 0 | 1;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
  }
  
  interface Hands {
    new(options?: { locateFile: (file: string) => string }): Hands;
    setOptions(options: HandsOptions): void;
    onResults(callback: (results: HandsResults) => void): void;
    send(input: { image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement }): Promise<void>;
    close(): Promise<void>;
  }
  
  interface CameraOptions {
    width: number;
    height: number;
    onFrame: () => Promise<void>;
  }
  
  interface Camera {
    new(videoElement: HTMLVideoElement, options: CameraOptions): Camera;
    start(): Promise<void>;
    stop(): Promise<void>;
  }
  
  declare global {
    const Hands: Hands;
    const Camera: Camera;
  }
  
  export {};