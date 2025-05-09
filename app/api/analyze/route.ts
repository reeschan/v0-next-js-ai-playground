import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import Anthropic from "@anthropic-ai/sdk"

// タイムアウト設定（ミリ秒）
const API_TIMEOUT = 60000 // 60秒

// タイムアウト付きのfetchを実装
const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number) => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(id)
    return response
  } catch (error) {
    clearTimeout(id)
    throw error
  }
}

export async function POST(req: Request) {
  try {
    console.log("API route called: /api/analyze")

    // リクエストボディを解析
    const body = await req.json()
    const { query, provider = "openai", referenceUrlCount = 3 } = body

    console.log(`Provider: ${provider}, Reference URL count: ${referenceUrlCount}`)

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    // 参考URLの数を制限（1〜10の範囲）
    const limitedReferenceUrlCount = Math.min(Math.max(1, referenceUrlCount), 10)

    // URLを抽出
    const urls = extractUrls(query)
    const limitedUrls = urls.slice(0, limitedReferenceUrlCount)
    console.log(`Extracted URLs: ${limitedUrls.length}`)

    // プロンプトを構築 - AIエージェントのアウトプットと同じ形式に
    // JSONを返すように強調するメッセージを追加
    const systemPrompt = `
# 重要: 必ずJSON形式で回答してください。テキスト形式での回答は受け付けられません。

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
以下のJSON形式で情報を構造化して返してください。説明文や前置きは一切不要です：

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

# 重要: 必ずJSON形式のみで回答してください。説明文や前置きは一切含めないでください。
`

    // ユーザーの入力を解析
    let userPrompt = query

    // URLがある場合、それをプロンプトに追加
    if (limitedUrls.length > 0) {
      userPrompt += `

参考URL:
${limitedUrls.join("\n")}`
    }

    console.log("User prompt length:", userPrompt.length)

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
        console.log("Initializing Gemini API...")
        // Gemini APIを初期化
        const genAI = new GoogleGenerativeAI(apiKey)
        // プロバイダーに応じてモデルを選択
        const modelName = provider === "gemini" ? "gemini-1.5-flash" : "gemini-1.5-flash-latest"
        console.log(`Using Gemini model: ${modelName}`)

        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json", // JSONレスポンスを明示的に要求
          },
        })

        // Geminiへのリクエスト
        const geminiPrompt = `${systemPrompt}

ユーザーの入力: ${userPrompt}`

        console.log("Sending request to Gemini API...")
        const result = await model.generateContent(geminiPrompt)
        console.log("Gemini API response received")

        const response = await result.response
        const rawText = response.text()

        // Geminiはマークダウンコードブロックを返すことがあるので、それを取り除く
        responseContent = extractJsonFromText(rawText)

        console.log("Cleaned Gemini response length:", responseContent.length)

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
            details: error instanceof Error ? error.stack : "No stack trace available",
          },
          { status: 500 },
        )
      }
    } else if (provider === "claude-sonnet" || provider === "claude-haiku") {
      // Claude APIキーを環境変数から取得
      const apiKey = process.env.CLAUDE_API_KEY

      if (!apiKey) {
        return NextResponse.json({ error: "Claude API key is not configured" }, { status: 500 })
      }

      try {
        console.log("Initializing Anthropic client...")

        // プロバイダーに応じてモデルを選択
        const modelName = provider === "claude-sonnet" ? "claude-3-7-sonnet-20250219" : "claude-3-5-haiku-20241022"
        console.log(`Using Claude model: ${modelName}`)

        // Anthropic APIを初期化 - dangerouslyAllowBrowserオプションを追加
        const anthropic = new Anthropic({
          apiKey: apiKey,
          dangerouslyAllowBrowser: true, // ブラウザ環境でも実行できるようにする
        })

        console.log("Sending request to Claude API...")

        try {
          // 入力値のバリデーション
          if (!userPrompt || typeof userPrompt !== "string") {
            throw new Error(`Invalid userPrompt: ${typeof userPrompt}`)
          }

          if (!systemPrompt || typeof systemPrompt !== "string") {
            throw new Error(`Invalid systemPrompt: ${typeof systemPrompt}`)
          }

          if (!modelName || typeof modelName !== "string") {
            throw new Error(`Invalid modelName: ${typeof modelName}`)
          }

          // デバッグ情報を出力
          console.log("Claude API request parameters:")
          console.log("- Model:", modelName)
          console.log("- System prompt length:", systemPrompt.length)
          console.log("- User prompt length:", userPrompt.length)

          // Claudeへのリクエスト
          const response = await anthropic.messages.create({
            model: modelName,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: userPrompt,
              },
            ],
            max_tokens: 4000,
            temperature: 0.2,
            response_format: { type: "json_object" },
          })

          console.log("Claude API response received")

          // レスポンスを取得 - 安全にアクセスするように修正
          if (response && response.content && Array.isArray(response.content) && response.content.length > 0) {
            const contentItem = response.content[0]
            if (contentItem && typeof contentItem === "object" && "text" in contentItem && contentItem.text) {
              const rawText = contentItem.text
              // JSONを抽出
              responseContent = extractJsonFromText(rawText)
              console.log("Claude response content length:", responseContent.length)
            } else {
              console.error("Unexpected Claude API content structure:", JSON.stringify(contentItem).substring(0, 200))
              throw new Error("Invalid content structure in Claude API response")
            }
          } else {
            console.error("Unexpected Claude API response structure:", JSON.stringify(response).substring(0, 200))
            throw new Error("Invalid response structure from Claude API")
          }

          // Claudeの使用量情報を取得 - 安全にアクセスするように修正
          if (response && response.usage) {
            usage = {
              prompt_tokens: response.usage.input_tokens || 0,
              completion_tokens: response.usage.output_tokens || 0,
              total_tokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0),
            }
          } else {
            console.warn("Usage information not available in Claude API response")
            usage = {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
            }
          }
        } catch (claudeError) {
          console.error("Claude API request error:", claudeError)
          console.error("Error details:", claudeError instanceof Error ? claudeError.stack : "No stack trace available")

          // Claude APIが失敗した場合、OpenAIにフォールバック
          console.log("Falling back to OpenAI API...")
          return await handleOpenAIRequest(systemPrompt, userPrompt, "gpt-4o")
        }
      } catch (error) {
        console.error("Claude API initialization error:", error)
        return NextResponse.json(
          {
            error: `Claude API error: ${error instanceof Error ? error.message : "Unknown error"}`,
            details: error instanceof Error ? error.stack : "No stack trace available",
          },
          { status: 500 },
        )
      }
    } else if (provider === "openai" || provider === "gpt35") {
      // OpenAI APIを使用
      const modelName = provider === "openai" ? "gpt-4o" : "gpt-3.5-turbo"
      return await handleOpenAIRequest(systemPrompt, userPrompt, modelName)
    }

    // JSONとして解析
    let parsedResponse
    try {
      parsedResponse = JSON.parse(responseContent)
    } catch (error) {
      console.error("Error parsing JSON response:", error)
      console.log("Raw response (first 500 chars):", responseContent.substring(0, 500))

      // JSONパースエラーの場合、デフォルトの製品情報を返す
      return NextResponse.json(
        {
          productInfo: {
            basic: {
              fullName: "情報を抽出できませんでした",
              manufacturer: "不明",
              category: "不明",
              price: {
                current: "情報なし",
                original: "情報なし",
              },
              releaseDate: "情報なし",
            },
            goodPoints: [
              {
                point: "情報なし",
                description: "製品情報を抽出できませんでした。別の製品名やURLを試してください。",
              },
            ],
            badPoints: [
              {
                point: "情報なし",
                description: "製品情報を抽出できませんでした。別の製品名やURLを試してください。",
              },
            ],
            specifications: {
              dimensions: "情報なし",
              weight: "情報なし",
              materials: ["情報なし"],
              powerSource: "情報なし",
              standards: ["情報なし"],
              warranty: "情報なし",
              additionalSpecs: {
                注意: "製品情報を抽出できませんでした",
              },
            },
            metaInfo: {
              extractionDate: new Date().toISOString(),
              sourceUrls: limitedUrls.length > 0 ? limitedUrls : ["URLが提供されていません"],
            },
          },
          _error: {
            message: "AIからの応答をJSONとして解析できませんでした",
            details: error instanceof Error ? error.message : "Unknown error",
            rawResponsePreview: responseContent.substring(0, 200) + "...",
          },
          _provider: provider,
        },
        { status: 200 }, // エラーでも200を返してクライアント側で表示できるようにする
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
    const stackTrace = error instanceof Error ? error.stack : "No stack trace available"

    return NextResponse.json(
      {
        error: `Failed to analyze product: ${errorMessage}`,
        details: stackTrace,
      },
      { status: 500 },
    )
  }
}

