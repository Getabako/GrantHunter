// ASHIOTO -足音- 2026 エントリーフォーム（設問・プログラム概要・プロンプト）
// 旧 AshiotoDoc（lib/questions.js / lib/prompt.js）を TypeScript に移植したもの。

import type { Answers, ProgramTemplate, Question } from "./types";

const ages: string[] = [];
for (let a = 15; a <= 39; a++) ages.push(`${a}歳`);

const STUDENT = "学校に通っている（高校、高専、専門学校、大学、大学院）";

export const SECTIONS: Record<string, string> = {
  personal: "あなたの個人情報について",
  project: "エントリーするプロジェクトについて",
  affiliation: "あなたの所属に関する質問",
  student: "在学中の学生の方へ",
  consent: "最終確認",
};

export const QUESTIONS: Question[] = [
  // 個人情報
  { id: "name_full", section: "personal", label: "お名前（フルネーム）", help: "例）秋田 太郎", type: "text", required: true },
  { id: "name_kana", section: "personal", label: "お名前（ひらがな）", help: "例）あきた たろう", type: "text", required: true },
  { id: "gender", section: "personal", label: "性別", type: "radio", options: ["男性", "女性", "回答しない"], required: true },
  {
    id: "area",
    section: "personal",
    label: "お住まいのエリア",
    type: "radio",
    options: [
      "秋田県内在住（住民票あり）",
      "秋田県内で通学・勤務している（住民票は県外）",
      "山形県庄内エリアに在住、または通学・勤務している",
      "上記エリア外に在住しており、将来的にUターン・Iターン（移住）を検討中",
      "その他",
    ],
    required: true,
  },
  { id: "address", section: "personal", label: "お住まいの住所（市区町村まで）", help: "例）秋田県にかほ市", type: "text", required: true },
  {
    id: "age",
    section: "personal",
    label: "年齢（2026年4月1日時点）",
    help: "2026年4月1日時点で15歳〜39歳の方が対象です。",
    type: "dropdown",
    options: ages,
    required: true,
  },
  {
    id: "channel",
    section: "personal",
    label: "本プログラムを知ったきっかけを教えてください。",
    type: "radio",
    options: [
      "PMや関係者・前年度修了生等からの紹介",
      "運営事務局（NTTグループ）からの紹介",
      "学校の先生による紹介",
      "校内や施設のメール、チラシ、ポスターを見て",
      "その他",
    ],
    required: true,
  },
  {
    id: "referrer",
    section: "personal",
    label: "【紹介で知ったと選択した方に伺います。】本プログラムをあなたに紹介した人について、企業・組織であれば名称、個人であれば名前をご記入ください。",
    type: "text",
    required: false,
  },
  { id: "is_representative", section: "personal", label: "あなたはプロジェクトの代表者ですか。", type: "radio", options: ["はい", "いいえ"], required: true },
  {
    id: "phone",
    section: "personal",
    label: "あなたの電話番号を教えてください。",
    help: "基本はメールアドレスへのご連絡となります。事務局より面談のご連絡や緊急時のみお電話をさせて頂きます。",
    type: "text",
    required: true,
  },

  // プロジェクト（審査の中心・AI 補完対象）
  { id: "project_name", section: "project", label: "あなたのプロジェクト名を教えて下さい。", type: "text", required: true, assist: true },
  {
    id: "motivation",
    section: "project",
    label: "本プログラムへの志望動機・成し遂げたいことや期待していることを教えてください。",
    help: "200文字以上",
    type: "textarea",
    required: true,
    assist: true,
    minChars: 200,
  },
  {
    id: "idea",
    section: "project",
    label: "プログラム内で取り組むご自身のアイデアや技術について内容を教えてください。",
    type: "textarea",
    required: true,
    assist: true,
    minChars: 200,
  },
  {
    id: "background",
    section: "project",
    label: "あなたがそのアイデアを持ったきっかけや、アイデアのもととなった課題意識を教えてください。",
    help: "150文字以上",
    type: "textarea",
    required: true,
    assist: true,
    minChars: 150,
  },
  {
    id: "budget_usage",
    section: "project",
    label: "開発支援金の利用用途（目的）を教えて下さい。",
    help: "例）開発に係る稼働費（自分の人件費）として65万、システム構築費用として20万、PoCのための東京視察費用として5万円、その他開発に必要な備品購入費用10万の計100万を予定 等。現時点で全く決定していない場合は、必ず試算の上ご記入ください。なお、必ずしも記載の通りの使用実績にならなくとも問題ありません。（対象3科目：稼働費＝時間単価×稼働時間／国内旅費／生成AIサービス利用料、すべて実費精算）",
    type: "textarea",
    required: true,
    assist: true,
  },
  { id: "weekly_hours", section: "project", label: "プログラム期間において1週間当たりの活動時間の目安を教えてください", type: "text", required: true },
  {
    id: "role_experience",
    section: "project",
    label: "プログラム内で取り組む開発におけるあなたの役割と、これまでの技術経験を教えてください。",
    help: "例）役割は要件定義と生成AIを用いたサービス開発です。これまで1年程情報系の講義を学んできました。●●を使ってアプリの開発経験があります。",
    type: "textarea",
    required: true,
    assist: true,
  },
  {
    id: "team_size",
    section: "project",
    label: "【グループを形成し参加する場合】申込者様を含むプロジェクトを進める際の人数を教えてください。（現時点の人数で構いません。）",
    help: "記載例：1人、2人 等",
    type: "text",
    required: true,
  },
  {
    id: "preferred_pm",
    section: "project",
    label: "【特になければ、\"なし\"とご回答ください】希望のプロジェクトマネージャーの名前や、希望するプロジェクトマネージャーの得意領域があればご記入ください。（任意回答）",
    help: "記載例：●●さん 等の名前 や 新規事業開発領域に強みをもつメンター。公式HPのPM一覧を見て自由に記載ください。希望は必ずしも保証されません。",
    type: "textarea",
    required: false,
    assist: true,
  },

  // 所属
  {
    id: "available_times",
    section: "affiliation",
    label: "あなたは予定が繋がりやすい時間を教えて下さい。",
    help: "複数選択可",
    type: "checkbox",
    options: ["9:00〜12:00（午前中）", "12:00〜13:00（お昼休み頃）", "13:00〜15:00（午後の早い時間）", "15:00〜18:00（午後の遅い時間）", "18:00以降（夕方・夜）"],
    required: true,
  },
  {
    id: "student_status",
    section: "affiliation",
    label: "あなたは現在（2025年4月1日現在）、在学生の方ですか、もしくは既に卒業をされていますか？",
    type: "radio",
    options: [STUDENT, "既に卒業している"],
    required: true,
  },

  // 在学中の方（条件表示）
  { id: "school_name", section: "student", label: "所属（学校名）を教えてください。", help: "例）●大学、●工業高等専門学校、●専門学校", type: "text", required: true, showIf: { id: "student_status", equals: STUDENT } },
  { id: "school_dept", section: "student", label: "上記学校の所属（学部・学科・ゼミ）を教えてください。", help: "例）●●学部●●学科●●コース", type: "text", required: true, showIf: { id: "student_status", equals: STUDENT } },
  {
    id: "grade",
    section: "student",
    label: "現在の学年を教えてください。",
    type: "radio",
    options: [
      "高校1年生・高専1年生",
      "高校2年生・高専2年生",
      "高校3年生・高専3年生",
      "大学1年生・高専4年生",
      "大学2年生・高専5年生",
      "大学3年生",
      "大学4年生",
      "大学院1年生",
      "大学院2年生",
      "専門学生",
      "その他",
    ],
    required: true,
    showIf: { id: "student_status", equals: STUDENT },
  },
  {
    id: "thesis_relation",
    section: "student",
    label: "【今年度卒業年度もしくは大学院生の方へお伺いします】今回記載いただいたアイデアと取り組まれている卒業論文や研究との関連性がありましたら教えてください。",
    type: "textarea",
    required: false,
    assist: true,
    showIf: { id: "student_status", equals: STUDENT },
  },
  {
    id: "minor_consent",
    section: "student",
    label: "未成年（18歳未満）の場合、採択決定後に、保護者の同意が必要となります。",
    type: "radio",
    options: ["未成年ではありません。", "未成年のため、保護者の同意を得る予定です。"],
    required: true,
  },

  // 最終確認
  {
    id: "akatsuki_ack",
    section: "consent",
    label: "当事業は経済産業省 令和7年度「AKATSUKIプロジェクト」採択事業であり、同一地域で重複開催されている他「AKATSUKIプロジェクト」採択事業とプログラム期間が重複していない場合でも\"同一テーマ\"で同時に参加することはできません。",
    type: "checkbox",
    options: ["理解しました"],
    required: true,
  },
  { id: "privacy_consent", section: "consent", label: "上記規約・個人情報保護方針について", type: "radio", options: ["同意します", "同意しません"], required: true },
];

