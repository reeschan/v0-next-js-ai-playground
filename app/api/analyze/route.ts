import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    // リクエストボディを解析
    const body = await req.json()
    const { query, provider = "openai", referenceUrlCount = 3 } = body

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    // OpenAI APIキーを環境変数から取得
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key is not configured" }, { status: 500 })
    }

    // 参考URLの数を制限（1〜10の範囲）
    const limitedReferenceUrlCount = Math.min(Math.max(1, referenceUrlCount), 10)

    // プロンプトを構築 - AIエージェントのアウトプットと同じ形式に
    const systemPrompt = `あなたは製品情報の専門家です。ユーザーが提供する製品名や説明に基づいて、詳細な製品情報を提供してください。
情報は以下の構造でJSON形式で返してください：

{
  "productInfo": {
    "goodPoints": [
      { "point": "良い点のタイトル", "description": "詳細な説明" }
    ],
    "badPoints": [
      { "point": "悪い点のタイトル", "description": "詳細な説明" }
    ],
    "specifications": {
      "dimensions": "寸法情報",
      "weight": "重量情報",
      "materials": ["材質1", "材質2"],
      "standards": ["対応規格1", "対応規格2"],
      "additionalSpecs": {
        "カスタム仕様1": "値1",
        "カスタム仕様2": "値2"
      }
    }
  }
}

製品に関する情報が不足している場合は、一般的な情報や推測に基づいて回答してください。
ただし、明らかに間違った情報は提供しないでください。
情報が不明な場合は、該当するフィールドを空にするか、「情報なし」と記入してください。

ユーザーが複数のURLを提供している場合は、最初の${limitedReferenceUrlCount}個のURLのみを参考にしてください。
`

    // ユーザーの入力を解析（URLを抽出）
    const urls = extractUrls(query)
    const limitedUrls = urls.slice(0, limitedReferenceUrlCount)

    // URLを含むかどうかでプロンプトを調整
    let userPrompt = query
    if (limitedUrls.length > 0) {
      userPrompt += `\n\n参考URL:\n${limitedUrls.join("\n")}`
    }

    console.log("System prompt:", systemPrompt)
    console.log("User prompt:", userPrompt)

    // OpenAI APIを直接呼び出し
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: provider === "openai" ? "gpt-4o" : "gpt-4o",
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
    const responseContent = completion.choices[0].message.content || "{}"

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
    const usage = completion.usage
    if (usage) {
      parsedResponse._usage = {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        // コストを概算（実際のコストはAPIによって異なる場合があります）
        cost: calculateCost(usage.prompt_tokens, usage.completion_tokens, provider),
      }
    }

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
  // OpenAIのGPT-4oの場合の概算コスト（2024年5月時点）
  // 実際のコストはAPIによって異なる場合があります
  const promptCostPer1k = 0.01 // $0.01 per 1K tokens
  const completionCostPer1k = 0.03 // $0.03 per 1K tokens

  return (promptTokens / 1000) * promptCostPer1k + (completionTokens / 1000) * completionCostPer1k
}