// OpenAI APIリクエストを処理する関数
async function handleOpenAIRequest(systemPrompt: string, userPrompt: string, modelName: string) {
  // OpenAI APIキーを環境変数から取得
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key is not configured" }, { status: 500 })
  }

  console.log(`Using OpenAI model: ${modelName}`)

  try {
    // 入力値のバリデーション
    if (!userPrompt || typeof userPrompt !== "string") {
      throw new Error(`Invalid userPrompt: ${typeof userPrompt}`)
    }

    if (!systemPrompt || typeof systemPrompt !== "string") {
      throw new Error(`Invalid systemPrompt: ${typeof systemPrompt}`)
    }

    if (!modelName || typeof modelName !== "string") {
      throw new Error(`Invalid modelName: ${typeof modelName}`)
    }

    console.log("Sending request to OpenAI API...")

    // OpenAI APIを直接呼び出し（タイムアウト付き）
    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
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
      },
      API_TIMEOUT,
    )

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

    console.log("OpenAI API response received")
    const completion = await response.json()

    // レスポンスを取得
    const responseContent =
      completion.choices && completion.choices[0] && completion.choices[0].message
        ? completion.choices[0].message.content || "{}"
        : "{}"
    console.log("OpenAI response content length:", responseContent.length)

    // JSONとして解析
    let parsedResponse
    try {
      parsedResponse = JSON.parse(responseContent)
    } catch (error) {
      console.error("Error parsing OpenAI JSON response:", error)
      return NextResponse.json(
        {
          productInfo: {
            basic: {
              fullName: "情報を抽出できませんでした",
              manufacturer: "不明",
              category: "不明",
              price: {
                current: "情報なし",
                original: "情報なし",
              },
              releaseDate: "情報なし",
            },
            goodPoints: [
              {
                point: "情報なし",
                description: "製品情報を抽出できませんでした。別の製品名やURLを試してください。",
              },
            ],
            badPoints: [
              {
                point: "情報なし",
                description: "製品情報を抽出できませんでした。別の製品名やURLを試してください。",
              },
            ],
            specifications: {
              dimensions: "情報なし",
              weight: "情報なし",
              materials: ["情報なし"],
              powerSource: "情報なし",
              standards: ["情報なし"],
              warranty: "情報なし",
              additionalSpecs: {
                注意: "製品情報を抽出できませんでした",
              },
            },
            metaInfo: {
              extractionDate: new Date().toISOString(),
              sourceUrls: [],
            },
          },
          _error: {
            message: "OpenAIからの応答をJSONとして解析できませんでした",
            details: error instanceof Error ? error.message : "Unknown error",
            rawResponsePreview: responseContent.substring(0, 200) + "...",
          },
          _provider: modelName === "gpt-4o" ? "openai" : "gpt35",
        },
        { status: 200 }, // エラーでも200を返してクライアント側で表示できるようにする
      )
    }

    // 使用量情報を追加
    if (completion.usage) {
      parsedResponse._usage = {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens,
        // コストを概算
        cost: calculateCost(
          completion.usage.prompt_tokens,
          completion.usage.completion_tokens,
          modelName === "gpt-4o" ? "openai" : "gpt35",
        ),
      }
    }

    // 使用したプロバイダー情報を追加
    parsedResponse._provider = modelName === "gpt-4o" ? "openai" : "gpt35"

    return NextResponse.json(parsedResponse)
  } catch (error) {
    console.error("OpenAI API request error:", error)
    return NextResponse.json(
      {
        error: `OpenAI API error: ${error instanceof Error ? error.message : "Unknown error"}`,
        details: error instanceof Error ? error.stack : "No stack trace available",
      },
      { status: 500 },
    )
  }
}

