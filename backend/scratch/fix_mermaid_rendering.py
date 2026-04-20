import os

path = 'backend/server.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The script to inject for automatic rendering
RENDER_SCRIPT = """
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            // --- AUTO-RENDERER FOR MARKDOWN CODE BLOCKS ---
            // Finds markdown-style mermaid code blocks and converts them for rendering
            document.querySelectorAll('pre code.language-mermaid').forEach(block => {
                const pre = block.parentElement;
                const mermaidDiv = document.createElement('div');
                mermaidDiv.className = 'mermaid';
                mermaidDiv.textContent = block.textContent;
                pre.replaceWith(mermaidDiv);
            });

            mermaid.initialize({ 
                startOnLoad: true, 
                theme: 'dark',
                themeVariables: {
                    primaryColor: '#e63639',
                    primaryTextColor: '#fff',
                    primaryBorderColor: '#e63639',
                    lineColor: '#e63639',
                    secondaryColor: '#1da5a2',
                    tertiaryColor: '#1c1517'
                }
            });
        });
    </script>
"""

# Replace the existing initialization script
if "mermaid.initialize({" in content:
    # Find the start and end of the initialization block inside GET_BRANDED_HTML
    start_tag = "<script>"
    end_tag = "</script>"
    
    # We look for the script block that contains mermaid.initialize
    init_start = content.find("mermaid.initialize({")
    script_start = content.rfind(start_tag, 0, init_start)
    script_end = content.find(end_tag, init_start) + len(end_tag)
    
    if script_start != -1 and script_end != -1:
        content = content[:script_start] + RENDER_SCRIPT + content[script_end:]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(content)

print("Report visualization auto-renderer implemented.")
