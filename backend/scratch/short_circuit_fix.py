import os

path = 'backend/server.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# THE SHORT-CIRCUIT FIX
# This logic ensures that once we extract the summary for the initial trigger, 
# we STOP all further processing to prevent re-injection of JSON/Technical headers.

SHORT_CIRCUIT_LOGIC = """
                // --- TOTAL TECHNICAL PURGE (Short-Circuit Enforcement) ---
                const magicSummaryKeyword = "Briefly summarize what this data is about and provide a meta-description";
                if (message && message.includes(magicSummaryKeyword)) {
                    let finalProse = outputText;
                    try {
                        const jsonMatch = outputText.match(/\\{[\\s\\S]*\\}|\\[[\\s\\S]*\\]/);
                        if (jsonMatch) {
                            const parsed = JSON.parse(jsonMatch[0]);
                            finalProse = parsed.summary || parsed.t || outputText;
                            if (typeof finalProse === 'object') finalProse = JSON.stringify(finalProse);
                        }
                    } catch (e) {
                         console.error('Interceptor Error:', e);
                    }
                    
                    // Final Clean: Remove all markdown code blocks and excess whitespace
                    finalProse = finalProse.replace(/```json[\\s\\S]*?```/gi, '');
                    finalProse = finalProse.replace(/```[\\s\\S]*?```/gi, '');
                    finalProse = finalProse.trim();
                    
                    // IMPORTANT: We resolve here and SKIP the rest of the JSON/Visual logic
                    resolve(`🔬 **Data Analysis Result**:\\n\\n${finalProse}`);
                    return; 
                }
"""

# Injection point: Right after outputText is initialized from stdout
target = "let outputText = (stdout || '').trim();"
injection_point = content.find(target)

if injection_point != -1:
    insert_pos = injection_point + len(target)
    new_content = content[:insert_pos] + SHORT_CIRCUIT_LOGIC + content[insert_pos:]
    
    # We also need to remove the OLD interceptor blocks to avoid duplicate logic/errors
    # I'll remove the previous "TOTAL TECHNICAL PURGE" block if it exists
    old_block_pattern = r"// --- TOTAL TECHNICAL PURGE \(Aggressive Prose Intercept\) ---[\s\S]*?// --- INTENT DETECTION \(Refinement\) ---"
    new_content = re.sub(old_block_pattern, "// --- INTENT DETECTION (Refinement) ---", new_content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Success: Short-Circuit Enforcement deployed.")
else:
    print("Error: Could not find injection point.")
