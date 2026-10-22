import os
import json
import re

brain_dir = r'C:\Users\User\.gemini\antigravity\brain'
out_dir = r'C:\Users\User\Downloads\Digital-Bridge-main'

def extract_view_file_content(content):
    lines = []
    # Find the start of the code
    capture = False
    for line in content.split('\n'):
        if line.startswith('The following code has been modified'):
            capture = True
            continue
        if line.startswith('The above content does NOT show') or line.startswith('The above content shows the entire'):
            capture = False
            continue
            
        if capture:
            m = re.match(r'^\d+:\s(.*)$', line)
            if m:
                lines.append(m.group(1))
            else:
                # Sometimes empty lines are just '10:'
                m2 = re.match(r'^\d+:$', line)
                if m2:
                    lines.append('')
    return '\n'.join(lines)

def recover():
    files = {}
    events = []
    
    for root, dirs, fnames in os.walk(brain_dir):
        if 'transcript_full.jsonl' in fnames:
            try:
                with open(os.path.join(root, 'transcript_full.jsonl'), 'r', encoding='utf-8') as f:
                    for line in f:
                        events.append(json.loads(line))
            except:
                pass
                
    events.sort(key=lambda x: x.get('created_at', ''))

    for step in events:
        step_type = step.get('type')
        
        # Extract view_file from GENERIC
        if step_type == 'GENERIC' and 'File Path: `file:///' in step.get('content', ''):
            content = step['content']
            path_match = re.search(r'File Path: `file:///(.*?)`', content, re.IGNORECASE)
            if path_match:
                path = path_match.group(1).replace('%3A', ':')
                # fix slashes for windows if needed
                path = path.replace('/', '\\')
                if path.lower().startswith(out_dir.lower()):
                    file_content = extract_view_file_content(content)
                    if file_content.strip():
                        # We only initialize it if it's not there, or if we are reading the whole thing.
                        # Actually, keeping the latest read is fine, but it might be truncated.
                        if "Showing lines 1 to" in content:
                            files[path.lower()] = (path, file_content)

        # Apply writes and replaces
        if step_type == 'PLANNER_RESPONSE' and step.get('tool_calls'):
            for tc in step['tool_calls']:
                name = tc.get('name')
                args = tc.get('args', {})
                
                if name == 'write_to_file':
                    if 'TargetFile' in args and 'CodeContent' in args:
                        path = args['TargetFile']
                        if path.lower().startswith(out_dir.lower()):
                            files[path.lower()] = (path, args['CodeContent'])
                            
                elif name == 'replace_file_content':
                    if 'TargetFile' in args and 'TargetContent' in args and 'ReplacementContent' in args:
                        path = args['TargetFile']
                        key = path.lower()
                        if key in files:
                            orig_path, current_content = files[key]
                            new_content = current_content.replace(args['TargetContent'], args['ReplacementContent'])
                            files[key] = (orig_path, new_content)

    for key, (path, content) in files.items():
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Restored: {path}")
        except Exception as e:
            print(f"Failed to restore {path}: {e}")

if __name__ == '__main__':
    recover()