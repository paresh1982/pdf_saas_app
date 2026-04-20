import os

path = 'frontend/src/App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = 0
for i, line in enumerate(lines):
    if skip > 0:
        skip -= 1
        continue
    
    # Check for the multi-line ReportingEngine block in the welcome state
    if '<ReportingEngine' in line and i + 5 < len(lines) and 'attachedFilesCount' in lines[i+4]:
        # We found the block at lines i to i+5
        indent = line[:line.find('<')]
        new_lines.append(f"{indent}{{isAnalysisMode && (\n")
        new_lines.append(line)
        new_lines.append(lines[i+1])
        new_lines.append(lines[i+2])
        new_lines.append(lines[i+3])
        new_lines.append(lines[i+4])
        new_lines.append(lines[i+5])
        new_lines.append(f"{indent})}}\n")
        skip = 5
    else:
        new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Patch successfully applied.")
