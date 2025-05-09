export async function GET(req: Request) {
  const startTime = Date.now()
  const logs: string[] = []

  try {
    logs.push(`[${new Date().toISOString()}] 検索リクエスト受信`)

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

    logs.push(`[${new Date().toISOString()}] 検索クエリ: "${query}"`)

    // DuckDuckGo APIのエンドポイント
    // 注意: これは公式APIではなく、非公式のAPIエンドポイントです
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    logs.push(`[${new Date().toISOString()}] DuckDuckGo APIリクエスト: ${searchUrl}`)

    const response = await fetch(searchUrl)
    logs.push(`[${new Date().toISOString()}] DuckDuckGo APIレスポンスステータス: ${response.status}`)

    if (!response.ok) {
      logs.push(`[${new Date().toISOString()}] エラー: DuckDuckGo APIからのレスポンスエラー`)
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
        source: "Abstract",
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
            source: "Results",
          })
        }
      }
    }

    // Related Topicsから結果を追加（再帰的に処理）
    const processRelatedTopics = (topics, source = "RelatedTopics") => {
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

    // Infoboxから結果を追加（存在する場合）
    if (data.Infobox && data.Infobox.content) {
      logs.push(`[${new Date().toISOString()}] Infobox content数: ${data.Infobox.content.length}`)
      for (const item of data.Infobox.content) {
        if (item.value && item.value.includes("http")) {
          // URLを抽出する簡易的な方法
          const urlMatch = item.value.match(/(https?:\/\/[^\s"'<>]+)/g)
          if (urlMatch) {
            logs.push(`[${new Date().toISOString()}] Infobox URL追加: ${urlMatch[0]}`)
            results.push({
              title: item.label || "Infobox",
              url: urlMatch[0],
              description: item.value.replace(urlMatch[0], "").trim(),
              source: "Infobox",
            })
          }
        }
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

    // 最大10つの結果を返す（より多くの結果を取得するために増やしました）
    const limitedResults = uniqueResults.slice(0, 10)
    logs.push(`[${new Date().toISOString()}] 返却する検索結果数: ${limitedResults.length}`)

    // 結果が少ない場合のフォールバック: Serpapi風のURLを生成
    if (limitedResults.length < 5) {
      logs.push(`[${new Date().toISOString()}] 検索結果が少ないため、フォールバックURLを生成します`)

      // 一般的な検索エンジンドメイン
      const domains = [
        "en.wikipedia.org",
        "www.amazon.co.jp",
        "www.rakuten.co.jp",
        "kakaku.com",
        "www.yodobashi.com",
        "www.biccamera.com",
        "www.yamada-denki.jp",
        "www.cnn.co.jp",
        "news.yahoo.co.jp",
        "www.bbc.com",
      ]

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
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    logs.push(`[${new Date().toISOString()}] エラー発生: ${error instanceof Error ? error.message : "Unknown error"}`)
    console.error("Error searching with DuckDuckGo:", error)

    const endTime = Date.now()
    const processingTime = endTime - startTime

    return new Response(
      JSON.stringify({
        error: "Failed to search with DuckDuckGo",
        details: error instanceof Error ? error.message : "Unknown error",
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
