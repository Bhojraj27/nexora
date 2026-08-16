import "server-only";

export const COMPARE_PROMPT = `
Compare the two provided documents (labeled Document A and Document B).

Produce a Markdown comparison report with these sections:
- **Executive Summary**
- **Key Changes** (a table where relevant)
- **Revenue / Metrics** table if the documents contain numbers
- **Major Changes**
- **Risks**
- **Recommendations**

Mark each row in tables with which source it came from.
Clearly separate source-derived facts from interpretation.
`.trim();
