// Jグランツ公開API（一覧）の1件
export type JgSummary = {
  id: string;
  name: string; // S-000xxxxx
  title: string;
  subsidy_max_limit: number | null;
  target_area_search: string | null;
  target_number_of_employees: string | null;
  acceptance_start_datetime: string | null;
  acceptance_end_datetime: string | null;
  institution_name?: string | null;
};

// Jグランツ公開API（詳細）の1件（添付はbase64）
export type JgAttachment = { name: string; data: string };
export type JgDetail = JgSummary & {
  subsidy_catch_phrase?: string | null;
  detail?: string | null; // HTML
  use_purpose?: string | null;
  industry?: string | null;
  target_area_detail?: string | null;
  subsidy_rate?: string | null;
  project_end_deadline?: string | null;
  request_reception_presence?: string | null;
  is_enable_multiple_request?: boolean | null;
  front_subsidy_detail_page_url?: string | null;
  application_guidelines?: JgAttachment[] | null; // 募集要項
  outline_of_grant?: JgAttachment[] | null; // 交付要綱
  application_form?: JgAttachment[] | null; // 申請様式（zip等）
};

// 候補（jGrants または Web 調査由来）
export type Candidate = {
  id: string; // jGrants id または "web:<hash>"
  source: "jgrants" | "web";
  title: string;
  url: string;
  area: string | null;
  maxLimit: number | null;
  deadline: string | null; // ISO
  summary?: string | null; // Web由来の要約
  institution?: string | null;
};

// Codex による適合スコア
export type Score = {
  id: string;
  score: number; // 0-100
  category: "事業" | "生活" | "両方";
  reason: string;
  hurdle: "低" | "中" | "高";
  suggestedUse: string;
  scoredAt: string;
  profileHash: string;
};

export type Proposal = Candidate & Score;

export type ProposalDay = {
  date: string;
  generatedAt: string;
  proposals: Proposal[];
  stats: { fetched: number; newScored: number; keywords: string[] };
};

export type Decision = {
  id: string;
  decision: "apply" | "skip";
  decidedAt: string;
  folder?: string;
};

export type Settings = {
  dailyEnabled: boolean;
  dailyTime: string; // "07:30"
  prefectures: string[]; // 例: ["秋田県"]
  keywords: string[]; // 空なら profile から自動生成
  keywordsProfileHash: string;
  minScore: number; // 提案に載せる最低スコア
  maxProposals: number;
  webResearch: boolean; // codex --search で自治体系も探す
  model: string;
  notifyMac: boolean;
  lastRunAt: string | null;
};

export type ApplicationStatus = {
  id: string;
  title: string;
  folder: string;
  createdAt: string;
  state: "preparing" | "drafting" | "done" | "error";
  message: string;
  log: string[];
  deadline: string | null;
  url: string;
};

export type ResearchJob = {
  running: boolean;
  startedAt: string | null;
  phase: string;
  log: string[];
  error: string | null;
  lastDate: string | null;
};
