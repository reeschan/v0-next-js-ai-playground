import FirecrawlApp from "@mendable/firecrawl-js"

export async function GET(req: Request) {
  const startTime = Date.now()
  const logs: string[] = []

  try {
    logs.push(`[${new Date().toISOString()}] Firecrawl研究ステータス確認リクエスト受信`)
    console.log(`[${new Date().toISOString()}] Firecrawl研究ステータス確認リクエスト受信`)

    const url = new URL(req.url)
    const jobId = url.searchParams.get("jobId")

    if (!jobId) {
      logs.push(`[${new Date().toISOString()}] エラー: ジョブIDが指定されていません`)
      console.log(`[${new Date().toISOString()}] エラー: ジョブIDが指定されていません`)
      return new Response(
        JSON.stringify({
          error: "Job ID is required",
          logs,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // モックジョブIDかどうかをチェック
    if (jobId.startsWith("mock-job-id-")) {
      logs.push(`[${new Date().toISOString()}] モックジョブIDを検出: ${jobId}`)
      console.log(`[${new Date().toISOString()}] モックジョブIDを検出: ${jobId}`)

      // モックステータスを返す
      const mockStatus = generateMockStatus(jobId)
      logs.push(`[${new Date().toISOString()}] モックステータスを返します`)

      const endTime = Date.now()
      const processingTime = endTime - startTime

      return new Response(
        JSON.stringify({
          ...mockStatus,
          logs,
          processingTimeMs: processingTime,
          requestTimestamp: new Date().toISOString(),
          isMockData: true,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // Firecrawl APIキーを環境変数から取得
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY

    if (!firecrawlApiKey) {
      logs.push(`[${new Date().toISOString()}] エラー: Firecrawl APIキーが設定されていません`)
      console.log(`[${new Date().toISOString()}] エラー: Firecrawl APIキーが設定されていません`)

      // APIキーがない場合はモックデータを返す
      const mockStatus = generateMockStatus(jobId)
      logs.push(`[${new Date().toISOString()}] APIキーがないためモックステータスを返します`)

      const endTime = Date.now()
      const processingTime = endTime - startTime

      return new Response(
        JSON.stringify({
          ...mockStatus,
          logs,
          processingTimeMs: processingTime,
          isMockData: true,
          requestTimestamp: new Date().toISOString(),
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    logs.push(`[${new Date().toISOString()}] ジョブID: "${jobId}"のステータスを確認します`)

    // APIキーのログ（セキュリティのため最初の数文字のみ）
    const apiKeyPreview =
      firecrawlApiKey.substring(0, 4) + "..." + firecrawlApiKey.substring(firecrawlApiKey.length - 4)
    logs.push(`[${new Date().toISOString()}] APIキー確認: ${apiKeyPreview}`)

    try {
      // Firecrawlクライアントを初期化 - APIキーをオブジェクトとして渡す
      const firecrawl = new FirecrawlApp({ apiKey: firecrawlApiKey })
      logs.push(`[${new Date().toISOString()}] Firecrawlクライアント初期化成功`)

      // ステータス確認APIを呼び出し
      const response = await firecrawl.getDeepResearchStatus(jobId)

      logs.push(
        `[${new Date().toISOString()}] ステータス確認APIレスポンス受信: ${JSON.stringify(response).substring(0, 200)}...`,
      )

      // レスポンスがnullまたは未定義の場合の処理
      if (!response) {
        throw new Error("Empty response from Firecrawl API")
      }

      const data = response

      // 進捗率の計算（レスポンスに含まれていない場合）
      if (data.currentDepth !== undefined && data.maxDepth !== undefined && data.status !== "completed") {
        data.progressPercentage = Math.round((data.currentDepth / data.maxDepth) * 100)
      } else if (data.status === "completed") {
        data.progressPercentage = 100
      }

      const endTime = Date.now()
      const processingTime = endTime - startTime
      logs.push(`[${new Date().toISOString()}] 処理時間: ${processingTime}ms`)

      return new Response(
        JSON.stringify({
          ...data,
          logs,
          processingTimeMs: processingTime,
          requestTimestamp: new Date().toISOString(),
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    } catch (apiError) {
      logs.push(
        `[${new Date().toISOString()}] API呼び出しエラー: ${apiError instanceof Error ? apiError.message : "Unknown error"}`,
      )
      console.error("Firecrawl API Call Error:", apiError)

      // エラーの場合はモックデータを返す
      const mockStatus = generateMockStatus(jobId)
      logs.push(`[${new Date().toISOString()}] APIエラーのためモックステータスを返します`)

      const endTime = Date.now()
      const processingTime = endTime - startTime

      return new Response(
        JSON.stringify({
          ...mockStatus,
          logs,
          processingTimeMs: processingTime,
          requestTimestamp: new Date().toISOString(),
          isMockData: true,
          authError: apiError instanceof Error && apiError.message.includes("Authentication") ? true : false,
          error: apiError instanceof Error ? apiError.message : "Unknown API error",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  } catch (error) {
    logs.push(`[${new Date().toISOString()}] エラー発生: ${error instanceof Error ? error.message : "Unknown error"}`)
    console.error("Error checking Firecrawl status:", error)

    // エラーが発生した場合はモックデータを返す
    const jobId = new URL(req.url).searchParams.get("jobId") || ""
    const mockStatus = generateMockStatus(jobId)

    const endTime = Date.now()
    const processingTime = endTime - startTime

    logs.push(`[${new Date().toISOString()}] エラーのためモックステータスを返します`)

    return new Response(
      JSON.stringify({
        ...mockStatus,
        error: error instanceof Error ? error.message : "Unknown error",
        logs,
        processingTimeMs: processingTime,
        isMockData: true,
        requestTimestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}

// モックのステータスを生成する関数（APIエラー時のフォールバック用）
function generateMockStatus(jobId: string) {
  // ランダムな進行状況を生成（デモ用）
  const maxDepth = 5
  const currentDepth = Math.min(maxDepth, Math.floor(Math.random() * (maxDepth + 1)))
  const isCompleted = currentDepth === maxDepth

  // 現在時刻を取得
  const now = new Date()

  // 活動ログを生成
  const activities = []
  for (let i = 1; i <= currentDepth; i++) {
    const timestamp = new Date(now.getTime() - (currentDepth - i + 1) * 60000).toISOString()

    let type, message
    if (i === 1) {
      type = "search"
      message = "初期検索を実行中"
    } else if (i === maxDepth) {
      type = "synthesize"
      message = "複数のソースからの情報を統合中"
    } else {
      type = "analyze"
      message = `深度${i}の分析を実行中`
    }

    activities.push({
      type,
      status: "completed",
      message,
      timestamp,
      depth: i,
    })
  }

  // 進行中の活動を追加（完了していない場合）
  if (!isCompleted) {
    activities.push({
      type: "analyze",
      status: "in_progress",
      message: `深度${currentDepth + 1}の分析を実行中`,
      timestamp: now.toISOString(),
      depth: currentDepth + 1,
    })
  }

  // ソースを生成
  const sources = [
    {
      url: "https://example.com/quantum-computing-2024",
      title: "量子コンピューティングの最新ブレークスルー",
      description: "量子コンピューティング技術の最近の進歩の概要",
    },
    {
      url: "https://example.com/quantum-error-correction",
      title: "量子エラー訂正の進歩",
      description: "最近の量子エラー訂正技術の詳細な分析",
    },
  ].slice(0, Math.ceil(currentDepth / 2)) // 進行状況に応じてソースの数を調整

  // 最終分析（完了している場合のみ）
  const finalAnalysis = isCompleted
    ? "量子コンピューティングの最近の発展は、いくつかの重要な分野で大きな進歩を示しています。"
    : null

  // 有効期限を設定（24時間後）
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  return {
    success: true,
    status: isCompleted ? "completed" : "in_progress",
    data: isCompleted
      ? {
          finalAnalysis,
          activities,
          sources,
        }
      : {
          activities,
          sources: sources.length > 0 ? sources : [],
        },
    currentDepth,
    maxDepth,
    progressPercentage: Math.round((currentDepth / maxDepth) * 100),
    expiresAt,
    jobId,
  }
}