// URLを抽出する関数
function extractUrls(text: string): string[] {
  if (!text || typeof text !== "string") {
    console.warn(`Invalid input to extractUrls: ${typeof text}`)
    return []
  }
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
  } else if (provider === "claude-sonnet") {
    // Claude 3.7 Sonnetの概算コスト
    const promptCostPer1k = 0.015 // $0.015 per 1K tokens
    const completionCostPer1k = 0.075 // $0.075 per 1K tokens
    return (promptTokens / 1000) * promptCostPer1k + (completionTokens / 1000) * completionCostPer1k
  } else if (provider === "claude-haiku") {
    // Claude 3.5 Haikuの概算コスト
    const promptCostPer1k = 0.00025 // $0.00025 per 1K tokens
    const completionCostPer1k = 0.00125 // $0.00125 per 1K tokens
    return (promptTokens / 1000) * promptCostPer1k + (completionTokens / 1000) * completionCostPer1k
  } else {
    // OpenAIのGPT-4oの場合の概算コスト
    const promptCostPer1k = 0.01 // $0.01 per 1K tokens
    const completionCostPer1k = 0.03 // $0.03 per 1K tokens
    return (promptTokens / 1000) * promptCostPer1k + (completionTokens / 1000) * completionCostPer1k
  }
}

// テキストからJSONを抽出する関数（改良版）
function extractJsonFromText(text: string): string {
  if (!text || typeof text !== "string") {
    console.warn(`Invalid input to extractJsonFromText: ${typeof text}`)
    return "{}"
  }

  // まず、マークダウンのコードブロックを取り除く
  let cleaned = text.replace(/```json\s*([\s\S]*?)\s*```/g, "$1")

  // それでもJSONとして解析できない場合は、JSONっぽい部分を抽出する
  if (!isValidJSON(cleaned)) {
    // 最初の { から最後の } までを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleaned = jsonMatch[0]

      // それでもJSONとして解析できない場合は、さらに処理を試みる
      if (!isValidJSON(cleaned)) {
        // 余分なテキストを削除して再試行
        cleaned = cleaned.replace(/^[^{]*/, "").replace(/[^}]*$/, "")
      }
    } else {
      // JSONが見つからない場合は空のJSONオブジェクトを返す
      cleaned = "{}"
    }
  }

  // 最終的なチェック
  if (!isValidJSON(cleaned)) {
    console.warn("Failed to extract valid JSON, returning empty object")
    return "{}"
  }

  return cleaned
}

// 文字列が有効なJSONかどうかをチェックする関数
function isValidJSON(str: string): boolean {
  if (!str || typeof str !== "string") {
    return false
  }

  try {
    JSON.parse(str)
    return true
  } catch (e) {
    return false
  }
}
