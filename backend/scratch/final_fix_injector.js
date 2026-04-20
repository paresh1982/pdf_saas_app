const fs = require('fs');
const path = 'backend/server.js';

let content = fs.readFileSync(path, 'utf8');

// 1. Define the Short-Circuit Logic
const SHORT_CIRCUIT = `                let outputText = (stdout || '').trim();
                
                // --- TOTAL TECHNICAL PURGE (Short-Circuit Enforcement) ---
                const magicSummaryKeyword = "Briefly summarize what this data is about and provide a meta-description";
                if (message && message.includes(magicSummaryKeyword)) {
                    let finalProse = outputText;
                    try {
                        const jsonMatch = outputText.match(/\\{[\\s\\S]*\\}|\\[[\\s\\S]*\\]/);
                        if (jsonMatch) {
                            const parsed = JSON.parse(jsonMatch[0]);
                            finalProse = parsed.summary || parsed.t || outputText;
                            if (typeof finalProse === 'object') {
                                finalProse = finalProse.summary || finalProse.t || JSON.stringify(finalProse);
                            }
                        }
                    } catch (e) {
                         console.error('Interceptor Error:', e);
                    }
                    finalProse = finalProse.replace(/```json[\\s\\S]*?```/gi, '').replace(/```[\\s\\S]*?```/gi, '').trim();
                    resolve(\`🔬 **Data Analysis Result**:\\n\\n\${finalProse}\`);
                    return; 
                }
`;

// 2. Inject it at the right place
content = content.replace("let outputText = (stdout || '').trim();", SHORT_CIRCUIT);

// 3. Remove the OLD redundant block to keep code clean
// We use a regex that is flexible about whitespace
const oldBlockRegex = /\\/\\/ --- TOTAL TECHNICAL PURGE \\(Aggressive Prose Intercept\\) ---[\\s\\S]*?if \\(message && message\\.includes\\(magicSummaryKeyword\\)\\) \\{[\\s\\S]*?\\}\\s*\\}/;
content = content.replace(oldBlockRegex, "");

fs.writeFileSync(path, content, 'utf8');
console.log("Success: Short-Circuit Enforcement injected via Node.js script.");
