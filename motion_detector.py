from flask import Flask, request, jsonify, send_from_directory
import cv2
import numpy as np
import os
from datetime import datetime
import re

app = Flask(__name__)

def extract_timestamp(filename):
    # Extract timestamp from filename
    match = re.search(r'(\d{13}|\d{10})', filename)
    if match:
        timestamp = int(match.group(1))
        # Convert to milliseconds if in seconds
        if len(match.group(1)) == 10:
            timestamp *= 1000
        return timestamp
    return 0

def get_sorted_images():
    image_dir = 'images'
    if not os.path.exists(image_dir):
        os.makedirs(image_dir)
    
    # Get all image files
    image_files = [f for f in os.listdir(image_dir) 
                  if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    
    # Sort by timestamp in filename
    image_files.sort(key=extract_timestamp)
    return image_files

def calculate_motion(img1_path, img2_path):
    # Read images
    img1 = cv2.imread(img1_path)
    img2 = cv2.imread(img2_path)
    
    # Convert to grayscale
    gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
    
    # Calculate optical flow using Farneback method
    flow = cv2.calcOpticalFlowFarneback(gray1, gray2, None, 
                                      pyr_scale=0.5, levels=3, winsize=15, 
                                      iterations=3, poly_n=5, poly_sigma=1.2, 
                                      flags=0)
    
    # Calculate magnitude and angle of 2D vectors
    magnitude, angle = cv2.cartToPolar(flow[..., 0], flow[..., 1])
    
    # Calculate average magnitude of motion
    avg_magnitude = np.mean(magnitude)
    
    # Find areas of significant motion
    motion_threshold = np.mean(magnitude) + np.std(magnitude)
    motion_mask = magnitude > motion_threshold
    
    # Calculate percentage of pixels with significant motion
    motion_percentage = (np.sum(motion_mask) / motion_mask.size) * 100
    
    # Calculate primary direction of motion
    mean_angle = np.mean(angle[motion_mask]) if np.any(motion_mask) else 0
    direction = ""
    if np.any(motion_mask):
        angle_deg = np.degrees(mean_angle) % 360
        if 45 <= angle_deg < 135:
            direction = "upward"
        elif 135 <= angle_deg < 225:
            direction = "leftward"
        elif 225 <= angle_deg < 315:
            direction = "downward"
        else:
            direction = "rightward"
    
    return {
        'average_magnitude': float(avg_magnitude),
        'motion_percentage': float(motion_percentage),
        'primary_direction': direction,
        'timestamp1': extract_timestamp(os.path.basename(img1_path)),
        'timestamp2': extract_timestamp(os.path.basename(img2_path))
    }

@app.route('/images')
def list_images():
    """Return list of image files sorted by timestamp"""
    return jsonify(get_sorted_images())

@app.route('/analyze_motion')
def analyze_motion():
    """Analyze motion between the two most recent images"""
    image_files = get_sorted_images()
    
    if len(image_files) < 2:
        return jsonify({'error': 'Need at least 2 images'}), 400
    
    # Get paths for the two most recent images
    img1_path = os.path.join('images', image_files[0])
    img2_path = os.path.join('images', image_files[1])
    
    try:
        motion_data = calculate_motion(img1_path, img2_path)
        return jsonify(motion_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_file(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    app.run(port=8000)
