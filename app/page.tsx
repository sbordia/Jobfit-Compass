"use client";
import React, { useState } from "react";

type FitAnalysis = {
  fitLevel: string;
  recommendation: string;
  matchScore: number;
  explanation: string;
  improvements?: string;
  error?: string;
  previews: {
    jobText: string;
    resumeText: string;
  };
};

export default function Home() {
  const [jobUrl, setJobUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FitAnalysis | null>(null);
  const [useTextarea, setUseTextarea] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    // Guard: require either resume URL or PDF upload
    if (!resumeUrl && !file) {
      setError("Please upload a PDF or provide a resume URL.");
      setLoading(false);
      return;
    }

    const form = new FormData();
    if (useTextarea) {
      form.append("jobDescription", jobDescription);
    } else {
      form.append("jobUrl", jobUrl);
    }

    form.append("resumeUrl", resumeUrl);
    if (file) {
      form.append("resumeFile", file);
    }

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
        cache: "no-store",
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const j = await res.json().catch(() => ({}));
          throw new Error(
            (j && (j.error || j.message)) ||
              JSON.stringify(j) ||
              `Request failed: ${res.status}`
          );
        } else {
          const t = await res.text();
          throw new Error(
            t.startsWith("<!DOCTYPE")
              ? `Server error ${res.status}`
              : t || `Request failed: ${res.status}`
          );
        }
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error("Submit error", err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Job Fit Assessor</h1>
        <p className="text-gray-600 mt-1">
          Paste a job link and your resume (URL or PDF). Instantly see if this job is a good fit for you&mdash;and whether you should apply or save your time.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card p-5 space-y-4">
        {/* Job Input Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Job Information</h2>

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => setUseTextarea(false)}
              className={`px-4 py-2 rounded ${!useTextarea ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Use URL
            </button>
            <button
              type="button"
              onClick={() => setUseTextarea(true)}
              className={`px-4 py-2 rounded ${useTextarea ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Paste Job Description
            </button>
          </div>

          {useTextarea ? (
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here..."
              className="w-full p-3 border rounded-lg h-40"
              required
            />
          ) : (
            <input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="Enter job posting URL"
              className="w-full p-3 border rounded-lg"
              required
            />
          )}
        </div>

        {/* Resume Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Resume</h2>

          <input
            type="url"
            value={resumeUrl}
            onChange={(e) => setResumeUrl(e.target.value)}
            placeholder="Resume URL (optional)"
            className="w-full p-3 border rounded-lg"
          />

          <div className="text-center">OR</div>

          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full p-3 border rounded-lg"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white p-3 rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Analyzing...' : 'Analyze Job Fit'}
        </button>
        {error && <p className="text-red-600">{error}</p>}
      </form>

      {/* Results */}
      {result && (
        <div className="mt-8 space-y-6">
          {result.error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              Error: {result.error}
            </div>
          ) : (
            <>
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-2">Fit Assessment</h2>
                <p className="text-lg font-medium text-blue-600">{result.fitLevel}</p>
                <p className="mt-2">{result.recommendation}</p>
                {result.matchScore !== undefined && (
                  <p className="mt-2 text-sm text-gray-600">Match Score: {result.matchScore}/100</p>
                )}
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">AI Analysis</h2>
                <div className="space-y-4">
                  <div 
                    className="text-sm leading-relaxed space-y-3"
                    dangerouslySetInnerHTML={{
                      __html: (result.explanation || "")
                        .toString()
                        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
                        .replace(/(\d+\.\s\*\*[^*]+\*\*:)/g, '<br/><strong class="text-blue-600">$1</strong>')
                        .replace(/(Job Requirements|Resume Skills|Skill Matches|Missing Skills|Required Experience|Candidate Experience|Project Alignment|Evidence Found):/g, '<br/><strong class="font-medium text-gray-800">$1:</strong>')
                        .replace(/- ([^\n]+)/g, '<br/>• $1')
                        .replace(/\n/g, '<br/>')
                        .replace(/<br\/><br\/>/g, '<br/>')
                    }}
                  />
                  
                  {result.matchScore && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Match Score Breakdown:</span>
                        <span className="text-lg font-bold text-blue-600">{result.matchScore}/100</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {result.improvements && (
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-xl font-semibold mb-2 text-green-700">📈 Specific Improvements</h2>
                  <div 
                    className="text-sm leading-relaxed space-y-2"
                    dangerouslySetInnerHTML={{
                      __html: (result.improvements || "")
                        .toString()
                        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
                        .replace(/- /g, '<br/>• ')
                        .replace(/\n/g, '<br/>')
                        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-blue-600 underline hover:text-blue-800">$1</a>')
                    }}
                  />
                </div>
              )}

              {result.previews && (
                <details className="bg-gray-50 p-4 rounded-lg">
                  <summary className="cursor-pointer font-medium">View Extracted Content</summary>
                  <div className="mt-4 space-y-4">
                    <div>
                      <h3 className="font-medium">Job Description (extracted)</h3>
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{result.previews.jobText}</p>
                    </div>
                    <div>
                      <h3 className="font-medium">Resume (extracted)</h3>
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{result.previews.resumeText}</p>
                    </div>
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}
