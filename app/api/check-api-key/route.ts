export async function GET() {
  try {
    // Check if the OpenAI API key is set
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          configured: false,
          message: "OpenAI API key is not configured",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // Check if the API key has the correct format (starts with "sk-")
    if (!apiKey.startsWith("sk-")) {
      return new Response(
        JSON.stringify({
          configured: false,
          message: "OpenAI API key has incorrect format. It should start with 'sk-'",
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
        message: "OpenAI API key is properly configured",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
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
