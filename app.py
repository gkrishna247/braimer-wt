from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import numpy as np
import io
import os
import cv2 # For OpenCV operations
import tensorflow as tf # For loading and using the Keras model

app = Flask(__name__)
CORS(app)

# --- Model Loading ---
MODEL_LOAD_PATH = 'effnet.h5' # Make sure this file is in the same directory or provide the correct path
loaded_model = None

try:
    if os.path.exists(MODEL_LOAD_PATH):
        loaded_model = tf.keras.models.load_model(MODEL_LOAD_PATH)
        print(f"Model '{MODEL_LOAD_PATH}' loaded successfully.")
    else:
        print(f"Error: Model file not found at '{MODEL_LOAD_PATH}'. The /analyze endpoint will not work.")
except Exception as e:
    print(f"Error loading Keras model: {e}")
    # loaded_model will remain None, and we can check for this in the analyze route

# Dummy user database (replace with a real database in production)
users = {
    "test@example.com": {"password": "password", "name": "Test User"}
}

@app.route('/', methods=['GET'])
def homepage():
    """Simple homepage to test server connection."""
    return '<h2>Braimer Deploy Server is running.</h2>', 200

@app.route('/login', methods=['POST'])
def login():
    """Handles user login."""
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if email in users and users[email]['password'] == password:
        return jsonify({'message': 'Login successful'}), 200
    else:
        return jsonify({'message': 'Invalid credentials'}), 401

@app.route('/analyze', methods=['POST'])
def analyze_image_endpoint(): # Renamed to avoid conflict with PIL.Image
    """
    Handles image analysis request from the frontend.
    Returns:
        json: the analysis result.
    """
    if loaded_model is None:
        return jsonify({"error": "AI Model not loaded on the server. Cannot perform analysis."}), 503 # Service Unavailable

    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        image_file = request.files['image']

        # Open the image using Pillow
        pil_image = Image.open(io.BytesIO(image_file.read()))

        # Preprocess image for the model
        preprocessed_image_array = preprocess_for_model(pil_image)

        # Run prediction
        prediction_result = run_model_prediction(preprocessed_image_array)

        return jsonify(prediction_result), 200 # prediction_result is already a dict

    except Exception as e:
        print(f"Error during analysis: {e}")
        return jsonify({"error": f"An error occurred during analysis: {str(e)}"}), 500

def preprocess_for_model(pil_img):
    """
    Preprocesses the PIL image for the effnet.h5 model.
    Args:
        pil_img (PIL.Image): The input image.
    Returns:
        numpy.ndarray: The preprocessed image array.
    """
    # Convert PIL Image to NumPy array
    img_array = np.array(pil_img)

    # If the image is RGBA or Grayscale, convert to RGB
    if img_array.ndim == 2: # Grayscale
        img_array = cv2.cvtColor(img_array, cv2.COLOR_GRAY2RGB)
    elif img_array.shape[2] == 4: # RGBA
        img_array = cv2.cvtColor(img_array, cv2.COLOR_RGBA2RGB)
    
    # Convert RGB (from PIL) to BGR (for OpenCV and potentially the model)
    opencv_image_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    
    # Resize to model's expected input size
    img_resized = cv2.resize(opencv_image_bgr, (150, 150))
    
    # Reshape for the model: (batch_size, height, width, channels)
    img_reshaped = img_resized.reshape(1, 150, 150, 3)
    
    # Normalization: The original Jupyter code doesn't show explicit normalization (e.g. /255.0)
    # before model.predict(). If your 'effnet.h5' model was trained on pixel values
    # in the range [0, 255], then no normalization is needed here.
    # If it was trained on [0, 1] or [-1, 1], you'd add:
    # img_reshaped = img_reshaped / 255.0  # For [0,1]
    # Or use tf.keras.applications.efficientnet.preprocess_input if it's a standard EfficientNet

    return img_reshaped

def run_model_prediction(image_array):
    """
    Runs prediction using the loaded Keras model and maps output to labels.
    Args:
        image_array (numpy.ndarray): The preprocessed image array.
    Returns:
        dict: A dictionary containing the prediction label and class.
    """
    if loaded_model is None: # Should be checked before calling, but as a safeguard
        raise RuntimeError("Model is not loaded.")

    prediction_probabilities = loaded_model.predict(image_array)
    predicted_class_index = np.argmax(prediction_probabilities, axis=1)[0]

    prediction_label = ""
    has_tumor = False # Default, will be overridden if a tumor is detected

    if predicted_class_index == 0:
        prediction_label = 'Glioma Tumor'
        has_tumor = True
    elif predicted_class_index == 1:
        prediction_label = 'No Tumor' # This means no tumor detected by the model
        has_tumor = False
    elif predicted_class_index == 2:
        prediction_label = 'Meningioma Tumor'
        has_tumor = True
    else: # Assuming class 3 for 'Pituitary Tumor'
        prediction_label = 'Pituitary Tumor'
        has_tumor = True

    return {
        "predicted_class_index": int(predicted_class_index), # Send as int
        "prediction_label": prediction_label,
        "has_tumor": has_tumor,
        "message": f"The model predicts: {prediction_label}" # A more direct message
    }

if __name__ == '__main__':
    # Make sure 'effnet.h5' is in the same directory as this script,
    # or update MODEL_LOAD_PATH.
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False) # use_reloader=False is good when loading models once