import * as https from "https";

function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
  return key && key.trim().length > 0 ? key : null;
}

function buildPrompt(text: string, contextSnippets: string[] = []): string {
  const trimmed = text.length > 2000 ? text.slice(0, 2000) : text;
  const context = contextSnippets
    .filter(Boolean)
    .slice(0, 5)
    .map((c) => (c.length > 400 ? c.slice(0, 400) + "…" : c))
    .join("\n---\n");
  const contextBlock = context ? `Context (recent related clips):\n${context}\n\n` : "";
  return `You are an expert at tagging text snippets. ${context ? "Use the context to keep tag vocabulary consistent." : ""} Given the following text, return the most relevant 5 short tags (1-3 words each), ordered from most to least relevant. Use consistent, reusable wording. Return ONLY a comma-separated list of tags, no numbering or explanations.\n\n${contextBlock}Text:\n"""\n${trimmed}\n"""`;
}

export async function generateTagsForText(text: string, contextSnippets: string[] = []): Promise<string[] | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const body = JSON.stringify({
    contents: [
      {
        parts: [ { text: buildPrompt(text, contextSnippets) } ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 64
    }
  });

  const path = `/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const options: https.RequestOptions = {
    method: "POST",
    hostname: "generativelanguage.googleapis.com",
    path,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body)
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const textParts: string[] = parsed?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "") || [];
          const raw = textParts.join("\n");
          if (!raw) return resolve(null);
          const tags = raw
            .split(/[,\n]/)
            .map((s: string) => s
              .trim()
              .replace(/^(?:\d+\.|\d+\)|[\s•−-]+)/, "")
              .trim()
            )
            .filter((s: string) => s.length > 0);
          const unique: string[] = [];
          const seen = new Set<string>();
          for (const t of tags) {
            const key = t.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              unique.push(t);
            }
            if (unique.length >= 5) break;
          }
          resolve(unique.length ? unique : null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}


