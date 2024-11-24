// Function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in meters
}

// Function to calculate speed in MPH
function calculateSpeed(distance, timeElapsed) {
    const metersPerSecond = distance / (timeElapsed / 1000);
    return (metersPerSecond * 2.237).toFixed(2); // Convert to MPH
}

function updateComparisonMetrics(images) {
    if (images.length < 2) return;

    const image1 = images[images.length - 2]; // Previous image
    const image2 = images[images.length - 1]; // Latest image

    try {
        // Calculate distance
        const distance = calculateDistance(
            image1.gps.latitude,
            image1.gps.longitude,
            image2.gps.latitude,
            image2.gps.longitude
        );

        // Calculate time difference
        const time1 = new Date(image1.timestamp);
        const time2 = new Date(image2.timestamp);
        const timeElapsed = Math.abs(time2 - time1);

        // Calculate metrics
        const speed = calculateSpeed(distance, timeElapsed);
        const elevationChange = (
            image2.gps.altitude - 
            image1.gps.altitude
        ).toFixed(2);

        // Update comparison metrics section
        const comparisonMetrics = document.querySelector('.comparison-metrics');
        comparisonMetrics.innerHTML = `
            <div class="metric-group">
                <div class="metric-item">
                    <span class="metric-label">Speed</span>
                    <span class="metric-value">${(speed/100).toFixed(2)} kph</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Elevation Δ</span>
                    <span class="metric-value">${elevationChange}m</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Distance</span>
                    <span class="metric-value">${(((distance * 3.28084).toFixed(2))/100).toFixed(2)}ft</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Time Δ</span>
                    <span class="metric-value">${(timeElapsed / 1000).toFixed(1)}s</span>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error calculating comparison metrics:', error);
    }
}

// Function to update UI with image and metadata
function updateImageDisplay(imageData, index) {
    const preview = document.getElementById(`preview${index}`);
    const img = document.createElement('img');
    img.src = imageData.image;
    img.style.width = '100%';
    img.style.height = 'auto';
    preview.innerHTML = '';
    preview.appendChild(img);

    // Update metadata display
    document.getElementById(`gps${index}`).textContent = 
        `${imageData.gps.latitude.toFixed(6)}, ${imageData.gps.longitude.toFixed(6)}`;
    
    document.getElementById(`elevation${index}`).textContent = 
        `${imageData.gps.altitude.toFixed(1)}m`;
    
    document.getElementById(`timestamp${index}`).textContent = 
        new Date(imageData.timestamp).toLocaleString();
}

// Function to fetch and process new images
async function fetchImages() {
    try {
        const response = await fetch('/get_latest_images');
        const data = await response.json();
        
        if (data.count >= 2) {
            // Update displays
            updateImageDisplay(data.images[data.count - 1], 1); // Latest image
            updateImageDisplay(data.images[data.count - 2], 2); // Previous image
            
            // Update metrics
            updateComparisonMetrics(data.images);
        }
    } catch (error) {
        console.error('Error fetching images:', error);
    }
}

let socket;

document.addEventListener('DOMContentLoaded', () => {
    // Connect to WebSocket server
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        // Request initial update
        requestUpdate();
    });

    socket.on('status', (data) => {
        console.log('Status:', data.message);
    });

    socket.on('image_update', (data) => {
        updateImages(data.images);
        updateComparisonMetrics(data.images);
    });

    // Set up periodic updates
    setInterval(requestUpdate, 1000); // Request update every second
});

function requestUpdate() {
    socket.emit('request_update');
}

function formatMotionData(motionData) {
    if (!motionData) return 'No motion data available';
    
    return `
        <div class="motion-metrics">
            <p class="metric">
                <span class="metric-label">Motion Intensity:</span>
                <span class="metric-value">${motionData.average_magnitude.toFixed(2)}</span>
            </p>
            <p class="metric">
                <span class="metric-label">Motion Coverage:</span>
                <span class="metric-value">${motionData.motion_percentage.toFixed(1)}%</span>
            </p>
            <p class="metric">
                <span class="metric-label">Primary Direction:</span>
                <span class="metric-value ${motionData.primary_direction}">${motionData.primary_direction || 'none'}</span>
            </p>
        </div>
    `;
}

function updateImages(images) {
    const container = document.querySelector('.image-container');
    container.innerHTML = ''; // Clear existing images

    images.forEach((imageData, index) => {
        const box = document.createElement('div');
        box.className = 'image-box';
        
        const title = document.createElement('h3');
        title.textContent = `Image ${index + 1}`;
        
        const img = document.createElement('img');
        img.src = imageData.image;
        img.alt = `Captured Image ${index + 1}`;
        
        const metadata = document.createElement('div');
        metadata.className = 'metadata';
        
        const timestamp = new Date(imageData.timestamp).toLocaleString();
        const gpsCoords = `${imageData.gps.latitude.toFixed(6)}, ${imageData.gps.longitude.toFixed(6)}`;
        const altitude = imageData.gps.altitude.toFixed(2);
        
        metadata.innerHTML = `
            <div class="metadata-section">
                <h4>Capture Info</h4>
                <p><span class="label">Time:</span> ${timestamp}</p>
                <p><span class="label">GPS:</span> ${gpsCoords}</p>
                <p><span class="label">Altitude:</span> ${altitude}m</p>
            </div>
            <div class="metadata-section">
                <h4>Motion Analysis</h4>
                ${formatMotionData(imageData.motion)}
            </div>
        `;
        
        box.appendChild(title);
        box.appendChild(img);
        box.appendChild(metadata);
        container.appendChild(box);
    });
}
