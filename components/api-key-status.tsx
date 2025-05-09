"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

interface ApiKeyStatusProps {
  apiName: string
  checkEndpoint: string
}

export function ApiKeyStatus({ apiName, checkEndpoint }: ApiKeyStatusProps) {
  const [status, setStatus] = useState<{
    configured: boolean
    message: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(checkEndpoint)

        // レスポンスがJSONかどうかを確認
        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error(`予期しないレスポンス形式: ${contentType}`)
        }

        const data = await response.json()
        setStatus(data)
      } catch (error) {
        console.error(`Error checking ${apiName} API key:`, error)
        setError(error instanceof Error ? error.message : "Unknown error")
        setStatus({
          configured: false,
          message: `APIキーの確認中にエラーが発生しました`,
        })
      } finally {
        setIsLoading(false)
      }
    }

    checkApiKey()
  }, [apiName, checkEndpoint])

  return (
    <Card className={`border ${status?.configured ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
      <CardContent className="p-3 flex items-center">
        {isLoading ? (
          <Loader2 className="h-5 w-5 text-gray-400 animate-spin mr-2" />
        ) : status?.configured ? (
          <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600 mr-2" />
        )}
        <div>
          <div className="text-sm font-medium">{apiName} API</div>
          <div className="text-xs text-gray-600">
            {error ? `エラー: ${error}` : status?.message || "APIキーの状態を確認中..."}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
