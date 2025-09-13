import * as cheerio from "cheerio";
import { htmlToText } from "html-to-text";

export async function fetchAndExtract(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
  });
  if (!res.ok) throw new Error(`Failed to fetch URL (${res.status})`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove noisy elements
  ["script","style","noscript","svg","header","footer","nav","aside"].forEach(sel => $(sel).remove());
  // Heuristic: prefer main / article / job-description containers if present
  const main = $("main, article, [role='main'], .job, .job-details, .jobdescription, .job-description, .posting, .description").first();
  const fragment = main.length ? $.html(main) : $.html($("body"));
  const text = htmlToText(fragment, { wordwrap: 120, selectors: [{selector: 'a', options: {ignoreHref: true}}] });
  return text.trim();
}
