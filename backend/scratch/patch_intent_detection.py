import os

path = 'backend/server.js'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = 0
for i, line in enumerate(lines):
    if skip > 0:
        skip -= 1
        continue
    
    # Target the parsing logic
    if 'let parsed = JSON.parse(jsonMatch[0]);' in line:
        # Keep the original line
        new_lines.append(line)
        # Add the next line (sanitization)
        new_lines.append(lines[i+1])
        
        indent = line[:line.find('let')]
        # Inject Intent Detection
        new_lines.append(f"{indent}\n")
        new_lines.append(f"{indent}// --- INTENT DETECTION (Refinement) ---\n")
        new_lines.append(f"{indent}const visualKeywords = ['plot', 'graph', 'chart', 'visual', 'visualise', 'trend', 'distribution', 'scatter', 'bar', 'histogram', 'line'];\n")
        new_lines.append(f"{indent}const userPrompt = (message || \"\").toLowerCase();\n")
        new_lines.append(f"{indent}const hasVisualIntent = visualKeywords.some(k => userPrompt.includes(k));\n")
        new_lines.append(f"{indent}\n")
        new_lines.append(f"{indent}if (hasVisualIntent) {{\n")
        new_lines.append(f"{indent}    parsed.primaryView = parsed.primaryView || \"chart\";\n")
        new_lines.append(f"{indent}}} else {{\n")
        new_lines.append(f"{indent}    parsed.primaryView = \"table\"; \n")
        new_lines.append(f"{indent}}}\n")
        new_lines.append(f"{indent}\n")
        
        # skip line[i+1] since we added it
        skip = 1
    else:
        new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Backend intent detection logic patched successfully.")
