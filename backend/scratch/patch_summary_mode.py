import os

path = 'backend/server.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Target the data analysis system prompt
OLD_RULE = "If the user mentions 'no plots' or 'no charts', return chartConfig: null."
NEW_RULE = "If the user explicitly asks to avoid plots, charts, or data tables, you MUST set 'chartConfig': null and 'tableData': null in your return JSON. Focus only on the 'summary' and 'primaryView': 'table'."

if OLD_RULE in content:
    content = content.replace(OLD_RULE, NEW_RULE)
else:
    # Fallback: find the system prompt area and inject it
    if 'If you provide visual intelligence' in content:
        content = content.replace('If you provide visual intelligence', NEW_RULE + '\nIf you provide visual intelligence')

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(content)

print("Backend data analysis rules updated for summary-only mode.")
