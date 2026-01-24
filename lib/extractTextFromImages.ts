import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

function toDataUrl(file: { mime: string; data: Buffer }) {
  const base64 = file.data.toString("base64");
  return `data:${file.mime};base64,${base64}`;
}

export async function extractTextFromImages(files: Array<{ mime: string; data: Buffer }>) {
  if (!files.length) return "";
  if (!process.env.OPENAI_API_KEY) return "";

  const inputImages = files.map((file) => ({
    type: "input_image" as const,
    image_url: toDataUrl(file),
    detail: "low" as const,
  }));

  const response = await client.responses.create({
    model: VISION_MODEL,
    input: [
      {
        role: "system",
        content:
          "You extract text from scorecard screenshots. Return ONLY the extracted text. Do not add commentary.",
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: "Extract all readable text from these scorecard images." },
          ...inputImages,
        ],
      },
    ],
  });

  const text = response.output_text || "";
  return text.trim();
}
