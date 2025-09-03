import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const MAX_CHARS = 160000;

function clip(s: string) { 
  return s && s.length > MAX_CHARS ? s.slice(0, MAX_CHARS) : s; 
}

function stripHtmlFast(html: string): string {
  return (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractTextFromUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { 
      headers: { 
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.5",
        "cache-control": "no-cache"
      }
    });
    if (!res.ok) throw new Error(`Failed to fetch URL (${res.status})`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("html") || ct.includes("text")) {
      const body = await res.text();
      const cleanText = stripHtmlFast(body);
      
      if (cleanText.length < 100 || 
          cleanText.toLowerCase().includes("search jobs") ||
          cleanText.toLowerCase().includes("page not found") ||
          cleanText.toLowerCase().includes("access denied")) {
        return `Error: Unable to extract job content from this URL. The page may require JavaScript or have access restrictions. Please try:
1. Copy and paste the job description directly
2. Use a different job posting URL (try Indeed, LinkedIn Jobs, or company career pages)
3. Look for a "View Full Job Description" or "Apply" link that goes to a static page`;
      }
      
      return cleanText;
    }
    return "[Non-HTML content detected at URL]";
  } catch (error) {
    console.error("Error fetching URL:", error);
    return "Error fetching job posting content. Please check the URL and try again.";
  }
}

async function resumeTextFromInput(resumeUrl: string, file: File | null): Promise<string> {
  if (resumeUrl) {
    return extractTextFromUrl(resumeUrl);
  }
  
  if (file && typeof file.arrayBuffer === "function") {
    try {
      console.log("Processing PDF file:", file.name, file.size, file.type);
      
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        return "Error: Please upload a PDF file only.";
      }
      
      if (file.size > 10 * 1024 * 1024) {
        return "Error: PDF file too large. Please use a file smaller than 10MB.";
      }
      
      const buffer = await file.arrayBuffer();
      const bufferNode = Buffer.from(buffer);
      
      console.log("Buffer size:", bufferNode.length);
      
      let pdfParse;
      try {
        pdfParse = require('pdf-parse/lib/pdf-parse');
      } catch (e) {
        try {
          const pdfParseModule = await import('pdf-parse');
          pdfParse = pdfParseModule.default;
        } catch (e2) {
          return "Error: PDF parsing library not available. Please try using a resume URL instead.";
        }
      }
      
      const data = await pdfParse(bufferNode);
      console.log("PDF parsed successfully. Text length:", data.text?.length || 0);
      
      const text = data.text?.trim();
      if (!text || text.length < 10) {
        return "Error: Could not extract readable text from PDF. The PDF might be image-based or corrupted.";
      }
      
      return text;
    } catch (err: any) {
      console.error("PDF parse error details:", {
        message: err.message,
        name: err.name,
        code: err.code
      });
      
      if (err.code === 'ENOENT') {
        return "Error: PDF parsing initialization failed. Please try using a resume URL instead or try again.";
      } else if (err.message?.includes('Invalid PDF')) {
        return "Error: Invalid PDF file. Please ensure the file is not corrupted.";
      } else if (err.message?.includes('password')) {
        return "Error: Password-protected PDFs are not supported.";
      } else {
        return `Error parsing PDF: ${err.message || 'Unknown error'}. Please try a different PDF file or use a resume URL.`;
      }
    }
  }
  
  throw new Error("Provide a resume URL or upload a PDF file.");
}

export async function GET() {
  console.log("GET /api/analyze called");
  return NextResponse.json({ 
    ok: true, 
    message: "Resume Analysis API is running",
    route: "/api/analyze", 
    expects: "POST form-data with jobUrl and (resumeUrl or resumeFile)",
    timestamp: new Date().toISOString(),
    openai_configured: !!process.env.OPENAI_API_KEY,
    environment: process.env.NODE_ENV
  });
}

