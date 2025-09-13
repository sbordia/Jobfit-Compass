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
  const resultsRef = React.useRef<HTMLDivElement>(null);
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
      // Scroll to results after they appear
      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    } catch (err: any) {
      console.error("Submit error", err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="w-full max-w-6xl mx-auto my-12 flex flex-col md:flex-row gap-8">
      {/* Left Panel: Form */}
      <div className="flex-1 bg-white rounded-3xl shadow-2xl border border-gray-100 p-10 flex flex-col gap-8">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight text-center">Jobfit Compass</h1>
        <p className="text-lg text-gray-500 mb-8 text-center">Get an instant, AI-powered resume fit analysis for any job posting.</p>
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 bg-gray-50 rounded-2xl p-6 shadow-sm">
            <label className="block text-base font-semibold text-gray-700 mb-1">Job Description</label>
            <div className="flex gap-3 mb-2">
              <button type="button" className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${!useTextarea ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow' : 'bg-white text-gray-500 border-gray-200'}`} onClick={() => setUseTextarea(false)}>URL</button>
              <button type="button" className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${useTextarea ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow' : 'bg-white text-gray-500 border-gray-200'}`} onClick={() => setUseTextarea(true)}>Paste</button>
            </div>
            {useTextarea ? (
              <textarea className="input h-28 resize-none text-base" value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="Paste job description here" />
            ) : (
              <input className="input text-base" value={jobUrl} onChange={e => setJobUrl(e.target.value)} placeholder="Paste job URL" />
            )}
          </div>
          <div className="flex flex-col gap-4 bg-gray-50 rounded-2xl p-6 shadow-sm">
            <label className="block text-base font-semibold text-gray-700 mb-1">Resume</label>
            <input className="input text-base" value={resumeUrl} onChange={e => setResumeUrl(e.target.value)} placeholder="Paste resume URL (optional)" />
            <div className="text-sm text-gray-400 my-1 text-center">or upload PDF</div>
            <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="input text-base" />
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-2xl shadow-lg hover:bg-indigo-700 transition disabled:opacity-50 text-lg" disabled={loading}>
            {loading ? "Analyzing..." : "Analyze Fit"}
          </button>
          {error && <div className="text-red-600 text-base text-center mt-2 font-semibold">{error}</div>}
        </form>
      </div>
      {/* Right Panel: Results */}
  <div ref={resultsRef} className="flex-1 bg-white rounded-3xl shadow-2xl border border-gray-100 p-10 flex flex-col gap-8 min-h-[400px]">
        {result ? (
          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Results</h2>
            <div className="flex items-center gap-3 mb-4 justify-center">
              <span className={`inline-block px-4 py-2 rounded-full text-base font-bold ${result.matchScore > 70 ? 'bg-green-100 text-green-700' : result.matchScore > 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{result.fitLevel}</span>
              <span className="text-sm text-gray-400">Score</span>
              <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden mx-2 max-w-xs">
                <div className="h-full bg-indigo-600" style={{ width: `${result.matchScore}%` }} />
              </div>
              <span className="text-base font-bold text-indigo-700">{result.matchScore}/100</span>
            </div>
            <div className="mb-2 text-gray-700 font-semibold text-center">{result.recommendation}</div>
            <div className="text-gray-500 text-base mb-2 whitespace-pre-line text-center">{result.explanation}</div>
            {result.improvements && (
              <div className="mt-2 p-4 bg-green-50 border-l-4 border-green-400 rounded-2xl text-green-700 text-base font-medium">
                <span className="font-bold">Improvements:</span> {result.improvements}
              </div>
            )}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-sm text-gray-400 mb-2">Job Preview</h3>
                <pre className="bg-gray-50 p-4 rounded-2xl text-sm whitespace-pre-wrap border border-gray-100">{result.previews.jobText}</pre>
              </div>
              <div>
                <h3 className="font-medium text-sm text-gray-400 mb-2">Resume Preview</h3>
                <pre className="bg-gray-50 p-4 rounded-2xl text-sm whitespace-pre-wrap border border-gray-100">{result.previews.resumeText}</pre>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-lg font-medium">Results will appear here after analysis.</div>
        )}
      </div>
    </div>
  );
}
