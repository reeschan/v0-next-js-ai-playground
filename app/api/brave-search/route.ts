export async function GET(req: Request) {
  const startTime = Date.now()
  const logs: string[] = []
  let query: string | null = null // Declare query here

  try {
    logs.push(`[${new Date().toISOString()}] Brave Search リクエスト受信`)

    const url = new URL(req.url)
    query = url.searchParams.get("q")

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
      logs.push(`[${new Date().toISOString()}] エラー: Brave Search APIキーが設定されていません`)
      return new Response(
        JSON.stringify({
          error: "Brave Search API key is not configured",
          logs,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    logs.push(`[${new Date().toISOString()}] 検索クエリ: "${query}"`)

    // Brave Search APIのエンドポイント - シンプルなクエリのみ
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`
    logs.push(`[${new Date().toISOString()}] Brave Search APIリクエスト: ${searchUrl}`)

    const response = await fetch(searchUrl, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": braveApiKey,
      },
    })

    logs.push(`[${new Date().toISOString()}] Brave Search APIレスポンスステータス: ${response.status}`)

    // レート制限エラーを特別に処理
    if (response.status === 429) {
      logs.push(`[${new Date().toISOString()}] エラー: Brave Search APIのレート制限に達しました`)

      // DuckDuckGoにフォールバック
      logs.push(`[${new Date().toISOString()}] DuckDuckGoにフォールバックします`)

      // DuckDuckGoの検索結果を取得
      return await fallbackToDuckDuckGo(query, logs, startTime)
    }

    // その他のエラーレスポンスの詳細を取得
    if (!response.ok) {
      const errorText = await response.text()
      logs.push(`[${new Date().toISOString()}] エラー: Brave Search APIからのレスポンスエラー: ${errorText}`)

      // DuckDuckGoにフォールバック
      logs.push(`[${new Date().toISOString()}] DuckDuckGoにフォールバックします`)

      return await fallbackToDuckDuckGo(query, logs, startTime)
    }

    const data = await response.json()
    logs.push(`[${new Date().toISOString()}] Brave Search APIレスポンスデータ受信`)

    // 検索結果からURLを抽出
    const results = []

    if (data.web && data.web.results && Array.isArray(data.web.results)) {
      logs.push(`[${new Date().toISOString()}] Web検索結果数: ${data.web.results.length}`)

      for (const result of data.web.results) {
        if (result.url) {
          logs.push(`[${new Date().toISOString()}] Web検索結果URL追加: ${result.url}`)
          results.push({
            title: result.title || "No Title",
            url: result.url,
            description: result.description || "",
            source: "Brave Web",
            // faviconなどのオプションフィールドは存在する場合のみ追加
            ...(result.favicon && { favicon: result.favicon }),
            ...(result.age && { age: result.age }),
            ...(result.is_family_friendly !== undefined && { isFamily: result.is_family_friendly }),
          })
        }
      }
    }

    // ニュース結果からも取得（存在する場合のみ）
    if (data.news && data.news.results && Array.isArray(data.news.results)) {
      logs.push(`[${new Date().toISOString()}] ニュース結果数: ${data.news.results.length}`)

      for (const result of data.news.results) {
        if (result.url) {
          logs.push(`[${new Date().toISOString()}] ニュース結果URL追加: ${result.url}`)
          results.push({
            title: result.title || "No Title",
            url: result.url,
            description: result.description || "",
            source: "Brave News",
            ...(result.published_time && { publishedTime: result.published_time }),
            ...(result.publisher?.name && { publisher: result.publisher.name }),
          })
        }
      }
    }

    // 結果がない場合のフォールバック
    if (results.length === 0) {
      logs.push(`[${new Date().toISOString()}] 検索結果が0件のため、フォールバックURLを生成します`)

      // DuckDuckGoと同様のフォールバックを実装
      const domains = ["en.wikipedia.org", "www.amazon.co.jp", "www.rakuten.co.jp", "kakaku.com", "www.yodobashi.com"]

      for (let i = 0; i < 5; i++) {
        const domain = domains[Math.floor(Math.random() * domains.length)]
        const fallbackUrl = `https://${domain}/search?q=${encodeURIComponent(query)}`

        results.push({
          title: `${query} - ${domain}`,
          url: fallbackUrl,
          description: `${query}に関する${domain}の検索結果`,
          source: "Fallback",
        })
      }
    }

    // 重複を除去
    const uniqueResults = []
    const seenUrls = new Set()

    for (const result of results) {
      if (!seenUrls.has(result.url)) {
        seenUrls.add(result.url)
        uniqueResults.push(result)
      }
    }

    logs.push(`[${new Date().toISOString()}] 重複除去後の結果数: ${uniqueResults.length}`)

    // 最大10つの結果を返す
    const limitedResults = uniqueResults.slice(0, 10)
    logs.push(`[${new Date().toISOString()}] 返却する検索結果数: ${limitedResults.length}`)

    const endTime = Date.now()
    const processingTime = endTime - startTime
    logs.push(`[${new Date().toISOString()}] 処理時間: ${processingTime}ms`)

    return new Response(
      JSON.stringify({
        results: limitedResults,
        logs,
        processingTimeMs: processingTime,
        engine: "brave", // 使用した検索エンジンを明示
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    logs.push(`[${new Date().toISOString()}] エラー発生: ${error instanceof Error ? error.message : "Unknown error"}`)
    console.error("Error searching with Brave Search:", error)

    // エラー発生時もDuckDuckGoにフォールバック
    logs.push(`[${new Date().toISOString()}] DuckDuckGoにフォールバックします`)

    try {
      return await fallbackToDuckDuckGo(query, logs, startTime)
    } catch (fallbackError) {
      const endTime = Date.now()
      const processingTime = endTime - startTime

      return new Response(
        JSON.stringify({
          error: "Failed to search with both Brave Search and DuckDuckGo",
          details: error instanceof Error ? error.message : "Unknown error",
          fallbackError: fallbackError instanceof Error ? fallbackError.message : "Unknown fallback error",
          logs,
          processingTimeMs: processingTime,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  }
}

// DuckDuckGoにフォールバックする関数
async function fallbackToDuckDuckGo(query: string, logs: string[], startTime: number) {
  logs.push(`[${new Date().toISOString()}] DuckDuckGo検索を実行: "${query}"`)

  // DuckDuckGo APIのエンドポイント
  const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
  logs.push(`[${new Date().toISOString()}] DuckDuckGo APIリクエスト: ${searchUrl}`)

  const response = await fetch(searchUrl)
  logs.push(`[${new Date().toISOString()}] DuckDuckGo APIレスポンスステータス: ${response.status}`)

  if (!response.ok) {
    throw new Error(`DuckDuckGo API responded with status: ${response.status}`)
  }

  const data = await response.json()
  logs.push(`[${new Date().toISOString()}] DuckDuckGo APIレスポンスデータ受信`)

  // 検索結果からURLを抽出
  const results = []

  // Abstractから結果を追加（存在する場合）
  if (data.AbstractURL && data.AbstractURL.trim() !== "") {
    logs.push(`[${new Date().toISOString()}] Abstract URL追加: ${data.AbstractURL}`)
    results.push({
      title: data.Heading || "Abstract",
      url: data.AbstractURL,
      description: data.Abstract || "",
      source: "DuckDuckGo Abstract",
    })
  }

  // Resultsから結果を追加（存在する場合）
  if (data.Results && Array.isArray(data.Results)) {
    logs.push(`[${new Date().toISOString()}] Results数: ${data.Results.length}`)
    for (const result of data.Results) {
      if (result.FirstURL || result.URL) {
        const url = result.FirstURL || result.URL
        logs.push(`[${new Date().toISOString()}] Result URL追加: ${url}`)
        results.push({
          title: result.Text || result.Name || "Result",
          url: url,
          description: result.Description || "",
          source: "DuckDuckGo Results",
        })
      }
    }
  }

  // Related Topicsから結果を追加（再帰的に処理）
  const processRelatedTopics = (topics, source = "DuckDuckGo RelatedTopics") => {
    if (!topics || !Array.isArray(topics)) return

    logs.push(`[${new Date().toISOString()}] ${source}数: ${topics.length}`)

    for (const topic of topics) {
      // トピックにTopicsプロパティがある場合（ネストされたトピック）
      if (topic.Topics && Array.isArray(topic.Topics)) {
        logs.push(`[${new Date().toISOString()}] ネストされたトピック発見: ${topic.Name || "unnamed"}`)
        processRelatedTopics(topic.Topics, `${source} > ${topic.Name || "unnamed"}`)
      }
      // 通常のトピック
      else if (topic.FirstURL && topic.Text) {
        logs.push(`[${new Date().toISOString()}] ${source} URL追加: ${topic.FirstURL}`)
        results.push({
          title: topic.Text.split(" - ")[0] || topic.Text,
          url: topic.FirstURL,
          description: topic.Text.split(" - ")[1] || "",
          source: source,
        })
      }
    }
  }

  // RelatedTopicsを処理
  processRelatedTopics(data.RelatedTopics)

  // 重複を除去
  const uniqueResults = []
  const seenUrls = new Set()

  for (const result of results) {
    if (!seenUrls.has(result.url)) {
      seenUrls.add(result.url)
      uniqueResults.push(result)
    }
  }

  logs.push(`[${new Date().toISOString()}] 重複除去後の結果数: ${uniqueResults.length}`)

  // 最大10つの結果を返す
  const limitedResults = uniqueResults.slice(0, 10)
  logs.push(`[${new Date().toISOString()}] 返却する検索結果数: ${limitedResults.length}`)

  // 結果が少ない場合のフォールバック
  if (limitedResults.length < 5) {
    logs.push(`[${new Date().toISOString()}] 検索結果が少ないため、フォールバックURLを生成します`)

    // 一般的な検索エンジンドメイン
    const domains = ["en.wikipedia.org", "www.amazon.co.jp", "www.rakuten.co.jp", "kakaku.com", "www.yodobashi.com"]

    // 足りない分だけフォールバックURLを生成
    const neededCount = 5 - limitedResults.length
    for (let i = 0; i < neededCount; i++) {
      const domain = domains[Math.floor(Math.random() * domains.length)]
      const fallbackUrl = `https://${domain}/search?q=${encodeURIComponent(query)}`
      logs.push(`[${new Date().toISOString()}] フォールバックURL生成: ${fallbackUrl}`)

      limitedResults.push({
        title: `${query} - ${domain}`,
        url: fallbackUrl,
        description: `${query}に関する${domain}の検索結果`,
        source: "Fallback",
      })
    }
  }

  const endTime = Date.now()
  const processingTime = endTime - startTime
  logs.push(`[${new Date().toISOString()}] 処理時間: ${processingTime}ms`)

  return new Response(
    JSON.stringify({
      results: limitedResults,
      logs,
      processingTimeMs: processingTime,
      engine: "duckduckgo", // フォールバックした検索エンジンを明示
      fallbackReason: "Brave Search API rate limit exceeded", // フォールバックの理由
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  )
}
