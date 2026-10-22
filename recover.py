import os
import json
import re
from datetime import datetime

brain_dir = r'C:\Users\User\.gemini\antigravity\brain'
out_dir = r'C:\Users\User\Downloads\Digital-Bridge-main'

def get_all_jsonls():
    jsonls = []
    for root, dirs, fnames in os.walk(brain_dir):
        if 'transcript_full.jsonl' in fnames:
            jsonls.append(os.path.join(root, 'transcript_full.jsonl'))
    return jsonls

def extract_view_file_content(output_text):
    # output_text contains lines like "1: line1\n2: line2\n"
    lines = []
    for line in output_text.split('\n'):
        # Match '1: ', '12: ', etc. at the start of the line
        m = re.match(r'^\d+:\s?(.*)$', line)
        if m:
            lines.append(m.group(1))
    return '\n'.join(lines)

def recover_files():
    files = {}
    events = []
    
    # 1. Parse all jsonls to collect events
    for jsonl in get_all_jsonls():
        try:
            with open(jsonl, 'r', encoding='utf-8') as f:
                for line in f:
                    data = json.loads(line)
                    events.append(data)
        except Exception as e:
            print(f"Error reading {jsonl}: {e}")

    # Sort events by timestamp
    events.sort(key=lambda x: x.get('created_at', ''))

    # Track pending tool calls by step_index/conversation_id or just by chronological order
    # It's easier to find the tool_calls in PLANNER_RESPONSE, then find the TOOL_RESPONSE in the next step.
    
    # Let's map tool_call_id to the action
    pending_calls = {}

    for step in events:
        if step.get('type') == 'PLANNER_RESPONSE' and step.get('tool_calls'):
            for tc in step['tool_calls']:
                tc_id = tc.get('id')
                name = tc.get('name')
                args = tc.get('args', {})
                if name in ['view_file', 'write_to_file', 'replace_file_content', 'default_api:view_file', 'default_api:write_to_file', 'default_api:replace_file_content']:
                    pending_calls[tc_id] = {'name': name.replace('default_api:', ''), 'args': args}

        if step.get('type') == 'TOOL_RESPONSE' and step.get('tool_responses'):
            for tr in step['tool_responses']:
                tc_id = tr.get('id')
                if tc_id in pending_calls:
                    call = pending_calls[tc_id]
                    name = call['name']
                    args = call['args']
                    output = tr.get('output', '')
                    
                    if name == 'view_file':
                        # If this was a successful full read, save it
                        # Wait, we only save if it's the original read? 
                        # Actually, keeping the LATEST read or write is fine, but write/replace modify it.
                        # Let's just reconstruct based on reads first.
                        if 'AbsolutePath' in args:
                            path = args['AbsolutePath']
                            if path.lower().startswith(out_dir.lower()):
                                content = extract_view_file_content(output)
                                if content.strip():
                                    # We only overwrite if we haven't seen it, or if it's longer?
                                    # Actually, let's just keep the latest content for each file!
                                    # Wait, what if we read a subset of the file later? 
                                    # The research agents read the FULL file. Their steps are earlier.
                                    # Let's just apply it. If it has lines, we assume it's the full file.
                                    if "Showing lines 1 to " in output or "Total Lines:" in output:
                                        files[path] = content

                    elif name == 'write_to_file':
                        if 'TargetFile' in args and 'CodeContent' in args:
                            path = args['TargetFile']
                            if path.lower().startswith(out_dir.lower()):
                                files[path] = args['CodeContent']

                    elif name == 'replace_file_content':
                        if 'TargetFile' in args and 'TargetContent' in args and 'ReplacementContent' in args:
                            path = args['TargetFile']
                            if path in files:
                                files[path] = files[path].replace(args['TargetContent'], args['ReplacementContent'])
                            else:
                                # For case sensitivity issues
                                for k in files:
                                    if k.lower() == path.lower():
                                        files[k] = files[k].replace(args['TargetContent'], args['ReplacementContent'])
                                        break

    # Write files out
    for path, content in files.items():
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Restored: {path}")
        except Exception as e:
            print(f"Failed to restore {path}: {e}")

if __name__ == '__main__':
    recover_files()