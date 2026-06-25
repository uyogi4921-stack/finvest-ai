/** Shared types for the Finvest tutor. */

export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

/** Learner state used to personalise TEACHING (never recommendations). */
export interface LearnerState {
  name?: string;
  level: "beginner" | "intermediate" | "advanced";
  goals?: string[];
  riskTolerance?: "low" | "moderate" | "high";
  currentLessonId?: string;
  lessonsCompleted?: number;
  recentQuizScorePct?: number;
}

/** A retrieved curated lesson chunk (Step 3 fills these for real). */
export interface RetrievedChunk {
  lessonId: string;
  module: string;
  topic: string;
  level: string;
  text: string;
  score: number;
}

export interface TutorContext {
  retrieved: RetrievedChunk[];
  learner: LearnerState;
}

/** Result of running one tutor turn through the pipeline. */
export interface TurnResult {
  text: string;
  guardrail: {
    userAskedForAdvice: boolean;
    intercepted: boolean;
    reasons: string[];
  };
  grounding: {
    /** model stated a live number it couldn't source → rerouted */
    intercepted: boolean;
    reasons: string[];
    marketFactsUsed: boolean;
  };
  toolsUsed: string[];
  retrievalUsed: boolean;
}
