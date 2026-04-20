const fs = require('fs');
const path = 'backend/server.js';

let content = fs.readFileSync(path, 'utf8');

// 1. Define the Short-Circuit Logic (using Template Strings carefully)
const NEW_LOGIC = `                let outputText = (stdout || '').trim();

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
                    
                    finalProse = finalProse.replace(/\\\`\\\`\\\`json[\\s\\S]*?\\\`\\\`\\\`/gi, '');
                    finalProse = finalProse.replace(/\\\`\\\`\\\`[\\s\\S]*?\\\`\\\`\\\`/gi, '');
                    finalProse = finalProse.trim();
                    
                    resolve(\`🔬 **Data Analysis Result**:\\n\\n\${finalProse}\`);
                    return; 
                }
`;

// 2. Identify the target line for insertion
const targetLine = "let outputText = (stdout || '').trim();";
let index = content.indexOf(targetLine);

if (index !== -1) {
    // Insert new logic
    content = content.substring(0, index) + NEW_LOGIC + content.substring(index + targetLine.length);
    console.log("Inserted Short-Circuit logic.");
} else {
    console.log("Error: Target line not found.");
    process.exit(1);
}

// 3. Remove the OLD flawed block
const oldStart = "// --- TOTAL TECHNICAL PURGE (Aggressive Prose Intercept) ---";
const oldEnd = "// --- INTENT DETECTION (Refinement) ---";

let startIndex = content.indexOf(oldStart);
let endIndex = content.indexOf(oldEnd);

if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    content = content.substring(0, startIndex) + oldEnd + content.substring(endIndex + oldEnd.length);
    console.log("Removed old flawed block.");
} else {
    console.log("Warning: Old block not found or indices mismatch.");
}

fs.writeFileSync(path, content, 'utf8');
console.log("Success: server.js updated.");