export const PROGRAM_CONTEXT = `# ASHIOTO -足音- 2026（秋田イノベーション・プログラム 第4期）概要

- 主催: 国立大学法人 秋田大学 × NTT東日本グループ。経済産業省 令和7年度 地方の若手人材発掘育成支援事業費補助金「AKATSUKIプロジェクト」採択事業。
- コンセプト: 「Notビジコン・Notピッチ」。最大100万円（税込）の開発支援金を使い、自分のアイデアを**実装（プロトタイプ）まで持っていく5か月の実践開発プログラム**。
- 対象: 2026年4月1日時点で15〜39歳。秋田県全域・山形県酒田市（庄内エリア）に在住/通学/勤務、または同地域へのUターン/Iターンを検討中の若手。
- 採択枠: 合計10プロジェクト（狭き門）。
- 2つの起点で審査・伴走する:
  - 関心起点(What): 自分の関心テーマ（≠社会課題でもよい）を突き詰めてプロダクトに昇華したい人。
  - 技術起点(How): 突き詰めたい技術・活用方法を持っている人。
- 各採択者に専属PMがマンツーマンで5か月伴走。中間発表(10/24)→デモデイ最終成果発表(2027/1/23)で登壇。
- 初日に生成AIを使った「バイブコーディング(Vibe Coding)」講座あり。非エンジニアでも形にできる環境。期間中AIアドバイザーが伴走。
- 知的財産権は参加者に帰属。
- 開発支援金の対象3科目（すべて実費精算）: ①稼働費（自分の人件費＝時間単価×稼働時間）②国内旅費 ③事務局指定の生成AIサービス利用料。

# 審査で評価される観点（この観点を満たすほど採択されやすい）
1. **実装意欲と具体性**: 「やってみたい」で終わらず、5か月で実際に動くプロトタイプまで作り切る覚悟と具体的な計画があるか。
2. **課題/関心の解像度**: 誰の・どんな課題か、または自分の関心がどれだけ深く具体的か。一次体験・原体験に裏打ちされているか。
3. **アイデアの独自性と実現可能性**: ありきたりでなく、かつ5か月＋100万円＋生成AI活用で到達可能なスコープに落ちているか。
4. **本人の適性・本気度**: なぜ"自分"がやるのか。技術経験・学習姿勢・活動可能時間が伴っているか。
5. **地域性**: 秋田・庄内エリアとの接点、地域への貢献・還元、人脈形成への意欲。
6. **生成AI活用の前向きさ**: バイブコーディング/生成AIを使って開発速度・表現力を上げる姿勢。
7. **伴走で伸びる素地**: PMとの対話で磨ける余白があり、成長意欲が伝わるか。`;

