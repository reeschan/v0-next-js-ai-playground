import FirecrawlApp from "@mendable/firecrawl-js"

export async function GET(req: Request) {
  const startTime = Date.now()
  const logs: string[] = []
  let results: any
  let jobId: string | null = null

  try {
    logs.push(`[${new Date().toISOString()}] Firecrawl検索リクエスト受信`)

    const url = new URL(req.url)
    const query = url.searchParams.get("q")
    const deepResearch = url.searchParams.get("deepResearch") === "true"

    // Deep Researchのパラメータを取得
    const maxDepth = Number.parseInt(url.searchParams.get("maxDepth") || "5", 10)
    const timeLimit = Number.parseInt(url.searchParams.get("timeLimit") || "180", 10)
    const maxUrls = Number.parseInt(url.searchParams.get("maxUrls") || "15", 10)

    if (!query) {
      logs.push(`[${new Date().toISOString()}] エラー: 検索クエリが指定されていません`)
      return new Response(
        JSON.stringify({
          error: "Search query is required",
          logs,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // Firecrawl APIキーを環境変数から取得
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY

    if (!firecrawlApiKey) {
      logs.push(`[${new Date().toISOString()}] 警告: Firecrawl APIキーが設定されていません。モックデータを返します。`)
      console.warn("Firecrawl API key is not configured. Returning mock data.")

      // モックデータを返す
      const mockResults = generateMockResults(query, deepResearch, { maxDepth, timeLimit, maxUrls })

      const endTime = Date.now()
      const processingTime = endTime - startTime

      return new Response(
        JSON.stringify({
          results: mockResults,
          logs,
          processingTimeMs: processingTime,
          engine: "firecrawl",
          deepResearch,
          jobId: deepResearch ? "mock-job-id-" + Date.now() : null,
          rawResponse: mockResults,
          isMockData: true,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    logs.push(`[${new Date().toISOString()}] 検索クエリ: "${query}", Deep Research: ${deepResearch}`)
    logs.push(
      `[${new Date().toISOString()}] パラメータ: maxDepth=${maxDepth}, timeLimit=${timeLimit}, maxUrls=${maxUrls}`,
    )

    // APIキーのログ（セキュリティのため最初の数文字のみ）
    const apiKeyPreview =
      firecrawlApiKey.substring(0, 4) + "..." + firecrawlApiKey.substring(firecrawlApiKey.length - 4)
    logs.push(`[${new Date().toISOString()}] APIキー確認: ${apiKeyPreview}`)

    try {
      // Firecrawlクライアントを初期化 - APIキーをオブジェクトとして渡す
      const firecrawl = new FirecrawlApp({ apiKey: firecrawlApiKey })
      logs.push(`[${new Date().toISOString()}] Firecrawlクライアント初期化成功`)

      if (deepResearch) {
        // Deep Research APIを使用
        logs.push(`[${new Date().toISOString()}] Deep Research APIリクエスト準備`)

        const deepResearchOptions = {
          maxDepth,
          timeLimit,
          maxUrls,
        }

        logs.push(`[${new Date().toISOString()}] リクエストパラメータ: ${JSON.stringify(deepResearchOptions)}`)

        // Deep Research APIを呼び出し
        const response = await firecrawl.deepResearch(query, deepResearchOptions)

        logs.push(
          `[${new Date().toISOString()}] Deep Research APIレスポンス受信: ${JSON.stringify(response).substring(0, 200)}...`,
        )

        // ジョブIDを取得
        if (response && response.id) {
          jobId = response.id
          logs.push(`[${new Date().toISOString()}] Deep Research ジョブが開始されました。ジョブID: ${jobId}`)

          // 初期ステータスを取得
          try {
            const statusResponse = await firecrawl.getDeepResearchStatus(jobId)

            logs.push(
              `[${new Date().toISOString()}] 初期ステータス取得: ${JSON.stringify(statusResponse).substring(0, 200)}...`,
            )
            results = statusResponse
          } catch (statusError) {
            logs.push(
              `[${new Date().toISOString()}] 初期ステータス取得エラー: ${statusError instanceof Error ? statusError.message : "Unknown error"}`,
            )
            results = { status: "in_progress", currentDepth: 0, maxDepth }
          }
        } else {
          // 即時結果が返された場合またはレスポンスが期待通りでない場合
          results = response || { status: "unknown", error: "Unexpected response format" }
          logs.push(
            `[${new Date().toISOString()}] Deep Research レスポンス: ${JSON.stringify(results).substring(0, 200)}...`,
          )
        }
      } else {
        // 通常の検索APIを使用
        logs.push(`[${new Date().toISOString()}] 通常検索APIリクエスト準備`)

        const searchOptions = {
          limit: 10,
        }

        // 検索APIを呼び出し
        const response = await firecrawl.search(query, searchOptions)

        logs.push(
          `[${new Date().toISOString()}] 検索APIレスポンス受信: ${JSON.stringify(response).substring(0, 200)}...`,
        )

        // 検索結果を取得
        results = response && response.results ? response.results : []
      }

      const endTime = Date.now()
      const processingTime = endTime - startTime
      logs.push(`[${new Date().toISOString()}] 処理時間: ${processingTime}ms`)

      return new Response(
        JSON.stringify({
          results,
          logs,
          processingTimeMs: processingTime,
          engine: "firecrawl",
          deepResearch,
          jobId,
          rawResponse: deepResearch ? results : { results },
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
      if (deepResearch) {
        const mockResults = generateMockResults(query, deepResearch, { maxDepth, timeLimit, maxUrls })
        logs.push(`[${new Date().toISOString()}] APIエラーのためモックデータを返します`)
        results = mockResults
        jobId = "mock-job-id-" + Date.now()
      } else {
        const mockResults = generateMockSearchResults(query)
        logs.push(`[${new Date().toISOString()}] APIエラーのためモックデータを返します`)
        results = mockResults
      }

      return new Response(
        JSON.stringify({
          results: deepResearch ? results : results,
          logs,
          processingTimeMs: Date.now() - startTime,
          engine: "firecrawl",
          deepResearch,
          jobId: deepResearch ? jobId : null,
          rawResponse: deepResearch ? results : { results },
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
    console.error("Error searching with Firecrawl:", error)

    const endTime = Date.now()
    const processingTime = endTime - startTime

    // 一般的なエラーの場合もモックデータを返す
    const query = new URL(req.url).searchParams.get("q") || ""
    const deepResearch = new URL(req.url).searchParams.get("deepResearch") === "true"
    const maxDepth = Number.parseInt(new URL(req.url).searchParams.get("maxDepth") || "5", 10)
    const timeLimit = Number.parseInt(new URL(req.url).searchParams.get("timeLimit") || "180", 10)
    const maxUrls = Number.parseInt(new URL(req.url).searchParams.get("maxUrls") || "15", 10)

    const mockResults = deepResearch
      ? generateMockResults(query, true, { maxDepth, timeLimit, maxUrls })
      : generateMockSearchResults(query)

    logs.push(`[${new Date().toISOString()}] エラーのためモックデータを返します`)

    return new Response(
      JSON.stringify({
        results: mockResults,
        error: error instanceof Error ? error.message : "Unknown error",
        logs,
        processingTimeMs: processingTime,
        engine: "firecrawl",
        deepResearch,
        jobId: deepResearch ? "mock-job-id-" + Date.now() : null,
        rawResponse: deepResearch ? mockResults : { results: mockResults },
        isMockData: true,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}

// モックの検索結果を生成する関数（APIエラー時のフォールバック用）
function generateMockSearchResults(query: string) {
  return [
    {
      title: `${query} - 詳細情報とレビュー`,
      url: `https://example.com/products/${encodeURIComponent(query)}`,
      description: `${query}に関する詳細情報、仕様、ユーザーレビューを提供します。`,
      source: "Firecrawl Search",
      confidence: 0.92,
    },
    {
      title: `${query} 公式サイト`,
      url: `https://${query.toLowerCase().replace(/\s+/g, "")}.com`,
      description: `${query}の公式ウェブサイト。製品情報、サポート、購入オプションが提供されています。`,
      source: "Firecrawl Search",
      confidence: 0.95,
    },
    {
      title: `${query} vs 競合製品の比較`,
      url: `https://compare.tech/products/${encodeURIComponent(query)}`,
      description: `${query}と主要な競合製品との詳細な比較分析。`,
      source: "Firecrawl Search",
      confidence: 0.88,
    },
    {
      title: `${query} 技術仕様書`,
      url: `https://specs.tech/products/${encodeURIComponent(query)}`,
      description: `${query}の詳細な技術仕様と性能データ。`,
      source: "Firecrawl Search",
      confidence: 0.9,
    },
    {
      title: `${query} ユーザーマニュアル`,
      url: `https://manuals.tech/${encodeURIComponent(query)}`,
      description: `${query}の公式ユーザーマニュアルとガイド。`,
      source: "Firecrawl Search",
      confidence: 0.87,
    },
  ]
}

// モックのDeep Research結果を生成する関数（APIエラー時のフォールバック用）
function generateMockResults(
  query: string,
  deepResearch: boolean,
  params?: { maxDepth: number; timeLimit: number; maxUrls: number },
) {
  const baseResults = generateMockSearchResults(query)

  // Deep Research モードの場合、追加の詳細情報を含める
  if (deepResearch) {
    const maxDepth = params?.maxDepth || 5
    const timeLimit = params?.timeLimit || 180
    const maxUrls = params?.maxUrls || 15

    // 実際のアクティビティをシミュレート
    const activities = []
    const totalSteps = Math.min(maxDepth, 8) // 最大8ステップまで

    for (let i = 1; i <= totalSteps; i++) {
      const timestamp = new Date(Date.now() - (totalSteps - i) * 5000).toISOString()

      switch (i) {
        case 1:
          activities.push({
            step: i,
            action: "クエリ分析",
            details: `"${query}"の主要な調査領域を特定`,
            timestamp,
          })
          break
        case 2:
          activities.push({
            step: i,
            action: "初期検索実行",
            details: `${query}に関する基本的な情報を収集`,
            timestamp,
          })
          break
        case 3:
          activities.push({
            step: i,
            action: "関連ソース特定",
            details: `${query}に関する${maxUrls}の関連ソースを発見`,
            timestamp,
          })
          break
        case 4:
          activities.push({
            step: i,
            action: "ソース分析",
            details: "複数のソースから情報を抽出",
            timestamp,
          })
          break
        case 5:
          activities.push({
            step: i,
            action: "情報統合",
            details: "複数のソースからのデータを統合",
            timestamp,
          })
          break
        case 6:
          activities.push({
            step: i,
            action: "矛盾の解決",
            details: "異なるソース間の情報の矛盾を解決",
            timestamp,
          })
          break
        case 7:
          activities.push({
            step: i,
            action: "洞察生成",
            details: `${query}に関する主要な洞察を生成`,
            timestamp,
          })
          break
        case 8:
          activities.push({
            step: i,
            action: "最終分析作成",
            details: "包括的な分析レポートを作成",
            timestamp,
          })
          break
      }
    }

    // 追加のソースを生成
    const additionalSources = [
      {
        title: `${query}の市場動向分析`,
        url: `https://market-trends.com/analysis/${encodeURIComponent(query)}`,
        relevance: 0.89,
      },
      {
        title: `${query}に関する専門家の意見`,
        url: `https://expert-reviews.com/opinions/${encodeURIComponent(query)}`,
        relevance: 0.85,
      },
      {
        title: `${query}の歴史と進化`,
        url: `https://tech-history.org/evolution/${encodeURIComponent(query)}`,
        relevance: 0.78,
      },
      {
        title: `${query}の将来展望`,
        url: `https://future-tech.net/outlook/${encodeURIComponent(query)}`,
        relevance: 0.82,
      },
      {
        title: `${query}の産業への影響`,
        url: `https://industry-impact.com/analysis/${encodeURIComponent(query)}`,
        relevance: 0.81,
      },
    ]

    const sources = [
      ...baseResults.map((result) => ({
        title: result.title,
        url: result.url,
        relevance: result.confidence,
      })),
      ...additionalSources,
    ]

    return {
      webResults: baseResults,
      data: {
        activities: activities,
        sources: sources,
        finalAnalysis: `${query}は現代のテクノロジー市場において重要な位置を占めています。複数のソースから収集した情報によると、${query}は革新的な機能と高い性能を備えており、ユーザーからの評価も概ね良好です。一方で、いくつかの技術的制限や改善の余地も指摘されています。市場競争が激化する中、${query}は独自の強みを活かして差別化を図っています。`,
      },
      progressTracking: {
        completionPercentage: 100,
        researchDepth: `${maxDepth} iterations`,
        timeSpent: `${Math.min(timeLimit, 45 + Math.floor(Math.random() * 30))} seconds`,
      },
      status: "completed",
      currentDepth: maxDepth,
      maxDepth: maxDepth,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }
  }

  return baseResults
}