export async function POST(req: NextRequest) {
  console.log("POST /api/analyze called");
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" }, 
        { status: 500 }
      );
    }

    const form = await req.formData();
    const jobUrl = String(form.get("jobUrl") || "");
    const jobDescription = String(form.get("jobDescription") || "");
    const resumeUrl = String(form.get("resumeUrl") || "");
    const file = form.get("resumeFile") as unknown as File | null;

    console.log("Form data:", { jobUrl, jobDescription: !!jobDescription, resumeUrl, hasFile: !!file });

    if (!jobUrl && !jobDescription) {
      return NextResponse.json({ error: "Either jobUrl or jobDescription is required" }, { status: 400 });
    }

    let jobRaw: string;
    if (jobDescription && jobDescription.trim().length > 50) {
      console.log("Using pasted job description...");
      jobRaw = jobDescription.trim();
    } else {
      console.log("Extracting job text from URL...");
      jobRaw = await extractTextFromUrl(jobUrl);
    }
    
    console.log("Extracting resume text...");
    const resumeRaw = await resumeTextFromInput(resumeUrl, file);

    const jobText = clip(jobRaw);
    const resumeText = clip(resumeRaw);

    console.log("Job text length:", jobText.length);
    console.log("Resume text length:", resumeText.length);

    if (!jobText || jobText.length < 100) {
      return NextResponse.json({
        fitLevel: "Analysis Error",
        recommendation: "Could not extract sufficient job description content. Please try pasting the job description directly or use a different URL.",
        matchScore: 0,
        explanation: "Unable to analyze due to insufficient job description content.",
        previews: { jobText: jobText.slice(0, 5000), resumeText: resumeText.slice(0, 5000) }
      });
    }

    if (jobText.toLowerCase().includes("search jobs") && jobText.length < 500) {
      return NextResponse.json({
        fitLevel: "Analysis Error",
        recommendation: "The URL appears to be a job search page rather than a specific job posting. Please navigate to the actual job posting and copy that URL.",
        matchScore: 0,
        explanation: "The extracted content appears to be from a job search or careers page rather than a specific job description.",
        previews: { jobText: jobText.slice(0, 5000), resumeText: resumeText.slice(0, 5000) }
      });
    }

    if (!resumeText || resumeText.length < 50) {
      return NextResponse.json({
        fitLevel: "Analysis Error", 
        recommendation: "Could not extract resume content. Please try uploading a different PDF or use a resume URL.",
        matchScore: 0,
        explanation: "Unable to analyze due to insufficient resume content.",
        previews: { jobText: jobText.slice(0, 5000), resumeText: resumeText.slice(0, 5000) }
      });
    }

    console.log("Calling OpenAI API...");
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000
    });
    
