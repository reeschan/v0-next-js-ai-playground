import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"

// Allow responses up to 60 seconds
export const maxDuration = 60

// 実在する可能性の高い製品レビューサイトのリスト
const REAL_REVIEW_SITES = [
  "www.amazon.co.jp",
  "kakaku.com",
  "www.yodobashi.com",
  "k-tai.watch.impress.co.jp",
  "www.gizmodo.jp",
  "www.itmedia.co.jp",
  "japanese.engadget.com",
  "www.cnet.com",
  "www.techradar.com",
  "www.pcmag.com",
  "www.trustedreviews.com",
  "www.digitaltrends.com",
  "www.theverge.com",
  "www.wired.com",
  "av.watch.impress.co.jp",
  "www.phileweb.com",
  "www.watch.impress.co.jp",
  "www.dpreview.com",
  "dc.watch.impress.co.jp",
  "www.biccamera.com",
  "www.yamada-denki.jp",
  "www.joshinweb.jp",
  "www.nojima.co.jp",
  "www.edion.com",
  "www.rakuten.co.jp",
]

// OpenAIモデルの価格情報（1000トークンあたりの価格、USD）
const MODEL_PRICING = {
  "gpt-4o": {
    input: 0.005, // $0.005 per 1K input tokens
    output: 0.015, // $0.015 per 1K output tokens
  },
  "gpt-4": {
    input: 0.03, // $0.03 per 1K input tokens
    output: 0.06, // $0.06 per 1K output tokens
  },
  "gpt-3.5-turbo": {
    input: 0.0005, // $0.0005 per 1K input tokens
    output: 0.0015, // $0.0015 per 1K output tokens
  },
}

export async function POST(req: Request) {
  const startTime = Date.now()

  try {
    const { query, provider, referenceUrlCount = 3 } = await req.json()

    if (!query) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 参考URLの数を1〜10の範囲に制限
    const urlCount = Math.max(1, Math.min(10, referenceUrlCount))

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not configured in environment variables")
      return new Response(
        JSON.stringify({
          error: "OpenAI API key is not configured. Please add your API key to the environment variables.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    console.log("API Key is configured, proceeding with analysis...")
    console.log(`Requesting ${urlCount} reference URLs for query: ${query}`)

    // 動的にスキーマを生成して参考URLの数を指定
    const productSchema = z.object({
      productInfo: z
        .object({
          goodPoints: z
            .array(
              z.object({
                point: z.string().describe("製品の良い点（日本語で具体的に）"),
                description: z.string().describe("その良い点の詳細な説明（日本語で）"),
              }),
            )
            .length(3)
            .describe("製品の良い点を3つ（日本語で）"),
          badPoints: z
            .array(
              z.object({
                point: z.string().describe("製品の悪い点（日本語で具体的に）"),
                description: z.string().describe("その悪い点の詳細な説明（日本語で）"),
              }),
            )
            .length(3)
            .describe("製品の悪い点を3つ（日本語で）"),
          specifications: z
            .object({
              dimensions: z.string().optional().describe("製品の寸法（日本語で）"),
              weight: z.string().optional().describe("製品の重量（日本語で）"),
              materials: z.array(z.string()).optional().describe("製品の材質（日本語で）"),
              standards: z.array(z.string()).optional().describe("製品の規格（日本語で）"),
              additionalSpecs: z.record(z.string()).optional().describe("その他の仕様情報（日本語で）"),
            })
            .describe("製品の仕様情報（日本語で）"),
          referenceUrls: z
            .array(z.string().url().describe("参考にしたウェブサイトの実際のURL"))
            .min(urlCount)
            .max(urlCount)
            .describe(`参考にしたウェブサイトの実際のURLリスト（${urlCount}個）`),
        })
        .describe("製品情報の詳細（すべて日本語で記述）"),
    })

    // 実在するレビューサイトのリストを文字列として結合
    const reviewSitesString = REAL_REVIEW_SITES.map(
      (site) => `- https://${site}/（このドメインの後に適切なパスを追加）`,
    ).join("\n")

    const systemPrompt = `
      あなたは製品調査アシスタントです。与えられた製品「${query}」を徹底的に分析し、以下の情報を提供してください：
      
      1. 製品の良い点3つ（各ポイントに簡潔な説明を付ける）
      2. 製品の悪い点または制限事項3つ（各ポイントに簡潔な説明を付ける）
      3. 製品の仕様（寸法、重量、材質、規格、その他の関連仕様を含む）
      4. 分析の参考にしたウェブサイトのURLリスト（正確に${urlCount}個）
      
      **非常に重要な指示**:
      - すべての回答は日本語で提供してください。
      - 「example」や「例」などのプレースホルダーは使わないでください。実際の分析結果を提供してください。
      - 参考URLは必ず${urlCount}個提供してください。多すぎても少なすぎてもいけません。
      - URLは以下のような実在する可能性の高いサイトのURLを使用してください：
      
      ${reviewSitesString}
      
      - 「exampleproductsite」や「example.com」などの明らかに架空のドメインは使用しないでください。
      - URLは実際に存在する可能性のある形式にしてください（例：https://www.amazon.co.jp/dp/B0CHX3QBCH など）。
      - 製品の実際の特徴に基づいた具体的な良い点・悪い点を挙げてください。
      - 「良い点1」「悪い点1」などの一般的な表現ではなく、具体的な特徴を挙げてください。
      
      分析を構造化されたJSON形式で提供してください。客観的かつ徹底的な評価を行ってください。
      特定の情報が入手できない場合は、類似製品に基づいて合理的な推測を行ってください。
    `

    let result
    let usageInfo = null
    const modelName = "gpt-4o" // 使用するモデル名

    switch (provider) {
      case "openai":
        try {
          console.log("Sending request to OpenAI with system prompt:", systemPrompt)

          const { object, usage } = await generateObject({
            model: openai(modelName),
            schema: productSchema,
            prompt: `製品「${query}」について詳細な分析を行い、良い点3つ、悪い点3つ、仕様情報、参考URL${urlCount}個を日本語で提供してください。参考URLは実在する可能性の高いものを使用してください。`,
            system: systemPrompt,
            temperature: 0.7, // 創造性を少し高めに設定
            maxTokens: 2000, // 十分な長さを確保
          })

          console.log("Received response from OpenAI with usage:", usage)

          // トークン使用量とコスト計算
          usageInfo = {
            model: modelName,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            inputCost: (usage.promptTokens / 1000) * MODEL_PRICING[modelName].input,
            outputCost: (usage.completionTokens / 1000) * MODEL_PRICING[modelName].output,
            totalCost:
              (usage.promptTokens / 1000) * MODEL_PRICING[modelName].input +
              (usage.completionTokens / 1000) * MODEL_PRICING[modelName].output,
            processingTimeMs: Date.now() - startTime,
          }

          result = {
            ...object,
            _usage: usageInfo,
          }
        } catch (error) {
          console.error("Error calling OpenAI:", error)
          return new Response(
            JSON.stringify({
              error: "Error calling OpenAI API. Please check your API key and try again.",
              details: error instanceof Error ? error.message : "Unknown error",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          )
        }
        break

      // Add cases for other providers when implemented

      default:
        return new Response(JSON.stringify({ error: "Invalid provider" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
    }

    const endTime = Date.now()
    const processingTime = endTime - startTime

    console.log(`Request processed in ${processingTime}ms`)

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Error analyzing product:", error)

    const endTime = Date.now()
    const processingTime = endTime - startTime

    return new Response(
      JSON.stringify({
        error: "Failed to analyze product",
        details: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: processingTime,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
