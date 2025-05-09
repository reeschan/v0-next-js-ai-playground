"use client"

import { useState, useEffect } from "react"
import { Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface ApiKeyStatusProps {
  apiName: string
  checkEndpoint: string
}

export function ApiKeyStatus({ apiName, checkEndpoint }: ApiKeyStatusProps) {
  const [status, setStatus] = useState<{
    configured: boolean
    message: string
  } | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const response = await fetch(checkEndpoint)
        const data = await response.json()
        setStatus(data)
      } catch (error) {
        console.error(`Error checking ${apiName} API key:`, error)
        setStatus({
          configured: false,
          message: `Error checking ${apiName} API key configuration`,
        })
      } finally {
        setIsChecking(false)
      }
    }

    checkApiKey()
  }, [apiName, checkEndpoint])

  if (isChecking) {
    return (
      <div className="flex items-center space-x-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{apiName} APIキーを確認中...</span>
      </div>
    )
  }

  if (!status) {
    return null
  }

  if (status.configured) {
    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">{apiName} APIキー設定済み</AlertTitle>
        <AlertDescription className="text-green-700">{status.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{apiName} APIキー未設定</AlertTitle>
      <AlertDescription>{status.message}</AlertDescription>
    </Alert>
  )
}
