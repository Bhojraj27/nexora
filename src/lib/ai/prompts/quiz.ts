import "server-only";

export interface QuizConfig {
  count: number;
  difficulty: "easy" | "medium" | "hard";
  type: "multiple_choice" | "true_false" | "mixed";
}

export const QUIZ_PROMPT = (config: QuizConfig) => `
Generate a quiz from the provided document content.

Requirements:
- Exactly ${config.count} questions
- Difficulty: ${config.difficulty}
- Type: ${config.type === "mixed" ? "a mix of multiple-choice and true/false" : config.type === "multiple_choice" ? "multiple choice only" : "true/false only"}
- Every question must be answerable from the source text
- Return STRICT JSON with no markdown fences, matching this schema:

{
  "questions": [
    {
      "id": 1,
      "question": "...",
      "type": "multiple_choice" | "true_false",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctIndex": 0,
      "explanation": "..."
    }
  ]
}
`.trim();
