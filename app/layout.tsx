export const metadata = {
  title: "Resume Critiq",
  description: "ATS-style resume critique against a job posting",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
