import os

path = 'backend/server.js'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "const visualKeywords = ['plot', 'graph', 'chart'" in line:
        new_lines.append("                        const visualKeywords = ['plot', 'graph', 'chart', 'visual', 'visualise', 'trend', 'distribution', 'scatter', 'bar', 'histogram', 'line', 'view relationship', 'relationship', 'correlation', 'compare'];\n")
    else:
        new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Keyword library expanded successfully.")
