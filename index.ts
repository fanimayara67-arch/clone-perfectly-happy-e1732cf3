import { generateText } from "ai";

const { text } = await generateText({
  model: "openai/gpt-5.5",
  prompt: "Invent a brand new holiday and describe its traditions.",
});

console.log(text);
