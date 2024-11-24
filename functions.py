from restack_ai.function import function
import os
from datetime import datetime
import json

# Create logs directory if it doesn't exist
os.makedirs('logs', exist_ok=True)

@function.defn()
async def analyze_email(email_content: str) -> None:
    # Generate timestamp for unique log file name
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file = f'logs/email_analysis_{timestamp}.log'
    
    # Create log entry
    log_data = {
        'timestamp': timestamp,
        'email_content': email_content,
        'analysis_result': email_content  # Your analysis logic here
    }
    
    # Write to log file
    with open(log_file, 'w') as f:
        json.dump(log_data, f, indent=4)