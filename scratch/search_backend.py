import json
import os

transcript_path = r"C:\Users\aleri\.gemini\antigravity\brain\d8603d34-4a6d-430e-99d6-089dc38f0d78\.system_generated\logs\transcript.jsonl"

if not os.path.exists(transcript_path):
    print("Transcript path does not exist!")
    exit(1)

with open(transcript_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        try:
            obj = json.loads(line)
            step = obj.get("step_index", i)
            step_type = obj.get("type", "")
            if "tool_calls" in obj:
                for tc in obj["tool_calls"]:
                    name = tc.get("name", "")
                    args = tc.get("args", {})
                    target = args.get("TargetFile", "")
                    if target and any(x in target for x in ["app.js", "server.js", "index.html"]):
                        print(f"Step {step}: Tool={name}, File={target}")
                        if "Description" in args:
                            print(f"  Description: {args['Description']}")
                        if "Instruction" in args:
                            print(f"  Instruction: {args['Instruction']}")
        except Exception as e:
            pass
