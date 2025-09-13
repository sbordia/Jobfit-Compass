import './globals.css';
export const metadata = {
  title: "Resume Critiq",
  description: "ATS-style resume critique against a job posting",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-br from-gray-50 to-white text-gray-900 min-h-screen flex flex-col">
        <header className="bg-white shadow-md border-b border-gray-100 sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <span className="text-2xl font-bold text-indigo-700 tracking-tight">Jobfit Compass</span>
            <span className="text-xs text-gray-400 font-mono">Powered by AI</span>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          {children}
        </main>
        <footer className="bg-white border-t border-gray-100 py-4 text-center text-xs text-gray-400">
          © 2025 Jobfit Compass. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
