from restack_ai.function import function

@function.defn()
async def analyze_email(email_content: str) -> str:
    # Function logic
    return email_content