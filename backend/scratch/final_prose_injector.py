import os

path = 'backend/server.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# REFINED AGGRESSIVE INTERCEPTOR logic
# This version focuses on exactly replacing the previous interceptor block
# without using complex regex search patterns.

INTERCEPTOR_BLOCK = """
                // --- TOTAL TECHNICAL PURGE (Aggressive Prose Intercept) ---
                const magicSummaryKeyword = "Briefly summarize what this data is about and provide a meta-description";
                if (message && message.includes(magicSummaryKeyword)) {
                    try {
                        const jsonMatch = outputText.match(/\\{[\\s\\S]*\\}|\\[[\\s\\S]*\\]/);
                        if (jsonMatch) {
                            let parsed = JSON.parse(jsonMatch[0]);
                            // Extract only the prose summary
                            let proseOnly = parsed.summary || parsed.t || outputText;
                            
                            // If it's still a JSON object, try to clean it up to just the text
                            if (typeof proseOnly === 'object') proseOnly = JSON.stringify(proseOnly);
                            
                            // Replace the entire outputText with just the prose
                            outputText = proseOnly.trim();
                        }
                        
                        // Strip remaining markdown artifacts
                        outputText = outputText.replace(/```json[\\s\\S]*?```/gi, '');
                        outputText = outputText.replace(/```[\\s\\S]*?```/gi, '');
                        outputText = outputText.trim();
                        
                    } catch (e) {
                        console.error('Interceptor Error:', e);
                        outputText = outputText.replace(/```json[\\s\\S]*?```/gi, '');
                        outputText = outputText.trim();
                    }
                }
"""

# Targeted Replacement: Find the start and end of the block we want to replace
import re

# We look for the start of the old interceptor and the start of the next section
start_marker = "// --- HARD LOGIC INTERCEPT ---"
end_marker = "// --- INTENT DETECTION (Refinement) ---"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    # Replace everything between the markers
    new_content = content[:start_idx] + INTERCEPTOR_BLOCK + "\n                        " + content[end_idx:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully injected Aggressive Prose Interceptor.")
else:
    print(f"Could not find markers: {start_idx}, {end_idx}")

# Also ensure tabulate is installed (already done but good to confirm)
