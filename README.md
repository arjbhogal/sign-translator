# Sign Language Thesaurus

A web-based sign language translator that recognizes hand signs through the camera and converts them to text. The system uses TensorFlow.js and MediaPipe for real-time hand recognition.

## Features

- **Real-time hand recognition** via webcam with MediaPipe
- **26 alphabet letters** recognition
- **Special actions**:
  - DELETE: Clears all text
  - SEARCH: Performs search in sign language archive
- **Buffer system** with configurable tracking time (0.5-3 seconds)
- **Automatic text input** with sufficient confidence (60%)
- **Direct integration** with [gebaerden-archiv.at](https://gebaerden-archiv.at)

## Tech Stack

- **Frontend**: Svelte 5 + TypeScript
- **Styling**: Tailwind CSS 4
- **ML**: TensorFlow.js for hand sign classification
- **Computer Vision**: MediaPipe Hands for landmark detection
- **Build**: Vite

## Installation

```bash
# Clone repository
git clone [repository-url]
cd sign-translator

# Install dependencies
npm install

# Start development server
npm run dev
```

## Usage

1. **Grant camera permission** when prompted
2. **Show hand to camera**
3. **Display letters** - system recognizes automatically at >60% confidence
4. **DELETE gesture** to reset text
5. **SPACE gesture** for immediate search
6. **Adjust tracking time** via slider (0.5-3s)

## Project Structure

```
src/
├── App.svelte          # Main component
├── lib/
│   ├── model.ts        # TensorFlow.js model integration
│   └── debug.ts        # Debug utilities
├── types/
│   └── mediapipe.d.ts  # TypeScript definitions
public/
├── tfjs_model/         # Trained ML model
└── assets/             # Example gesture images
```

## Model

The system uses a neural network with:
- **Input**: 63 features (21 hand landmarks × 3 coordinates)
- **Architecture**: Dense(128) → Dense(64) → Dropout(0.3) → Dense(28)
- **Output**: 28 classes (A-Z + DELETE + SPACE)
- **Training**: Sparse Categorical Crossentropy

## Development

```bash
npm run dev      # Development server
npm run build    # Production build  
npm run preview  # Build preview
npm run check    # TypeScript checks
```

## Browser Requirements

- **Modern browsers** (Chrome, Firefox, Safari)
- **Camera access** required
- **HTTPS** recommended for camera API

## Known Limitations

- Model trained only on ASL
- Optimal lighting conditions required
- Single hand support only
- Static hand signs (no movements)

---

*Built for intuitive sign language to text translation*
