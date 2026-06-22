import json

log_path = r"C:\Users\aleri\.gemini\antigravity\brain\d8603d34-4a6d-430e-99d6-089dc38f0d78\.system_generated\logs\transcript.jsonl"

user_messages = []
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('type') == 'USER_INPUT':
                user_messages.append(data)
        except Exception as e:
            pass

print(f"Total user messages: {len(user_messages)}")
for msg in user_messages[-15:]:
    print("--- USER INPUT ---")
    content = msg.get('content', '')
    if content:
        print(content.encode('ascii', 'replace').decode('ascii'))