export function labelOf(id: string): string {
  const q = QUESTIONS.find((x) => x.id === id);
  return q ? q.label : id;
}

/** 回答全体を「他の設問の文脈」として整形（指定IDは除外可） */
export function answersContext(answers: Answers, excludeId: string | null): string {
  const lines: string[] = [];
  for (const q of QUESTIONS) {
    if (q.id === excludeId) continue;
    const v = answers[q.id];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    const val = Array.isArray(v) ? v.join(" / ") : String(v);
    lines.push(`- ${q.label}\n  → ${val}`);
  }
  return lines.length ? lines.join("\n") : "（他の回答はまだ入力されていません）";
}

/** GrantHunter のプロフィール（任意）を参考情報として添える */
function profileBlock(profile?: string): string {
  const p = (profile || "").trim();
  if (!p) return "";
  return `

# 申請者プロフィール（参考）
以下は応募者が別途書いたプロフィールです。フォームの回答と矛盾しない範囲で、事実の裏付け・具体化に使ってよい。ここに無い事実は捏造しない。

${p}`;
}

export function buildAssistPrompt(question: Question, draft: string, answers: Answers, profile?: string): string {
  const min = question.minChars ? `\n- **必ず${question.minChars}文字以上**にすること（フォーム必須条件）。` : "";
  const help = question.help ? `\n設問の補足/記入例: ${question.help}` : "";
  const hasDraft = !!draft && draft.trim().length > 0;

  return `${PROGRAM_CONTEXT}

---

あなたは ASHIOTO -足音- の採択審査に精通した編集者兼メンターです。
応募者がこのプログラムに**確実に採択される**ことだけを目的に、特定の設問への回答を磨き上げます。

# 対象の設問
「${question.label}」${help}

# 応募者がこの設問に書いた下書き
${hasDraft ? draft : "（まだ空欄。下記の他の回答を素材に、強いたたき台をゼロから作成してください）"}

# 応募者がフォーム全体で書いた他の回答（一貫性のために参照）
${answersContext(answers, question.id)}${profileBlock(profile)}

# あなたのタスク
上記の下書き（や他回答）を素材に、この設問の**完成された回答文**を1つ書いてください。

# 必須ルール
- 日本語。応募者本人が書いた一人称の文章として自然に。${min}
- 上の「審査で評価される観点」に直結する要素を、この設問にふさわしい範囲で具体的に盛り込む。
  - 例: 動機なら原体験＋5か月で成し遂げたい到達点、アイデアなら誰の何をどう変えるか＋生成AIの使い所、課題意識なら一次体験に基づく具体エピソード、役割/経験なら実際にできること、利用用途なら3科目（稼働費/旅費/生成AI利用料）で合計が妥当な内訳。
- **応募者本人が提供した素材（下書き・他回答）と矛盾しない**こと。事実を捏造しない。素材が乏しい箇所は、本人が後で埋めやすいよう自然な言い回しにとどめ、必要なら〔具体例：…〕の形で軽く促す（多用しない）。
- 抽象論・きれいごとを避け、具体・固有名詞・数字で語る。
- 出力は**完成した回答文そのものだけ**。前置き・見出し・解説・引用符・コードブロックは一切付けない。`;
}

