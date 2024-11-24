from flask import Flask, render_template, send_from_directory
from flask_socketio import SocketIO, emit
import os
import time
import cv2
import random
import uuid
import asyncio
from datetime import datetime
import json
from PIL import Image
import io
import base64
import numpy as np
from functions import analyze_email

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

# Store the last two images and their metadata
latest_images = []

async def lol(str):
    result = await analyze_email(str)
    print(result)

def calculate_motion(prev_frame, curr_frame):
    # Convert frames to grayscale
    if len(prev_frame.shape) == 3:
        gray1 = cv2.cvtColor(prev_frame, cv2.COLOR_RGB2GRAY)
    else:
        gray1 = prev_frame
        
    if len(curr_frame.shape) == 3:
        gray2 = cv2.cvtColor(curr_frame, cv2.COLOR_RGB2GRAY)
    else:
        gray2 = curr_frame
    
    # Calculate optical flow using Farneback method
    flow = cv2.calcOpticalFlowFarneback(gray1, gray2, None, 
                                        pyr_scale=0.5, levels=3, winsize=15, 
                                        iterations=3, poly_n=5, poly_sigma=1.2, 
                                        flags=0)
    
    # Calculate magnitude and angle of 2D vectors
    magnitude, angle = cv2.cartToPolar(flow[..., 0], flow[..., 1])
    
    # Calculate average magnitude of motion
    avg_magnitude = float(np.mean(magnitude))
    
    # Find areas of significant motion
    motion_threshold = np.mean(magnitude) + np.std(magnitude)
    motion_mask = magnitude > motion_threshold
    
    # Calculate percentage of pixels with significant motion
    motion_percentage = float((np.sum(motion_mask) / motion_mask.size) * 100)
    
    # Calculate primary direction of motion
    mean_angle = float(np.mean(angle[motion_mask])) if np.any(motion_mask) else 0
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

    asyncio.run(lol(f"restack output: {avg_magnitude}, {motion_percentage}, {direction}"))

    return {
        'average_magnitude': avg_magnitude,
        'motion_percentage': motion_percentage,
        'primary_direction': direction
    }

def capture_image():
    """Capture an image from the camera and extract metadata"""
    cap = cv2.VideoCapture(0)
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        return None, None
        
    # Convert frame to PIL Image
    img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(img)
    
    # Create a buffer to store the image
    img_buffer = io.BytesIO()
    pil_img.save(img_buffer, format='JPEG')
    img_buffer.seek(0)
    
    # Convert to base64 for sending to frontend
    img_base64 = base64.b64encode(img_buffer.getvalue()).decode()
    
    # Mock GPS data for testing (replace with real GPS data in production)
    metadata = {
        'timestamp': datetime.now().isoformat(),
        'gps': {
            'latitude': 37.7749 + (time.time() % 0.01),  # Mock changing coordinates
            'longitude': -122.4194 + (time.time() % 0.01),
            'altitude': 10 + (time.time() % 10)  # Mock changing altitude
        },
        'image': f'data:image/jpeg;base64,{img_base64}'
    }
    
    return metadata, frame

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('status', {'message': 'Connected to server'})

@socketio.on('request_update')
def handle_update_request():
    global latest_images
    
    new_metadata, new_frame = capture_image()
    if new_metadata and new_frame is not None:
        if len(latest_images) > 0:
            # Calculate motion metrics between the last two frames
            prev_frame = cv2.cvtColor(np.array(Image.open(io.BytesIO(base64.b64decode(latest_images[-1]['image'].split(',')[1])))), cv2.COLOR_RGB2BGR)
            motion_metrics = calculate_motion(prev_frame, new_frame)
            new_metadata['motion'] = motion_metrics
        
        latest_images.append(new_metadata)
        if len(latest_images) > 2:
            latest_images.pop(0)
        
        emit('image_update', {
            'images': latest_images,
            'count': len(latest_images)
        })

if __name__ == '__main__':
    socketio.run(app, debug=True)
