import os

path = 'backend/server.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the EXECUTIVE_REPORT_PROMPT for Dynamic Titles
# Using single quotes for the inner strings to avoid escaping issues
NEW_PROMPT_ADDITION = """
- **TITLE EXTRACTION**: Analyze the chat history to see if the user specified a custom title for the report (e.g., 'Set title to Q1 Audit'). 
- If found, start your response with '# TITLE: [Custom Title]'. 
- If no title is requested, start with '# TITLE: Executive Analysis Report'.
"""

if "EXECUTIVE_REPORT_PROMPT =" in content:
    content = content.replace("CRITICAL RULES:", NEW_PROMPT_ADDITION + "\nCRITICAL RULES:")

# 2. Update GET_BRANDED_HTML to accept dynamic title
OLD_TEMPLATE_START = "const GET_BRANDED_HTML = (contentHtml) => `"
NEW_TEMPLATE_START = "const GET_BRANDED_HTML = (contentHtml, title = 'Executive Analysis Report') => `"

if OLD_TEMPLATE_START in content:
    content = content.replace(OLD_TEMPLATE_START, NEW_TEMPLATE_START)
    content = content.replace("<h1>Executive Analysis Report</h1>", "<h1>${title}</h1>")
    content = content.replace("<title>Executive Analysis Report</title>", "<title>${title}</title>")

# 3. Update the report generator endpoint to extract the title
OLD_REPORT_LOGIC = """    // 4. Render to Branded HTML
    const contentHtml = markdownIt.render(reportMarkdown);
    const fullHtml = GET_BRANDED_HTML(contentHtml);"""

NEW_REPORT_LOGIC = """    // 4. Render to Branded HTML with Dynamic Title Extraction
    let finalTitle = "Executive Analysis Report";
    let processedMarkdown = reportMarkdown;
    
    const titleMatch = reportMarkdown.match(/^# TITLE:\\s*(.*)/m);
    if (titleMatch) {
        finalTitle = titleMatch[1].trim();
        // Remove the title line from the markdown body to avoid double content
        processedMarkdown = reportMarkdown.replace(/^# TITLE:.*\\n?/m, '').trim();
    }

    const contentHtml = markdownIt.render(processedMarkdown);
    const fullHtml = GET_BRANDED_HTML(contentHtml, finalTitle);"""

if OLD_REPORT_LOGIC in content:
    content = content.replace(OLD_REPORT_LOGIC, NEW_REPORT_LOGIC)

# 4. IMPLEMENT THE HARD LOGIC INTERCEPT for /api/analyze-data
INTERCEPTOR_LOGIC = """
                // --- HARD LOGIC INTERCEPT ---
                // If this is the "Magic Summary" (initial description), forcibly strip tables/charts
                const magicSummaryKeyword = "Briefly summarize what this data is about and provide a meta-description";
                if (message && message.includes(magicSummaryKeyword)) {
                    try {
                        const jsonMatch = outputText.match(/\\{[\\s\\S]*\\}|\\[[\\s\\S]*\\]/);
                        if (jsonMatch) {
                            let parsed = JSON.parse(jsonMatch[0]);
                            // Forcibly clear technical bloat
                            parsed.tableData = null;
                            parsed.chartConfig = null;
                            parsed.primaryView = "table"; // Default to table (which is now empty)
                            
                            const cleanJson = JSON.stringify(parsed, null, 2);
                            outputText = outputText.replace(jsonMatch[0], `\\n\`\`\`json\\n${cleanJson}\\n\`\`\`\\n`);
                        }
                    } catch (e) {
                        console.error('Interceptor Error:', e);
                    }
                }
"""

if "// --- INTENT DETECTION (Refinement) ---" in content:
    content = content.replace("// --- INTENT DETECTION (Refinement) ---", INTERCEPTOR_LOGIC + "\n                        // --- INTENT DETECTION (Refinement) ---")

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(content)

print("Dynamic Titles and Summary-Only Hard Intercept implemented in server.js.")
