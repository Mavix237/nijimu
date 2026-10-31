import { assignMemoryShape, type MemoryAssessment } from "../lib/memoryShape";

/** Built-in demo: assessed once with GPT-4.1 mini. Evidence quotes checked
 * against the original text (including original capitalization). No live API
 * dependency for the sample; edited or recorded accounts are assessed normally. */
export const SAMPLE_TRANSCRIPT = "I keep coming back to that summer. Not to him, exactly — but to who I was when I was around him. Someone who still had time to notice things. The light on a wall. The sound of a city at 2am. He gave me a camera and said, just feel for the click. I think what he actually meant was — slow down. Pay attention. I didn't. And then he was gone. And I kept moving. But sometimes I wonder if that version of me is still somewhere, waiting on that island, wondering why I never came back.";
export const SAMPLE_MODEL = "gpt-4.1-mini";
export const SAMPLE_ASSESSMENT: MemoryAssessment = {
  "orientation": -0.7,
  "comfort": 0.4,
  "intensity": 0.7,
  "discomfort": 0.5,
  "disruption": 0.6,
  "mixedness": 0.8,
  "insufficientEvidence": false,
  "summary": "The speaker reflects inwardly on a past self shaped by a meaningful relationship, evoking nostalgia, loss, and a sense of missed opportunity. There's a mix of warmth and sadness, with a poignant longing for a lost version of themselves.",
  "beats": [
    {
      "quote": "I keep coming back to that summer. Not to him, exactly — but to who I was when I was around him.",
      "reading": "The speaker revisits a past time focused on their own identity and experience rather than the other person, indicating introspection and self-awareness.",
      "orientation": -0.8,
      "intensity": 0.6
    },
    {
      "quote": "He gave me a camera and said, just feel for the click. I think what he actually meant was — slow down. Pay attention.",
      "reading": "A moment of guidance and invitation to mindfulness, highlighting a gentle encouragement to be present and notice details.",
      "orientation": -0.6,
      "intensity": 0.5
    },
    {
      "quote": "I didn't. And then he was gone. And I kept moving.",
      "reading": "Acknowledgment of missed opportunity and loss, with a sense of regret and the inevitability of change and departure.",
      "orientation": -0.7,
      "intensity": 0.8
    },
    {
      "quote": "But sometimes I wonder if that version of me is still somewhere, waiting on that island, wondering why I never came back.",
      "reading": "A poignant longing for a past self left behind, expressing a deep internal conflict and unresolved feelings about personal growth and change.",
      "orientation": -0.9,
      "intensity": 0.7
    }
  ]
};
export function sampleAssignment(transcript: string) {
  return transcript.trim() === SAMPLE_TRANSCRIPT
    ? assignMemoryShape(SAMPLE_ASSESSMENT, "built-in-summer-memory-v1", "api", SAMPLE_MODEL, transcript)
    : null;
}
