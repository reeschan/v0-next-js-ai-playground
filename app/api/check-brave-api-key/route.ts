export async function GET() {
  try {
    // Check if the Brave Search API key is set
    const apiKey = process.env.BRAVE_SEARCH_API_KEY

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          configured: false,
          message: "Brave Search API key is not configured",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // APIキーが設定されているだけでなく、実際に動作するか確認
    try {
      const testUrl = "https://api.search.brave.com/res/v1/web/search?q=test"
      const response = await fetch(testUrl, {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
        },
      })

      // レート制限エラーの場合
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            configured: true,
            message:
              "Brave Search API key is valid but rate limit has been reached. The app will fallback to DuckDuckGo until the rate limit resets.",
            rateLimited: true,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      if (!response.ok) {
        return new Response(
          JSON.stringify({
            configured: false,
            message: `Brave Search API key is invalid or has issues: ${response.status} ${response.statusText}`,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      // 正常にレスポンスを受け取れた場合
      return new Response(
        JSON.stringify({
          configured: true,
          message: "Brave Search API key is properly configured and working",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )
    } catch (error) {
      return new Response(
        JSON.stringify({
          configured: false,
          message: `Error testing Brave Search API key: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  } catch (error) {
    console.error("Error checking API key:", error)
    return new Response(
      JSON.stringify({
        configured: false,
        message: "Error checking API key configuration",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
