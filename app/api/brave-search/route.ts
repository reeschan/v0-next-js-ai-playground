export async function GET(req: Request) {
  const startTime = Date.now()
  const logs: string[] = []

  try {
    logs.push(`[${new Date().toISOString()}] Brave Search リクエスト受信`)

    const url = new URL(req.url)
    const query = url.searchParams.get("q")

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

    // Brave Search APIキーを環境変数から取得
    const braveApiKey = process.env.BRAVE_SEARCH_API_KEY

    if (!braveApiKey) {
      logs.push(
        `[${new Date().toISOString()}] 警告: Brave Search APIキーが設定されていません。モックデータを返します。`,
      )
      console.warn("Brave Search API key is not configured. Returning mock data.")

      // モックデータを返す
      const mockResults = generateMockResults(query)

      const endTime = Date.now()
      const processingTime = endTime - startTime

      return new Response(
        JSON.stringify({
          results: mockResults,
          logs,
          processingTimeMs: processingTime,
          engine: "brave",
          isMockData: true,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    logs.push(`[${new Date().toISOString()}] 検索クエリ: "${query}"`)

    // Brave Search APIのエンドポイント
    const apiUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`
    logs.push(`[${new Date().toISOString()}] Brave Search APIリクエスト: ${apiUrl}`)

    try {
      // APIリクエスト
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "X-Subscription-Token": braveApiKey,
        },
      })

      logs.push(`[${new Date().toISOString()}] Brave Search APIレスポンスステータス: ${response.status}`)

      // レスポンスが成功したかどうかをチェック
      if (!response.ok) {
        // エラーレスポンスのテキストを取得
        const errorText = await response.text()
        logs.push(`[${new Date().toISOString()}] APIエラーレスポンス: ${errorText}`)

        if (response.status === 401) {
          logs.push(`[${new Date().toISOString()}] 認証エラー: APIキーが無効または期限切れです。`)
          console.error("Authentication error with Brave Search API. API key may be invalid or expired.")

          // 認証エラーの場合はモックデータを返す
          const mockResults = generateMockResults(query)

          const endTime = Date.now()
          const processingTime = endTime - startTime

          return new Response(
            JSON.stringify({
              results: mockResults,
              logs,
              processingTimeMs: processingTime,
              engine: "brave",
              isMockData: true,
              authError: true,
            }),
            {
              headers: { "Content-Type": "application/json" },
            },
          )
        }

        throw new Error(`Brave Search API error: ${response.status} - ${errorText}`)
      }

      // レスポンスがJSONかどうかを確認
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        logs.push(`[${new Date().toISOString()}] 予期しないコンテンツタイプ: ${contentType}`)
        throw new Error(`Unexpected response content type: ${contentType}`)
      }

      const data = await response.json()
      logs.push(`[${new Date().toISOString()}] Brave Search APIレスポンスデータ受信`)

      // Web検索結果を取得
      const webResults = data.web?.results || []
      logs.push(`[${new Date().toISOString()}] ${webResults.length}件の検索結果を取得`)

      // 検索結果を標準形式に変換
      const results = webResults.map((item: any) => ({
        title: item.title,
        url: item.url,
        description: item.description,
        source: "Brave Search",
        // 信頼度はAPIに含まれていないため0.9を設定
        confidence: 0.9,
      }))

      const endTime = Date.now()
      const processingTime = endTime - startTime
      logs.push(`[${new Date().toISOString()}] 処理時間: ${processingTime}ms`)

      return new Response(
        JSON.stringify({
          results,
          logs,
          processingTimeMs: processingTime,
          engine: "brave",
          rawResponse: data,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    } catch (apiError) {
      logs.push(
        `[${new Date().toISOString()}] API呼び出しエラー: ${apiError instanceof Error ? apiError.message : "Unknown error"}`,
      )
      console.error("Brave Search API Call Error:", apiError)

      // エラーの場合はモックデータを返す
      const mockResults = generateMockResults(query)
      logs.push(`[${new Date().toISOString()}] APIエラーのためモックデータを返します`)

      const endTime = Date.now()
      const processingTime = endTime - startTime

      return new Response(
        JSON.stringify({
          results: mockResults,
          logs,
          processingTimeMs: processingTime,
          engine: "brave",
          isMockData: true,
          error: apiError instanceof Error ? apiError.message : "Unknown API error",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  } catch (error) {
    logs.push(`[${new Date().toISOString()}] エラー発生: ${error instanceof Error ? error.message : "Unknown error"}`)
    console.error("Error searching with Brave:", error)

    // エラーが発生した場合はモックデータを返す
    const query = new URL(req.url).searchParams.get("q") || ""
    const mockResults = generateMockResults(query)

    const endTime = Date.now()
    const processingTime = endTime - startTime

    return new Response(
      JSON.stringify({
        results: mockResults,
        error: error instanceof Error ? error.message : "Unknown error",
        logs,
        processingTimeMs: processingTime,
        engine: "brave",
        isMockData: true,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}

// モックの検索結果を生成する関数（APIエラー時のフォールバック用）
function generateMockResults(query: string) {
  return [
    {
      title: `${query} - 公式サイト | 最新情報`,
      url: `https://www.${query.toLowerCase().replace(/\s+/g, "")}.com`,
      description: `${query}の公式サイトです。最新の製品情報、サポート、お問い合わせ方法などをご覧いただけます。`,
      source: "Brave Search",
      confidence: 0.95,
    },
    {
      title: `${query}とは？特徴と使い方の完全ガイド`,
      url: `https://guide.example.com/${encodeURIComponent(query)}`,
      description: `${query}の基本から応用まで解説。初心者でもわかりやすく解説しています。`,
      source: "Brave Search",
      confidence: 0.92,
    },
    {
      title: `${query} レビュー - プロが教える選び方`,
      url: `https://reviews.example.com/products/${encodeURIComponent(query)}`,
      description: `専門家による${query}の詳細レビュー。メリット・デメリットを徹底解説します。`,
      source: "Brave Search",
      confidence: 0.89,
    },
    {
      title: `【比較】${query} vs 競合製品 - どちらがおすすめ？`,
      url: `https://compare.example.com/${encodeURIComponent(query)}-comparison`,
      description: `${query}と主要な競合製品を様々な角度から比較。あなたに最適な選択肢を見つけましょう。`,
      source: "Brave Search",
      confidence: 0.87,
    },
    {
      title: `${query}の価格.com - 最安値・価格比較`,
      url: `https://kakaku.example.com/items/${encodeURIComponent(query)}`,
      description: `${query}の最新価格情報。各販売店の価格を比較して、最安値で購入できる店舗を探せます。`,
      source: "Brave Search",
      confidence: 0.91,
    },
    {
      title: `${query} - Wikipedia`,
      url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(query)}`,
      description: `${query}に関する基本情報、歴史、主な特徴などについてのWikipediaの記事。`,
      source: "Brave Search",
      confidence: 0.94,
    },
    {
      title: `${query}のトラブルシューティング - よくある問題と解決方法`,
      url: `https://support.example.com/troubleshooting/${encodeURIComponent(query)}`,
      description: `${query}使用中によく発生する問題と、その対処法を解説しています。`,
      source: "Brave Search",
      confidence: 0.85,
    },
    {
      title: `${query}の最新アップデート情報 - 新機能まとめ`,
      url: `https://updates.example.com/${encodeURIComponent(query)}`,
      description: `${query}の最新アップデート情報。追加された新機能や改善点を詳しく解説しています。`,
      source: "Brave Search",
      confidence: 0.88,
    },
    {
      title: `初心者でもわかる！${query}の始め方ガイド`,
      url: `https://beginners.example.com/start-with-${encodeURIComponent(query)}`,
      description: `${query}を初めて使う方向けの解説。セットアップから基本的な使い方までステップバイステップで説明します。`,
      source: "Brave Search",
      confidence: 0.9,
    },
    {
      title: `${query}のプロも使うテクニック - 上級者向けTips`,
      url: `https://pro-tips.example.com/${encodeURIComponent(query)}-advanced`,
      description: `${query}をより効率的に使いこなすためのプロフェッショナルテクニック集。上級者向けの裏技も紹介。`,
      source: "Brave Search",
      confidence: 0.86,
    },
  ]
}
