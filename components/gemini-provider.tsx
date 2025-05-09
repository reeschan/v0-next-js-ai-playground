import { z } from "zod"

// スキーマを更新して参考URLを含める
const productSchema = z.object({
  productInfo: z.object({
    goodPoints: z
      .array(
        z.object({
          point: z.string(),
          description: z.string(),
        }),
      )
      .length(3),
    badPoints: z
      .array(
        z.object({
          point: z.string(),
          description: z.string(),
        }),
      )
      .length(3),
    specifications: z.object({
      dimensions: z.string().optional(),
      weight: z.string().optional(),
      materials: z.array(z.string()).optional(),
      standards: z.array(z.string()).optional(),
      additionalSpecs: z.record(z.string()).optional(),
    }),
    referenceUrls: z.array(z.string()).min(1).describe("参考にしたウェブサイトのURLリスト"),
  }),
})

class GeminiProvider {
  static async searchProduct(query: string) {
    try {
      // This is a placeholder for future implementation
      // When you're ready to implement Gemini, uncomment and modify this code

      /*
      const systemPrompt = `
        あなたは製品調査アシスタントです。与えられた製品を分析し、以下の情報を提供してください：
        1. 製品の良い点3つ（各ポイントに簡潔な説明を付ける）
        2. 製品の悪い点または制限事項3つ（各ポイントに簡潔な説明を付ける）
        3. 製品の仕様（寸法、重量、材質、規格、その他の関連仕様を含む）
        4. 分析の参考にしたウェブサイトのURLリスト（少なくとも1つ）
        
        **重要**: すべてのポイントと説明は日本語で提供してください。
        
        分析を構造化されたJSON形式で提供してください。客観的かつ徹底的な評価を行ってください。
        特定の情報が入手できない場合は、類似製品に基づいて合理的な推測を行ってください。
      `;

      const { object } = await generateObject({
        model: googleGenerativeAI('gemini-1.5-pro'),
        schema: productSchema,
        prompt: query,
        system: systemPrompt,
      });

      return object;
      */

      // For now, return a message that Gemini is not yet implemented
      return {
        message: "Gemini integration is coming soon. Please use OpenAI for now.",
      }
    } catch (error) {
      console.error("Error in Gemini search:", error)
      throw error
    }
  }
}

export default GeminiProvider
