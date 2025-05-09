import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(req: Request) {
  try {
    // リクエストボディを解析
    const body = await req.json()
    const { query, provider = "openai", referenceUrlCount = 3 } = body

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    // 参考URLの数を制限（1〜10の範囲）
    const limitedReferenceUrlCount = Math.min(Math.max(1, referenceUrlCount), 10)

    // URLを抽出
    const urls = extractUrls(query)
    const limitedUrls = urls.slice(0, limitedReferenceUrlCount)

    // プロンプトを構築 - AIエージェントのアウトプットと同じ形式に
    const systemPrompt = `
# 役割と目的
あなたは製品情報抽出の専門家です。ユーザーが提供する製品名とURLから最適な製品情報を抽出し、構造化された形式で返してください。

# 入力情報
- 製品名: ユーザーが指定した製品の名称
- 製品URL: 製品情報が記載されているWebページのURL

# 情報抽出の優先順位
1. 提供されたURLから直接取得できる情報を最優先してください
2. 公式サイトの情報を優先し、レビューサイトやマーケットプレイスの情報は補足的に使用してください
3. 製品の実際の仕様や特徴に関する客観的情報を優先してください

# 抽出すべき情報
## 基本情報
- 製品の正式名称
- メーカー/ブランド名
- 製品カテゴリ
- 価格情報（税込・税抜を明記）
- 発売日/販売開始日

## 製品の良い点（最大3点）
各良い点について：
- 明確なタイトル（5-10文字程度）：製品の特徴や利点を端的に表現
- 詳細な説明（50-100文字程度）：以下の要素を含めてください
  * なぜそれが良い点なのか（ユーザーにとってのメリット）
  * 可能であれば具体的な数値やスペックを含める
  * 競合製品と比較した場合の優位性（もし情報があれば）
  * 実際のユーザー体験に基づいた評価（レビューから抽出）
- 情報源：公式サイト、専門家レビュー、ユーザーレビューなど、どこから抽出した情報かを明記

良い点の例：
1. タイトル：「バッテリー持続」
   説明：「4500mAhの大容量バッテリーにより、ヘビーユースでも最大20時間の連続使用が可能。競合製品の平均15時間と比較して約30%長持ちするため、外出先での充電の心配が少ない。」

2. タイトル：「高画質カメラ」
   説明：「5000万画素のメインカメラと先進的な画像処理エンジンにより、暗所でも鮮明な写真撮影が可能。レビューによると、同価格帯の製品と比較して特に夜景撮影の評価が高い。」

## 製品の悪い点（最大3点）
各悪い点について：
- 明確なタイトル（5-10文字程度）：問題点や制限を端的に表現
- 詳細な説明（50-100文字程度）：以下の要素を含めてください
  * 具体的にどのような問題や制限があるのか
  * それがユーザー体験にどのような影響を与えるか
  * 問題の深刻度や頻度（多くのユーザーが報告しているか、特定条件下でのみ発生するかなど）
  * 対処法や回避策があれば記載
- 情報源：公式サイトの制限事項、専門家レビュー、ユーザーレビューの不満点など

悪い点の例：
1. タイトル：「発熱問題」
   説明：「長時間の動画撮影や3Dゲームプレイ時に本体上部が熱くなる傾向がある。レビューによると、30分以上の連続使用で手に持てないほど熱くなるケースも報告されており、保護ケースの使用が推奨されている。」

2. タイトル：「充電速度」
   説明：「標準の充電器では0%から100%まで約2時間かかり、競合製品の急速充電（平均1時間）と比較して遅い。公式サイトによると別売りの急速充電器で改善可能だが、追加コストが発生する。」

## 技術仕様
- 寸法：幅×高さ×奥行き（単位付き）
- 重量（単位付き）
- 材質・素材
- 電源・バッテリー情報（該当する場合）
- 対応規格・互換性
- 保証期間
- その他製品カテゴリ特有の仕様情報

# 情報抽出のルール
1. 提供されたURLを自分で調査し、そこから情報を抽出してください
2. URLに記載されていない情報は「情報なし」として返してください
3. 推測や一般的な情報は含めないでください
4. ユーザーレビューからの情報は「レビューによると」と明記してください
5. 価格情報は通貨単位を明記し、セール価格と通常価格を区別してください
6. 複数のURLが提供された場合は、最初の${limitedReferenceUrlCount}個のURLのみを参照してください

# 出力形式
以下のJSON形式で情報を構造化して返してください：

{
  "productInfo": {
    "basic": {
      "fullName": "製品の正式名称",
      "manufacturer": "メーカー/ブランド名",
      "category": "製品カテゴリ",
      "price": {
        "current": "現在価格（税込/税抜を明記）",
        "original": "定価/通常価格（ある場合）"
      },
      "releaseDate": "発売日/販売開始日"
    },
    "goodPoints": [
      {
        "point": "良い点のタイトル",
        "description": "詳細な説明"
      },
            {
        "point": "良い点のタイトル2",
        "description": "詳細な説明2"
      }
    ],
    "badPoints": [
      {
        "point": "悪い点のタイトル",
        "description": "詳細な説明"
      },
            {
        "point": "悪い点のタイトル2",
        "description": "詳細な説明2"
      }
    ],
    "specifications": {
      "dimensions": "寸法情報",
      "weight": "重量情報",
      "materials": ["材質1", "材質2"],
      "powerSource": "電源情報",
      "standards": ["対応規格1", "対応規格2"],
      "warranty": "保証期間",
      "additionalSpecs": {
        "カスタム仕様1": "値1",
        "カスタム仕様2": "値2"
      }
    },
    "metaInfo": {
      "extractionDate": "情報抽出日時",
      "sourceUrls": ["使用したURL1", "使用したURL2"]
    }
  }
}

URLの内容を詳細に分析し、製品の特徴を適切に抽出してください。特に技術仕様については可能な限り詳細に抽出し、消費者の購入判断に役立つ情報を優先してください。
`

    // ユーザーの入力を解析
    let userPrompt = query

    // URLがある場合、それをプロンプトに追加
    if (limitedUrls.length > 0) {
      userPrompt += `\n\n参考URL:\n${limitedUrls.join("\n")}`
    }

    console.log("System prompt:", systemPrompt)
    console.log("User prompt (first 500 chars):", userPrompt.substring(0, 500) + "...")

    let responseContent = ""
    let usage = null

    // プロバイダーに応じてAPIを呼び出し
    if (provider === "gemini" || provider === "gemini-light") {
      // Gemini APIキーを環境変数から取得
      const apiKey = process.env.GEMINI_API_KEY

      if (!apiKey) {
        return NextResponse.json({ error: "Gemini API key is not configured" }, { status: 500 })
      }

      try {
        // Gemini APIを初期化
        const genAI = new GoogleGenerativeAI(apiKey)
        // プロバイダーに応じてモデルを選択
        const modelName = provider === "gemini" ? "gemini-1.5-flash" : "gemini-1.5-flash-latest"
        const model = genAI.getGenerativeModel({ model: modelName })

        // Geminiへのリクエスト
        const geminiPrompt = `${systemPrompt}\n\nユーザーの入力: ${userPrompt}`

        const result = await model.generateContent(geminiPrompt)
        const response = await result.response
        const rawText = response.text()

        // Geminiはマークダウンコードブロックを返すことがあるので、それを取り除く
        responseContent = cleanGeminiResponse(rawText)

        console.log("Cleaned Gemini response:", responseContent.substring(0, 200) + "...")

        // Geminiは使用量情報を返さないため、ダミーデータを作成
        usage = {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          cost: 0,
        }
      } catch (error) {
        console.error("Gemini API error:", error)
        return NextResponse.json(
          {
            error: `Gemini API error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
          { status: 500 },
        )
      }
    } else if (provider === "openai" || provider === "gpt35") {
      // OpenAI APIキーを環境変数から取得
      const apiKey = process.env.OPENAI_API_KEY

      if (!apiKey) {
        return NextResponse.json({ error: "OpenAI API key is not configured" }, { status: 500 })
      }

      // プロバイダーに応じてモデルを選択
      const modelName = provider === "openai" ? "gpt-4o" : "gpt-3.5-turbo"

      // OpenAI APIを直接呼び出し
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error("OpenAI API error:", errorData)
        return NextResponse.json(
          {
            error: `OpenAI API error: ${response.status} ${response.statusText}`,
            details: errorData,
          },
          { status: response.status },
        )
      }

      const completion = await response.json()

      // レスポンスを取得
      responseContent = completion.choices[0].message.content || "{}"
      usage = completion.usage
    }

    // JSONとして解析
    let parsedResponse
    try {
      parsedResponse = JSON.parse(responseContent)
    } catch (error) {
      console.error("Error parsing JSON response:", error)
      console.log("Raw response:", responseContent)
      return NextResponse.json(
        {
          error: "Failed to parse AI response as JSON",
          details: error instanceof Error ? error.message : "Unknown error",
          rawResponse: responseContent,
        },
        { status: 500 },
      )
    }

    // 使用量情報を追加
    if (usage) {
      parsedResponse._usage = {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        // コストを概算（実際のコストはAPIによって異なる場合があります）
        cost: calculateCost(usage.prompt_tokens, usage.completion_tokens, provider),
      }
    }

    // URL情報を追加（デバッグ用）
    parsedResponse._urls = {
      provided: limitedUrls,
      count: limitedUrls.length,
    }

    // 使用したプロバイダー情報を追加
    parsedResponse._provider = provider

    return NextResponse.json(parsedResponse)
  } catch (error) {
    console.error("Error analyzing product:", error)

    // エラーメッセージを取得
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        error: `Failed to analyze product: ${errorMessage}`,
        details: "No additional details",
      },
      { status: 500 },
    )
  }
}

// URLを抽出する関数
function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return text.match(urlRegex) || []
}

// コストを計算する関数（概算）
function calculateCost(promptTokens: number, completionTokens: number, provider: string): number {
  if (provider === "gemini" || provider === "gemini-light") {
    // Gemini 1.5 Flashの概算コスト（2024年5月時点）
    const costPer1k = provider === "gemini" ? 0.0035 : 0.0025 // $0.0035/$0.0025 per 1K tokens (概算)
    return ((promptTokens + completionTokens) / 1000) * costPer1k
  } else if (provider === "gpt35") {
    // GPT-3.5 Turboの概算コスト
    const promptCostPer1k = 0.0005 // $0.0005 per 1K tokens
    const completionCostPer1k = 0.0015 // $0.0015 per 1K tokens
    return (promptTokens / 1000) * promptCostPer1k + (completionTokens / 1000) * completionCostPer1k
  } else {
    // OpenAIのGPT-4oの場合の概算コスト
    const promptCostPer1k = 0.01 // $0.01 per 1K tokens
    const completionCostPer1k = 0.03 // $0.03 per 1K tokens
    return (promptTokens / 1000) * promptCostPer1k + (completionTokens / 1000) * completionCostPer1k
  }
}

// Geminiのレスポンスからマークダウンコードブロックを取り除く関数
function cleanGeminiResponse(text: string): string {
  // マークダウンのコードブロック（\`\`\`json と \`\`\`）を取り除く
  let cleaned = text.replace(/^```json\s*/m, "").replace(/\s*```$/m, "")

  // それでもJSONとして解析できない場合は、JSONっぽい部分を抽出する
  if (!isValidJSON(cleaned)) {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleaned = jsonMatch[0]
    }
  }

  return cleaned
}

// 文字列が有効なJSONかどうかをチェックする関数
function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch (e) {
    return false
  }
}
