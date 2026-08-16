import "server-only";

export const SUMMARIZE_PROMPT = `
Summarize the provided document in a clear, structured Markdown summary.

Include:
- A one-paragraph executive overview
- 5 key points as a bulleted list
- Any notable numbers or statistics
- A short "Risks / Open questions" section if the text supports it

Only use information present in the document.
`.trim();

export const KEY_POINTS_PROMPT = `
Extract the most important key points from the provided text.
Return them as a concise Markdown bulleted list.
Do not add interpretation beyond the source.
`.trim();

export const ACTION_ITEMS_PROMPT = `
Extract actionable next steps from the provided text.
Return a Markdown checklist, each item prefixed with "- [ ]".
Only derive items that are actually supported by the source text.
`.trim();

export const CONTRADICTIONS_PROMPT = `
Analyze the provided texts for contradictions or inconsistencies between them.
List any contradictions found in Markdown.
If none are found, say so clearly.
`.trim();