const completion = await openai.chat.completions.create({
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  max_tokens: 2500, // Increased further
  temperature: 0.1, // Lower for more consistent following of instructions
  messages: [
    {
      role: "system",
      content: `You are an expert job fit analyzer. You MUST provide comprehensive analysis following the EXACT structure below.

YOUR EXPLANATION FIELD MUST INCLUDE ALL 5 SECTIONS WITH DETAILED BREAKDOWNS:

**1. Technical Skills Match (X/40 points):**
- Job Requirements: [Quote exact skills/technologies from job posting]
- Resume Skills: [Quote exact skills/technologies from resume]
- Skill Matches: [List specific overlapping skills]
- Missing Skills: [List specific missing skills]
- Assessment: [Detailed evaluation]

**2. Experience Relevance (X/30 points):**
- Required Experience: [Quote experience requirements from job]
- Candidate Experience: [List specific job titles, companies, durations from resume]
- Project Alignment: [Mention specific projects/achievements]
- Experience Assessment: [Detailed evaluation]

**3. Industry/Domain Knowledge (X/15 points):**
- Required Domain: [Quote industry/domain requirements]
- Candidate Background: [Assess relevant industry experience]
- Knowledge Assessment: [Detailed evaluation]

**4. Educational Background (X/10 points):**
- Required Education: [Quote education requirements from job]
- Candidate Education: [University name, degree, GPA, relevant coursework from resume]
- Educational Assessment: [Detailed evaluation highlighting strengths]

**5. Soft Skills/Culture Fit (X/5 points):**
- Evidence Found: [Quote specific examples from resume]
- Assessment: [Detailed evaluation]

**Total Score: X/100** (must equal sum of all categories)

If you do not include ALL 5 sections with detailed breakdowns, your response is incomplete.

Respond with valid JSON:
{
  "fitLevel": "string",
  "recommendation": "string", 
  "matchScore": number,
  "explanation": "string",
  "improvements": "string"
}`
    },
    {
      role: "user",
      content: `MANDATORY: Your explanation must include ALL 5 detailed sections as specified in the system prompt. Do not provide a summary - provide the complete breakdown.

=== JOB POSTING ===
${jobText.slice(0, 8000)}

=== RESUME ===
${resumeText.slice(0, 8000)}

REQUIRED OUTPUT:
1. Complete Technical Skills Match section with quotes and assessment
2. Complete Experience Relevance section with specific roles and companies
3. Complete Industry/Domain Knowledge section
4. Complete Educational Background section with university, degree, GPA, coursework
5. Complete Soft Skills/Culture Fit section with evidence
6. Total score calculation showing all category breakdowns
7. Specific improvement recommendations

Your explanation field MUST be comprehensive and follow the exact 5-section format specified.`
    }
  ]
});

    const responseText = completion.choices[0]?.message?.content?.trim() || "";
    console.log("OpenAI response:", responseText);

    if (!responseText) {
      throw new Error("Empty response from OpenAI");
    }

    let fitResult;
    try {
      // More thorough cleaning of the response
      let cleanResponse = responseText;
      
      // Remove any markdown code blocks
      cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Remove any leading/trailing whitespace
      cleanResponse = cleanResponse.trim();
      
      // Try to find JSON within the response if it's wrapped in other text
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[0];
      }
      
      console.log("Cleaned response for parsing:", cleanResponse.substring(0, 500));
      
      fitResult = JSON.parse(cleanResponse);
      
      // Validate required fields
      if (!fitResult.fitLevel || !fitResult.recommendation || typeof fitResult.matchScore !== 'number') {
        console.error("Missing required fields:", {
          hasFitLevel: !!fitResult.fitLevel,
          hasRecommendation: !!fitResult.recommendation,
          hasValidScore: typeof fitResult.matchScore === 'number',
          fitResult: fitResult
        });
        throw new Error("Invalid response structure from OpenAI");
      }
      
      // Ensure improvements field exists
      if (!fitResult.improvements) {
        fitResult.improvements = "No specific improvements provided in this analysis.";
      }
      
      // Ensure explanation is a string, not an object
      if (typeof fitResult.explanation !== 'string') {
        if (fitResult.explanation && typeof fitResult.explanation === 'object') {
          // Convert object to formatted string with better formatting
          fitResult.explanation = JSON.stringify(fitResult.explanation, null, 2)
            .replace(/[{}"\[\]]/g, '')
            .replace(/,\n/g, '\n')
            .replace(/:/g, ': ')
            .replace(/\n\s+/g, '\n')
            .replace(/^\s+|\s+$/gm, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        } else {
          fitResult.explanation = "Analysis completed but explanation formatting issue occurred.";
        }
      }
      
      // Ensure improvements is a string, not an object
      if (typeof fitResult.improvements !== 'string') {
        if (fitResult.improvements && typeof fitResult.improvements === 'object') {
          fitResult.improvements = JSON.stringify(fitResult.improvements, null, 2)
            .replace(/[{}"\[\]]/g, '')
            .replace(/,\n/g, '\n')
            .replace(/:/g, ': ')
            .replace(/\n\s+/g, '\n')
            .replace(/^\s+|\s+$/gm, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        } else {
          fitResult.improvements = "Improvement suggestions could not be formatted properly.";
        }
      }
      
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Full response text:", responseText);
      console.error("Response length:", responseText.length);
      
      // Try to extract any partial information
      let partialFitLevel = "Analysis Error";
      let partialScore = 0;
      
      // Look for score in the text
      const scoreMatch = responseText.match(/(\d+)\/100/);
      if (scoreMatch) {
        partialScore = parseInt(scoreMatch[1]);
      }
      
      // Look for fit level
      const fitLevelMatch = responseText.match(/(Strong|Good|Moderate|Weak|Poor)\s+[Ff]it/i);
      if (fitLevelMatch) {
        partialFitLevel = fitLevelMatch[1] + " Fit";
      }
      
      fitResult = {
        fitLevel: partialFitLevel,
        recommendation: "Analysis completed but there was an issue with response formatting. Please try again for full details.",
        matchScore: partialScore,
        explanation: responseText.length > 100 ? responseText.substring(0, 2000) + "..." : "Error processing the AI analysis response.",
        improvements: "Unable to generate improvement suggestions due to response formatting issues."
      };
    }

    fitResult.previews = {
      jobText: jobText.slice(0, 10000),
      resumeText: resumeText.slice(0, 10000)
    };

    console.log("Returning result:", fitResult);
    return NextResponse.json(fitResult);

  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { 
        error: error?.message || "Internal server error",
        details: error?.code || "Unknown error"
      }, 
      { status: 500 }
    );
  }
}



