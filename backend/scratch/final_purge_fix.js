const fs = require('fs');

// --- 1. Fix App.jsx (The Bridge) ---
const appPath = 'frontend/src/App.jsx';
let appContent = fs.readFileSync(appPath, 'utf8');
const oldSend = 'const sendMessage = async () => {\n    if (!inputText.trim() && attachedFiles.length === 0) return;';

// Use a more robust search
const sendStart = appContent.indexOf('const sendMessage = async () => {');
if (sendStart !== -1) {
    const nextLine = appContent.indexOf('if (!inputText.trim()', sendStart);
    if (nextLine !== -1) {
        const insertion = `  const sendMessage = async (customText = null) => {
    const textToSend = typeof customText === 'string' ? customText : inputText;
    if (!textToSend.trim() && attachedFiles.length === 0) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('message', textToSend);
    if (activeConvId) formData.append('conversation_id', activeConvId);
    attachedFiles.forEach(f => formData.append('files', f));

    // Optimistic UI: show user message immediately
    const tempUserMsg = {
      role: 'user',
      content: textToSend,`;
        
        // Find the matching '};' or just replace a known block
        const blockEnd = appContent.indexOf('role: \'user\',', sendStart);
        const lineToReplaceEnd = appContent.indexOf('content: inputText,', blockEnd);
        
        if (lineToReplaceEnd !== -1) {
             const restOfFile = appContent.substring(lineToReplaceEnd + 'content: inputText,'.length);
             appContent = appContent.substring(0, sendStart) + insertion + restOfFile;
             fs.writeFileSync(appPath, appContent, 'utf8');
             console.log("Success: App.jsx messenger interface fixed.");
        }
    }
} else {
    console.log("Error: sendMessage not found in App.jsx");
}

// --- 2. Finalize server.js (The Enforcement) ---
const serverPath = 'backend/server.js';
let serverContent = fs.readFileSync(serverPath, 'utf8');
const magic = 'const magicSummaryKeyword = "Briefly summarize what this data is about and provide a meta-description";';

if (serverContent.includes(magic)) {
    console.log("Backend magic keyword already present.");
} else {
    const line = 'let outputText = (stdout || \'\').trim();';
    const index = serverContent.indexOf(line);
    if (index !== -1) {
        const inject = `                let outputText = (stdout || '').trim();

                // --- TOTAL TECHNICAL PURGE (Short-Circuit Enforcement) ---
                const magicSummaryKeyword = "Briefly summarize what this data is about"; 
                if (message && message.includes(magicSummaryKeyword)) {
                    let finalProse = outputText;
                    try {
                        const jsonMatch = outputText.match(/\\{[\\s\\S]*\\}|\\[[\\s\\S]*\\]/);
                        if (jsonMatch) {
                            const parsed = JSON.parse(jsonMatch[0]);
                            finalProse = parsed.summary || parsed.t || outputText;
                        }
                    } catch (e) {}
                    
                    // Kill ALL JSON and code blocks
                    finalProse = finalProse.replace(/\\\`\\\`\\\`json[\\s\\S]*?\\\`\\\`\\\`/gi, '');
                    finalProse = finalProse.replace(/\\\`\\\`\\\`[\\s\\S]*?\\\`\\\`\\\`/gi, '');
                    finalProse = finalProse.replace(/\\{[\\s\\S]*\\}/g, '');
                    finalProse = finalProse.trim();
                    
                    resolve(\`🔬 **Data Analysis Result**:\\n\\n\${finalProse}\`);
                    return; 
                }
`;
        serverContent = serverContent.replace(line, inject);
        fs.writeFileSync(serverPath, serverContent, 'utf8');
        console.log("Success: server.js enforcement rule strengthened.");
    }
}
