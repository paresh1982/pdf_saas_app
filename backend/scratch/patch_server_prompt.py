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
    
    # Check for the system prompt part
    if '3. VISUAL INTELLIGENCE (MANDATORY):' in line:
        # We found the block
        new_lines.append("3. VISUAL INTELLIGENCE: By default, provide a chartConfig for a visual dashboard. HOWEVER, if the user explicitly asks to avoid plots or charts, focus strictly on providing a high-fidelity 'summary' (brief idea about the data) and a 'tableData' view.\n")
        new_lines.append("4. META-ANALYTICS: For summaries, always include a 'Meta Data' section describing row/column counts and the inferred purpose of the dataset.\n")
        new_lines.append("5. Use absolute paths provided in the context below.\n")
        # skip lines 548 and 549 (historically 4 and 5 in the list)
        skip = 2 
    else:
        new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Server patch successfully applied.")