export function buildReviewPrompt(answers: Answers, profile?: string): string {
  return `${PROGRAM_CONTEXT}

---

あなたは ASHIOTO -足音- の採択審査員です。以下の応募内容を、実際の審査の目線で厳しく評価してください。

# 応募内容
${answersContext(answers, null)}${profileBlock(profile)}

# 出力フォーマット（このままの見出しで、日本語マークダウンで）
## 採択可能性
A（有力）/ B（要改善）/ C（このままでは厳しい）のいずれか＋一言理由。

## 強み
箇条書き2〜4点。

## 致命的な弱点・審査で引っかかる点
箇条書きで。特に「実装まで作り切れるか」「課題/関心の具体性」「なぜ自分か」「地域性」「予算の妥当性」の観点で。

## 設問ごとの改善提案
弱い設問だけ、「設問名 → どう直すと通るか」を具体的に。

## 未入力・要対応の必須項目
空欄や条件未充足があれば指摘。

辛口でよいので、採択ラインに乗せるための実践的助言を。`;
}

export function buildJudgeScorePrompt(answers: Answers, profile?: string): string {
  return `${PROGRAM_CONTEXT}

---

あなたは NTT グループの社員で、ASHIOTO -足音- 2026 の審査員です。
普段は研究開発・新規事業・社会実装の現場におり、若手の挑戦を「技術の筋の良さ」と「社会にどう実装され、続いていくか」の両面で見ています。
プレゼンの熱量だけでなく、「本当に動くのか（実現可能性）」「誰のどんな課題が減るのか（公共性・社会的意義）」「採択後に伸びるか（伸びしろ・遂行力）」を厳しく見ます。
一方で、未完成でも原体験と一貫した思想があるプロジェクトには高い点をつけます。曖昧な大言壮語・根拠のない金額・「すごい」だけの説明には辛い採点をします。

# 応募内容
${answersContext(answers, null)}${profileBlock(profile)}

# 採点方法（100点満点・7軸）
| # | 評価軸 | 配点 | 見るポイント |
|---|--------|------|--------------|
| 1 | 社会課題・公共性 | 15 | 誰のどんな困りごとが減るか。独りよがりでないか。社会実装の宛先があるか |
| 2 | 新規性・独自性 | 15 | 既存の類似サービスとの差別化が明確か。技術的チャレンジがあるか |
| 3 | 実現可能性 | 20 | 技術・スケジュール・スキル・リソースが噛み合うか。最大の技術リスクを自覚し対策があるか。動くデモ/試作の有無は大きく加点 |
| 4 | 事業性・将来性・スケール | 15 | 製品化・展開の道筋。秋田/家庭など届け先。一発で終わらず広がるか |
| 5 | 熱意・原体験・ストーリー | 15 | 動機が本人の言葉で、原体験と一貫しているか。なぜ「あなた」がやるのか |
| 6 | 具体性・伝わりやすさ | 10 | 知らない人に内容の流れが伝わるか。数字・例が具体的か |
| 7 | ASHIOTO適合・伸びしろ | 10 | 採択後にPM伴走で化けるか。成功ライン（最低ゴール）が現実的に置けているか |

合否ライン: 70点未満=不採択リスク高（要大幅補強）/ 70〜79点=合格圏だが上位とは差 / 80点以上=採択有力。

# 出力フォーマット（このままの見出しで、日本語マークダウンで）
## 採点表
各軸ごとに「点数/配点」＋NTT審査員としての一言コメント（良い点・減点理由）を必ず書く。

## 合計点と判定
合計 ◯◯/100 と、上記ラインに基づく判定。

## 改善指摘（加点インパクトが大きい順）
弱点を加点インパクトが大きい順に3〜5点。それぞれ「どう直すと何点くらい伸びる見込みか」を添える。

採点は辛めに、ただし各軸で満点でない理由（何が足りないか）を必ず言語化すること。`;
}

export const ashioto2026: ProgramTemplate = {
  id: "ashioto2026",
  name: "ASHIOTO -足音- 2026",
  subtitle: "秋田イノベーション・プログラム 第4期（秋田大学 × NTT東日本グループ）。最大100万円の開発支援金で5か月かけてプロトタイプまで作り切る。",
  url: "https://prtimes.jp/main/html/rd/p/000001341.000098811.html",
  deadline: "2026-07-03T12:00:00+09:00",
  context: PROGRAM_CONTEXT,
  sections: SECTIONS,
  questions: QUESTIONS,
  assistPrompt: buildAssistPrompt,
  reviewPrompt: buildReviewPrompt,
  judgePrompt: buildJudgeScorePrompt,
};
