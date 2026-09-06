// プログラム応募（ASHIOTO など、質問に答えて応募書類を作るタイプの制度）の型

export type QuestionType = "text" | "textarea" | "radio" | "checkbox" | "dropdown";

export type Question = {
  id: string;
  section: string;
  label: string;
  help?: string;
  type: QuestionType;
  options?: string[];
  required?: boolean;
  /** AI 補完・ブラッシュアップの対象か */
  assist?: boolean;
  minChars?: number;
  showIf?: { id: string; equals: string };
  placeholder?: string;
};

export type Answers = Record<string, string | string[]>;

export type ProgramTemplate = {
  id: string;
  name: string;
  subtitle: string;
  url: string;
  /** ISO 文字列。不明なら null */
  deadline: string | null;
  context: string;
  sections: Record<string, string>;
  questions: Question[];
  assistPrompt(q: Question, draft: string, answers: Answers, profile?: string): string;
  reviewPrompt(answers: Answers, profile?: string): string;
  judgePrompt(answers: Answers, profile?: string): string;
};

/** クライアントに渡す用（関数を含まない） */
export type ProgramInfo = Omit<ProgramTemplate, "assistPrompt" | "reviewPrompt" | "judgePrompt" | "context">;

export type EntryDoc = {
  id: string;
  programId: string;
  answers: Answers;
  createdAt: string;
  updatedAt: string;
};

export type EntrySummary = {
  id: string;
  programId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type EntryJob = {
  id: string;
  kind: "assist" | "review" | "judge";
  entryId: string;
  questionId?: string;
  state: "running" | "done" | "error";
  text: string;
  log: string[];
  startedAt: string;
};
