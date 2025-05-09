"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface SearchEngineSelectorProps {
  onEngineChange: (engine: string) => void
  defaultEngine?: string
}

export function SearchEngineSelector({ onEngineChange, defaultEngine = "duckduckgo" }: SearchEngineSelectorProps) {
  const [selectedEngine, setSelectedEngine] = useState(defaultEngine)
  const [braveApiKeyStatus, setBraveApiKeyStatus] = useState<{
    configured: boolean
    message: string
    rateLimited?: boolean
  } | null>(null)
  const [isCheckingBraveApiKey, setIsCheckingBraveApiKey] = useState(true)

  useEffect(() => {
    const checkBraveApiKey = async () => {
      try {
        const response = await fetch("/api/check-brave-api-key")
        const data = await response.json()
        setBraveApiKeyStatus(data)

        // レート制限に達している場合は自動的にDuckDuckGoに切り替え
        if (data.rateLimited && selectedEngine === "brave") {
          setSelectedEngine("duckduckgo")
          onEngineChange("duckduckgo")
          localStorage.setItem("preferredSearchEngine", "duckduckgo")
        }
      } catch (error) {
        console.error("Error checking Brave API key:", error)
        setBraveApiKeyStatus({
          configured: false,
          message: "Error checking Brave Search API key configuration",
        })
      } finally {
        setIsCheckingBraveApiKey(false)
      }
    }

    checkBraveApiKey()
  }, [onEngineChange, selectedEngine])

  // useEffectを追加して、ローカルストレージから検索エンジン設定を読み込む
  useEffect(() => {
    // ローカルストレージから検索エンジン設定を読み込む
    const savedEngine = localStorage.getItem("preferredSearchEngine")
    if (savedEngine) {
      setSelectedEngine(savedEngine)
      onEngineChange(savedEngine)
    }
  }, [onEngineChange])

  // handleEngineChangeを更新して、選択をローカルストレージに保存
  const handleEngineChange = (value: string) => {
    // レート制限に達している場合はBrave Searchを選択できないようにする
    if (value === "brave" && braveApiKeyStatus?.rateLimited) {
      return
    }

    setSelectedEngine(value)
    onEngineChange(value)
    // ローカルストレージに保存
    localStorage.setItem("preferredSearchEngine", value)
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue={selectedEngine} onValueChange={handleEngineChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="duckduckgo">DuckDuckGo</TabsTrigger>
          <TabsTrigger value="brave" disabled={!braveApiKeyStatus?.configured || braveApiKeyStatus?.rateLimited}>
            Brave Search
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {selectedEngine === "brave" && !braveApiKeyStatus?.configured && !isCheckingBraveApiKey && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>API Key Not Configured</AlertTitle>
          <AlertDescription>
            {braveApiKeyStatus?.message ||
              "Brave Search API key is not configured. Please add your API key to the environment variables as BRAVE_SEARCH_API_KEY."}
          </AlertDescription>
        </Alert>
      )}

      {braveApiKeyStatus?.rateLimited && (
        <Alert variant="warning" className="bg-yellow-50 border-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Brave Search API Rate Limited</AlertTitle>
          <AlertDescription className="text-yellow-700">{braveApiKeyStatus.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
