document.addEventListener('DOMContentLoaded', function() {
    const image1 = document.getElementById('image1');
    const image2 = document.getElementById('image2');
    const timestamp1Element = document.getElementById('timestamp1');
    const timestamp2Element = document.getElementById('timestamp2');
    const timeIntervalElement = document.getElementById('timeInterval');
    const motionEstimateElement = document.getElementById('motionEstimate');
    const testButton = document.getElementById('testButton');

    function setLoading(isLoading) {
        const metrics = [timeIntervalElement, motionEstimateElement];
        metrics.forEach(element => {
            element.classList.toggle('loading', isLoading);
        });
    }

    async function fetchImages() {
        try {
            const response = await fetch('/images');
            const imageList = await response.json();

            if (imageList.length < 2) {
                throw new Error('Not enough images found. Need at least 2 images.');
            }

            // Display the two earliest images
            image1.src = `/images/${imageList[0]}`;
            image2.src = `/images/${imageList[1]}`;

            // Analyze motion
            await analyzeMotion();

        } catch (error) {
            console.error('Error:', error);
            motionEstimateElement.textContent = `Error: ${error.message}`;
        }
    }

    async function analyzeMotion() {
        try {
            testButton.disabled = true;
            testButton.textContent = '⚡ Analyzing...';
            setLoading(true);
            
            const motionResponse = await fetch('/analyze_motion');
            const motionData = await motionResponse.json();

            if (motionData.error) {
                throw new Error(motionData.error);
            }

            // Update timestamps
            const time1 = new Date(motionData.timestamp1);
            const time2 = new Date(motionData.timestamp2);
            timestamp1Element.textContent = `Captured: ${time1.toLocaleString()}`;
            timestamp2Element.textContent = `Captured: ${time2.toLocaleString()}`;

            // Calculate and display time interval
            const intervalSeconds = (time2 - time1) / 1000;
            timeIntervalElement.textContent = `${intervalSeconds.toFixed(2)} seconds`;

            // Format motion analysis results
            const motionText = [
                `Average Magnitude: ${motionData.average_magnitude.toFixed(2)}`,
                `Motion Coverage: ${motionData.motion_percentage.toFixed(1)}%`,
                `Primary Direction: ${motionData.primary_direction.charAt(0).toUpperCase() + motionData.primary_direction.slice(1)}`
            ].join('\n');

            motionEstimateElement.textContent = motionText;
            motionEstimateElement.style.whiteSpace = 'pre-line';

        } catch (error) {
            console.error('Error:', error);
            motionEstimateElement.textContent = `Error: ${error.message}`;
        } finally {
            testButton.disabled = false;
            testButton.textContent = '🔄 Run Motion Analysis';
            setLoading(false);
        }
    }

    // Add click handler for test button
    testButton.addEventListener('click', analyzeMotion);

    // Start fetching images immediately
    fetchImages();

    // Set up an interval to periodically check for new images
    setInterval(fetchImages, 5000); // Check every 5 seconds
});
