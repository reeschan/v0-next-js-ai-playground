export async function GET() {
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY

  return new Response(
    JSON.stringify({
      openai: hasOpenAIKey,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  )
}
