import json
import os

transcript_path = r"C:\Users\aleri\.gemini\antigravity\brain\d8603d34-4a6d-430e-99d6-089dc38f0d78\.system_generated\logs\transcript.jsonl"

if not os.path.exists(transcript_path):
    print("Transcript path does not exist!")
    exit(1)

with open(transcript_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines in transcript: {len(lines)}")
# Look at the last 20 steps
for i in range(max(0, len(lines) - 20), len(lines)):
    try:
        obj = json.loads(lines[i])
        step = obj.get("step_index", i)
        step_type = obj.get("type", "")
        print(f"Step {step}: Type={step_type}")
        if "tool_calls" in obj:
            for tc in obj["tool_calls"]:
                name = tc.get("name", "")
                args = tc.get("args", {})
                print(f"  Tool Call: {name}")
                if "TargetFile" in args:
                    print(f"    TargetFile: {args['TargetFile']}")
                if "CommandLine" in args:
                    print(f"    CommandLine: {args['CommandLine']}")
    except Exception as e:
        print(f"Error parsing line {i}: {e}")
