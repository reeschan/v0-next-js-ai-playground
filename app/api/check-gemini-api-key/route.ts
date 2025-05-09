export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          configured: false,
          message: "Gemini APIキーが設定されていません",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    return new Response(
      JSON.stringify({
        configured: true,
        message: "Gemini APIキーが設定されています",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    console.error("Error checking Gemini API key:", error)
    return new Response(
      JSON.stringify({
        configured: false,
        message: "APIキーの確認中にエラーが発生しました",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
