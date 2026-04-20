import os

path = 'frontend/src/components/Reporting/ReportingEngine.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Audit with Analysis
content = content.replace('Audit Portal', 'Analysis Portal')
content = content.replace('Audit Intelligence', 'Intelligence')
content = content.replace('Executive_Report_', 'Executive_Analysis_')

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(content)

print("ReportingEngine UI terminology updated successfully.")
