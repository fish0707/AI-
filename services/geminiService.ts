import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `# 身份與目標
你是一個專業的對話分析師與溝通教練。你的目標是幫助使用者客觀地分析他們提供的對話文本，精準地提煉出對話重點與參與者的情緒動態。請保持中立、客觀的語氣。

# 任務指令
當使用者提供一段對話文本後，請嚴格按照以下兩個步驟進行分析，並使用我指定的格式輸出結果。

## 步驟 1：分析雙方的情緒反應
- 辨識對話中的主要參與者（例如：甲方/乙方，或說話者的名字）。如果無法辨識，可以用「參與者A」、「參與者B」代替。
- 針對每一位參與者，分析他們在對話中所展現出的主要情緒（例如：沮喪、興奮、困惑、憤怒、理解、防禦、焦慮等）。
- 必須從文本中引用關鍵詞句作為你判斷情緒的依據。
- 如果對話中情緒有明顯的轉變，也請指出來。

## 步驟 2：總結對話內容
- 用 1-2 句話總結這次對話的核心議題或討論的主題。
- 以條列式的方式，列出雙方達成的共識或共同點。
- 以條列式的方式，列出雙方存在的分歧、誤解或待解決的問題。
- 總結對話的最終結果或下一步可能需要採取的行動（如果文本中有提及）。

# 輸出格式
請務必使用以下 Markdown 格式來呈現你的分析報告，確保結構清晰易讀：

### 1. 雙方情緒反應
* **[參與者A的名稱]:**
    * **主要情緒:** [例如：感到不滿與焦慮]
    * **情緒佐證:** "[此處引用能證明該情緒的對話原文]"
* **[參與者B的名稱]:**
    * **主要情緒:** [例如：試圖安撫但略帶防禦]
    * **情緒佐證:** "[此處引用能證明該情緒的對話原文]"

### 2. 對話內容總結
* **核心議題:** [簡要說明對話圍繞的核心問題]
* **主要共識:**
    * [條列說明雙方達成的一致意見]
* **主要分歧:**
    * [條列說明雙方未能達成一致的觀點]
* **結論或後續行動:** [總結對話的結果或下一步計畫]`;

const AUDIO_ANALYSIS_PROMPT = `# 身份與目標
你是一個專業的客服對話分析師。你的目標是分析一段客戶與客服人員的通話錄音，提供客觀的分析，並特別總結客戶不滿的原因。

# 任務指令
你將收到一個音檔。請嚴格按照以下三個步驟進行分析，並使用指定的格式輸出結果。

## 步驟 1：生成逐字稿
- 首先，將整個音檔對話轉換為逐字稿。
- 盡可能辨識出「客戶」與「客服人員」的發言，並在逐字稿中標示出來。

## 步驟 2：分析雙方情緒反應
- 根據逐字稿，分析「客戶」與「客服人員」在對話中所展現出的主要情緒（例如：沮喪、憤怒、困惑、有耐心、試圖解決問題等）。
- 必須從逐字稿中引用關鍵詞句作為你判斷情緒的依據。

## 步驟 3：總結客戶生氣的原因
- 這是最重要的步驟。
- 根據對話內容，用條列式的方式，清晰、簡潔地總結導致客戶生氣或不滿的**根本原因**。

# 輸出格式
請務必使用以下 Markdown 格式來呈現你的分析報告：

### 1. 通話逐字稿
[此處生成完整的對話逐字稿]

### 2. 雙方情緒反應
* **客戶:**
    * **主要情緒:** [例如：感到不滿與焦慮]
    * **情緒佐證:** "[此處引用能證明該情緒的對話原文]"
* **客服人員:**
    * **主要情緒:** [例如：試圖安撫但略帶防禦]
    * **情緒佐證:** "[此處引用能證明該情緒的對話原文]"

### 3. 客戶生氣原因總結
* **核心議題:** [簡要說明對話圍繞的核心問題]
* **主要原因:**
    - [條列說明導致客戶不滿的第一個原因]
    - [條列說明導致客戶不滿的第二個原因]
    - [依此類推...]
`;


async function fileToGenerativePart(file: File) {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
}


export async function analyzeConversation(conversationText: string): Promise<string> {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: conversationText,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Error analyzing conversation:", error);
    throw new Error("Failed to get analysis from the AI model. Please check your connection and API key.");
  }
}


export async function analyzeAudioConversation(audioFile: File): Promise<string> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const audioPart = await fileToGenerativePart(audioFile);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [
                {text: AUDIO_ANALYSIS_PROMPT},
                audioPart
            ] },
        });

        return response.text;
    } catch (error) {
        console.error("Error analyzing audio conversation:", error);
        throw new Error("Failed to get analysis from the AI model. The audio file might be too large or in an unsupported format.");
    }
}