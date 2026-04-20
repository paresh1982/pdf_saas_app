import os

path = 'backend/server.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# REFINED AGGRESSIVE INTERCEPTOR logic
# This version regex-extracts only the summary and PURGES all JSON/technical headers
INTERCEPTOR_LOGIC = """
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
                            // This ensures the frontend doesn't see a 'json' block and avoids building the dashboard
                            outputText = proseOnly.trim();
                        }
                        
                        // Security check: If there's any remaining JSON or markdown code blocks, strip them
                        outputText = outputText.replace(/```json[\\s\\S]*?```/gi, '');
                        outputText = outputText.replace(/```[\\s\\S]*?```/gi, '');
                        outputText = outputText.trim();
                        
                    } catch (e) {
                        console.error('Interceptor Error:', e);
                        // Fallback: If JSON parsing fails, just try to strip the json blocks manually
                        outputText = outputText.replace(/```json[\\s\\S]*?```/gi, '');
                        outputText = outputText.trim();
                    }
                }
"""

# Find the existing intercept and replace it with the aggressive one
# My previous script used some specific comments, let's target them
import re
pattern = r"// --- HARD LOGIC INTERCEPT ---[\s\S]*?// --- INTENT DETECTION \(Refinement\) ---"
content = re.sub(pattern, INTERCEPTOR_LOGIC + "\n                        // --- INTENT DETECTION (Refinement) ---", content)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(content)

print("Aggressive Prose Interceptor (Total Technical Purge) implemented in server.js.")
