"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, AlertCircle, Search, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchResults } from "@/components/search-results"
import { SearchLogs } from "@/components/search-logs"
import { ApiKeyStatus } from "@/components/api-key-status"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
// 以下のインポートを追加
import type { DeepResearchParams } from "@/components/search-engine-selector"
import { DeepResearchProgress } from "@/components/deep-research-progress"
import { DeepResearchResults } from "@/components/deep-research-results"
import { ChevronUp, ChevronDown } from "lucide-react"

export default function Home() {
  const [activeTab, setActiveTab] = useState("openai")
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<{
    configured: boolean
    message: string
  } | null>(null)
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true)
  const [referenceUrlCount, setReferenceUrlCount] = useState(3) // デフォルトは3つのURL
  const [error, setError] = useState<string | null>(null)
  const [formattedOutput, setFormattedOutput] = useState<any>(null)
  const [usageInfo, setUsageInfo] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchLogs, setSearchLogs] = useState<string[]>([])
  const [searchProcessingTime, setSearchProcessingTime] = useState<number>(0)
  // 検索エンジン選択用の状態を追加
  const [searchEngine, setSearchEngine] = useState("duckduckgo")
  // 実際に使用された検索エンジンを追跡
  const [actualSearchEngine, setActualSearchEngine] = useState<string | null>(null)
  // フォールバックの理由を追跡
  const [fallbackReason, setFallbackReason] = useState<string | null>(null)
  // 処理時間の追跡用の状態変数
  const [aiProcessingTime, setAiProcessingTime] = useState<number>(0)
  const [totalProcessingTime, setTotalProcessingTime] = useState<number>(0)
  // 生のレスポンスデータを保存する状態変数を追加
  const [rawResponse, setRawResponse] = useState<any>(null)
  // useState部分に以下の状態変数を追加（既存のuseState宣言の近くに追加）
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false)
  const [deepResearchParams, setDeepResearchParams] = useState<DeepResearchParams>({
    maxDepth: 5,
    timeLimit: 180,
    maxUrls: 15,
  })
  const [deepResearchJobId, setDeepResearchJobId] = useState<string | null>(null)
  const [deepResearchResult, setDeepResearchResult] = useState<any>(null)
  const [deepResearchStartTime, setDeepResearchStartTime] = useState<number>(0)
  const [deepResearchCompleted, setDeepResearchCompleted] = useState(false)
  const [deepResearchElapsedTime, setDeepResearchElapsedTime] = useState(0)
  // Firecrawl APIキーの状態を追加
  const [firecrawlApiKeyStatus, setFirecrawlApiKeyStatus] = useState<{
    configured: boolean
    message: string
  } | null>(null)
  // Deep Research設定パネルの状態
  const [isDeepResearchSettingsOpen, setIsDeepResearchSettingsOpen] = useState(false)

  // Check API key status on component mount
  useEffect(() => {
    const checkApiKeys = async () => {
      try {
        // OpenAI APIキーの確認
        const openaiResponse = await fetch("/api/check-api-key")
        const openaiData = await openaiResponse.json()
        setApiKeyStatus(openaiData)

        // Brave Search APIキーの確認
        const braveResponse = await fetch("/api/check-brave-api-key")
        const braveData = await braveResponse.json()

        // Firecrawl APIキーの確認
        const firecrawlResponse = await fetch("/api/check-firecrawl-api-key")
        const firecrawlData = await firecrawlResponse.json()
        setFirecrawlApiKeyStatus(firecrawlData)
      } catch (error) {
        console.error("Error checking API keys:", error)
        setApiKeyStatus({
          configured: false,
          message: "APIキーの確認中にエラーが発生しました",
        })
      } finally {
        setIsCheckingApiKey(false)
      }
    }

    checkApiKeys()
  }, [])

  // Parse and format the output when it changes
  useEffect(() => {
    if (output) {
      try {
        const parsed = JSON.parse(output)
        setFormattedOutput(parsed)

        // 使用量情報を抽出
        if (parsed._usage) {
          setUsageInfo(parsed._usage)
        } else {
          setUsageInfo(null)
        }
      } catch (e) {
        console.error("Error parsing output:", e)
        setFormattedOutput(null)
        setUsageInfo(null)
      }
    } else {
      setFormattedOutput(null)
      setUsageInfo(null)
    }
  }, [output])

  // Deep Researchパラメータを更新する関数
  const updateDeepResearchParam = (key: keyof DeepResearchParams, value: number) => {
    setDeepResearchParams((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  // handleSearch関数を以下のコードに置き換え
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchResults([])
    setSearchLogs([])
    setSearchProcessingTime(0)
    setError(null)
    setActualSearchEngine(null)
    setFallbackReason(null)
    setRawResponse(null)
    setDeepResearchJobId(null)
    setDeepResearchResult(null)
    setDeepResearchCompleted(false)
    setDeepResearchElapsedTime(0)

    try {
      // 選択された検索エンジンに基づいてAPIエンドポイントを決定
      let apiEndpoint = "/api/search"
      if (searchEngine === "brave") {
        apiEndpoint = "/api/brave-search"
      } else if (searchEngine === "firecrawl") {
        apiEndpoint = "/api/firecrawl-search"
      }

      // クエリパラメータを構築
      const queryParams = new URLSearchParams({
        q: searchQuery,
      })

      // Firecrawlの場合、Deep Research関連のパラメータを追加
      if (searchEngine === "firecrawl" && deepResearchEnabled) {
        queryParams.append("deepResearch", "true")
        queryParams.append("maxDepth", deepResearchParams.maxDepth.toString())
        queryParams.append("timeLimit", deepResearchParams.timeLimit.toString())
        queryParams.append("maxUrls", deepResearchParams.maxUrls.toString())

        // Deep Researchの開始時間を記録
        setDeepResearchStartTime(Date.now())
      }

      console.log(`検索リクエスト: ${apiEndpoint}?${queryParams.toString()}`)
      const response = await fetch(`${apiEndpoint}?${queryParams.toString()}`)

      // レスポンスが成功したかどうかをチェック
      if (!response.ok) {
        let errorMessage = `検索エンジンからのエラーレスポンス: ${response.status} ${response.statusText}`
        try {
          // エラーレスポンスのテキストを取得
          const errorText = await response.text()
          console.error("Error response text:", errorText)

          // JSONとして解析できるか試みる
          try {
            const errorJson = JSON.parse(errorText)
            if (errorJson.error) {
              errorMessage = errorJson.error
            }
          } catch (jsonError) {
            // JSONとして解析できない場合はテキストをそのまま使用
            errorMessage = `${errorMessage} - ${errorText}`
          }
        } catch (textError) {
          console.error("Error getting response text:", textError)
        }

        setError(errorMessage)
        setIsSearching(false)
        return
      }

      // レスポンスがJSONかどうかを確認
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        setError(`予期しないレスポンス形式: ${contentType}`)
        setIsSearching(false)
        return
      }

      const data = await response.json()
      console.log("検索レスポンス:", data)

      if (data.error) {
        setError(data.error)
        setIsSearching(false)
      } else if (data.authError) {
        // 認証エラーの場合は特別なメッセージを表示
        const engine = searchEngine === "firecrawl" ? "Firecrawl" : searchEngine === "brave" ? "Brave Search" : "検索"
        setError(`${engine} APIの認証に失敗しました。APIキーを確認してください。モックデータを表示しています。`)

        // モックデータを表示
        if (data.results) {
          setSearchResults(Array.isArray(data.results) ? data.results : [])
        }

        if (data.isMockData) {
          setActualSearchEngine(`${searchEngine} (モック)`)
        } else {
          setActualSearchEngine(searchEngine)
        }

        setIsSearching(false)
      } else if (data.isMockData) {
        // モックデータの場合も通知
        if (data.results) {
          setSearchResults(Array.isArray(data.results) ? data.results : [])
        }

        setActualSearchEngine(`${searchEngine} (モック)`)
        setIsSearching(false)

        if (!error) {
          const engine = searchEngine === "firecrawl" ? "Firecrawl" : searchEngine === "brave" ? "Brave Search" : "検索"
          setError(`${engine} APIへのアクセスに問題があるため、モックデータを表示しています。`)
        }
      } else {
        // 生のレスポンスデータを保存（あれば）
        if (data.rawResponse) {
          setRawResponse(data.rawResponse)
        }

        // Firecrawlの場合、Deep Researchジョブの処理
        if (searchEngine === "firecrawl" && deepResearchEnabled && data.jobId) {
          setDeepResearchJobId(data.jobId)
          console.log(`Deep Research ジョブID: ${data.jobId}`)

          // 初期結果があれば設定
          if (data.results) {
            setDeepResearchResult(data.results)
          }
        } else {
          // 通常の検索結果を設定
          setSearchResults(Array.isArray(data.results) ? data.results : [])
          setIsSearching(false)
        }

        // 実際に使用された検索エンジンを追跡
        if (data.engine) {
          setActualSearchEngine(data.engine)
        }

        // フォールバックの理由を追跡
        if (data.fallbackReason) {
          setFallbackReason(data.fallbackReason)
        }
      }

      // ログと処理時間を保存
      if (data.logs) {
        setSearchLogs(data.logs)
      }
      if (data.processingTimeMs) {
        setSearchProcessingTime(data.processingTimeMs)

        // 合計処理時間を更新（AI処理時間がある場合は加算）
        const totalTime = data.processingTimeMs + (aiProcessingTime > 0 ? aiProcessingTime : 0)
        setTotalProcessingTime(totalTime)
      }
    } catch (error) {
      console.error("Error searching:", error)
      setError(`検索中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`)
      setIsSearching(false)
    }
  }

  // Deep Research完了時のハンドラを追加
  const handleDeepResearchComplete = (result: any, elapsedTime: number) => {
    console.log("Deep Research完了:", result)
    setDeepResearchResult(result)
    setDeepResearchCompleted(true)
    setDeepResearchElapsedTime(elapsedTime)
    setIsSearching(false)

    // モックデータの場合は通知
    if (result.isMockData) {
      console.log("モックデータを表示しています")
      if (!error) {
        setError("Firecrawl APIキーが設定されていないか、認証に失敗したため、モックデータを表示しています。")
      }
    }
  }

  // Deep Researchエラー時のハンドラを追加
  const handleDeepResearchError = (error: string) => {
    console.error("Deep Researchエラー:", error)
    setError(`Deep Research処理中にエラーが発生しました: ${error}`)
    setIsSearching(false)
  }

  const useUrlsForAnalysis = (urls: string[]) => {
    // URLを改行で区切って入力フィールドに設定
    setInput(urls.join("\n"))
  }

  // handleAnalyze関数を修正して、レスポンスの内容タイプをチェックし、JSONでない場合の処理を追加
  const handleAnalyze = async () => {
    if (!input.trim()) return

    const aiStartTime = Date.now()
    setIsLoading(true)
    setOutput("")
    setError(null)
    setFormattedOutput(null)
    setUsageInfo(null)

    try {
      // Use the API route instead of calling the provider directly
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: input,
          provider: activeTab,
          referenceUrlCount: referenceUrlCount, // 参考URLの数を送信
        }),
      })

      // レスポンスが成功したかどうかをチェック
      if (!response.ok) {
        let errorMessage = `分析エンジンからのエラーレスポンス: ${response.status} ${response.statusText}`
        try {
          // エラーレスポンスのテキストを取得
          const errorText = await response.text()
          console.error("Error response text:", errorText)

          // HTMLかどうかをチェック
          if (errorText.trim().startsWith("<!DOCTYPE") || errorText.trim().startsWith("<html")) {
            errorMessage = `サーバーエラーが発生しました。ステータスコード: ${response.status}`
            console.error("HTML error response detected:", errorText.substring(0, 200))
          } else {
            // JSONとして解析できるか試みる
            try {
              const errorJson = JSON.parse(errorText)
              if (errorJson.error) {
                errorMessage = errorJson.error
              }
            } catch (jsonError) {
              // JSONとして解析できない場合はテキストをそのまま使用
              errorMessage = `${errorMessage} - ${errorText}`
            }
          }
        } catch (textError) {
          console.error("Error getting response text:", textError)
        }

        setError(errorMessage)
        setOutput(JSON.stringify({ error: errorMessage }, null, 2))
        setIsLoading(false)
        return
      }

      // レスポンスがJSONかどうかを確認
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const errorMessage = `予期しないレスポンス形式: ${contentType}`
        console.error(errorMessage)

        // レスポンスのテキストを取得して確認
        const responseText = await response.text()
        console.error("Non-JSON response:", responseText.substring(0, 200))

        // HTMLかどうかをチェック
        if (responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html")) {
          setError("サーバーエラーが発生しました。HTMLレスポンスが返されました。")
        } else {
          setError(errorMessage)
        }

        setOutput(JSON.stringify({ error: errorMessage, responsePreview: responseText.substring(0, 100) }, null, 2))
        setIsLoading(false)
        return
      }

      // JSONレスポンスを解析
      let result
      try {
        result = await response.json()
      } catch (jsonError) {
        console.error("Error parsing JSON response:", jsonError)
        const responseText = await response.text()
        setError(`JSONの解析に失敗しました: ${jsonError instanceof Error ? jsonError.message : "不明なエラー"}`)
        setOutput(
          JSON.stringify(
            {
              error: "JSONの解析に失敗しました",
              details: jsonError instanceof Error ? jsonError.message : "不明なエラー",
              responsePreview: responseText.substring(0, 100),
            },
            null,
            2,
          ),
        )
        setIsLoading(false)
        return
      }

      // Check if there's an error in the result
      if (result.error) {
        setError(result.error)
        setOutput(JSON.stringify({ error: result.error, details: result.details }, null, 2))
      } else {
        setOutput(JSON.stringify(result, null, 2))
      }

      // AI処理時間を記録
      const aiEndTime = Date.now()
      const aiTime = aiEndTime - aiStartTime
      setAiProcessingTime(aiTime)

      // 合計処理時間を計算（検索時間がある場合は加算）
      const totalTime = aiTime + (searchProcessingTime > 0 ? searchProcessingTime : 0)
      setTotalProcessingTime(totalTime)
    } catch (error) {
      console.error("Error analyzing product:", error)
      setError(`リクエスト処理中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`)
      setOutput(
        JSON.stringify(
          {
            error: "リクエスト処理中にエラーが発生しました",
            details: error instanceof Error ? error.message : "不明なエラー",
          },
          null,
          2,
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  // 時間をフォーマットする関数（ミリ秒を秒に変換）
  const formatTime = (ms: number) => {
    return (ms / 1000).toFixed(2) + "秒"
  }

  // コストをフォーマットする関数（小数点以下6桁まで表示）
  const formatCost = (cost: number) => {
    return "$" + cost.toFixed(6)
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">AI Product Information Playground</h1>

      {isCheckingApiKey ? (
        <div className="flex justify-center mb-6">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          <ApiKeyStatus apiName="OpenAI" checkEndpoint="/api/check-api-key" />
          <ApiKeyStatus apiName="Brave Search" checkEndpoint="/api/check-brave-api-key" />
          <ApiKeyStatus apiName="Firecrawl" checkEndpoint="/api/check-firecrawl-api-key" />
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>キーワード検索</CardTitle>
          <CardDescription>検索エンジンを選択して結果URLをAI分析に使用</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 検索エンジン選択部分 */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="duckduckgo"
                  name="searchEngine"
                  value="duckduckgo"
                  checked={searchEngine === "duckduckgo"}
                  onChange={() => setSearchEngine("duckduckgo")}
                  className="h-4 w-4"
                />
                <Label htmlFor="duckduckgo" className="cursor-pointer">
                  DuckDuckGo
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="brave"
                  name="searchEngine"
                  value="brave"
                  checked={searchEngine === "brave"}
                  onChange={() => setSearchEngine("brave")}
                  className="h-4 w-4"
                />
                <Label htmlFor="brave" className="cursor-pointer">
                  Brave Search
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="firecrawl"
                  name="searchEngine"
                  value="firecrawl"
                  checked={searchEngine === "firecrawl"}
                  onChange={() => setSearchEngine("firecrawl")}
                  className="h-4 w-4"
                />
                <Label htmlFor="firecrawl" className="cursor-pointer">
                  Firecrawl
                </Label>
              </div>
            </div>
          </div>

          {/* Firecrawlが選択されている場合のDeep Research設定 */}
          {searchEngine === "firecrawl" && (
            <div className="pl-4 border-l-2 border-gray-200 space-y-4">
              <div className="flex items-center space-x-2">
                <Switch id="deep-research" checked={deepResearchEnabled} onCheckedChange={setDeepResearchEnabled} />
                <Label htmlFor="deep-research" className="cursor-pointer">
                  Deep Research モード
                </Label>
              </div>

              {deepResearchEnabled && (
                <Collapsible
                  open={isDeepResearchSettingsOpen}
                  onOpenChange={setIsDeepResearchSettingsOpen}
                  className="bg-gray-50 p-3 rounded-md"
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">詳細設定</Label>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        {isDeepResearchSettingsOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="max-depth" className="text-xs">
                          最大深度: {deepResearchParams.maxDepth}
                        </Label>
                        <span className="text-xs text-gray-500">1-10</span>
                      </div>
                      <Slider
                        id="max-depth"
                        min={1}
                        max={10}
                        step={1}
                        value={[deepResearchParams.maxDepth]}
                        onValueChange={(value) => updateDeepResearchParam("maxDepth", value[0])}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="time-limit" className="text-xs">
                          時間制限: {deepResearchParams.timeLimit}秒
                        </Label>
                        <span className="text-xs text-gray-500">30-300秒</span>
                      </div>
                      <Slider
                        id="time-limit"
                        min={30}
                        max={300}
                        step={30}
                        value={[deepResearchParams.timeLimit]}
                        onValueChange={(value) => updateDeepResearchParam("timeLimit", value[0])}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="max-urls" className="text-xs">
                          最大URL数: {deepResearchParams.maxUrls}
                        </Label>
                        <span className="text-xs text-gray-500">5-30</span>
                      </div>
                      <Slider
                        id="max-urls"
                        min={5}
                        max={30}
                        step={5}
                        value={[deepResearchParams.maxUrls]}
                        onValueChange={(value) => updateDeepResearchParam("maxUrls", value[0])}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}

          {/* 検索ボタンの部分を更新して、現在の検索エンジンを表示 */}
          <div className="flex gap-2">
            <Input
              placeholder={`${searchEngine === "brave" ? "Brave Search" : searchEngine === "firecrawl" ? "Firecrawl" : "DuckDuckGo"}で検索...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {/* Firecrawl APIキーが設定されていない場合の警告 */}
          {searchEngine === "firecrawl" && firecrawlApiKeyStatus && !firecrawlApiKeyStatus.configured && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">Firecrawl APIキーが設定されていません</AlertTitle>
              <AlertDescription className="text-yellow-700">
                Firecrawl機能を使用するには、環境変数にAPIキーを設定してください。
              </AlertDescription>
            </Alert>
          )}

          {/* フォールバック情報を表示 */}
          {fallbackReason && actualSearchEngine === "duckduckgo" && searchEngine === "brave" && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">Brave Search APIからDuckDuckGoにフォールバック</AlertTitle>
              <AlertDescription className="text-yellow-700">
                {fallbackReason}。DuckDuckGoの検索結果を表示しています。
              </AlertDescription>
            </Alert>
          )}

          {/* Deep Research進行状況 */}
          {searchEngine === "firecrawl" && deepResearchEnabled && deepResearchJobId && !deepResearchCompleted && (
            <div className="mt-4">
              <DeepResearchProgress
                jobId={deepResearchJobId}
                onComplete={handleDeepResearchComplete}
                onError={handleDeepResearchError}
                startTime={deepResearchStartTime}
              />
            </div>
          )}

          {/* Deep Research結果 */}
          {searchEngine === "firecrawl" && deepResearchEnabled && deepResearchCompleted && deepResearchResult && (
            <div className="mt-4">
              <DeepResearchResults
                result={deepResearchResult}
                isLoading={false}
                onUseUrls={useUrlsForAnalysis}
                elapsedTime={deepResearchElapsedTime}
              />
            </div>
          )}

          {/* 検索結果の上に現在の検索エンジンを表示 */}
          {(searchResults.length > 0 || isSearching) && (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500 flex items-center flex-wrap gap-2">
                  検索エンジン:{" "}
                  <Badge
                    className="ml-2"
                    variant={
                      actualSearchEngine?.includes("モック")
                        ? "secondary"
                        : actualSearchEngine === "brave"
                          ? "default"
                          : actualSearchEngine === "firecrawl"
                            ? "destructive"
                            : "outline"
                    }
                  >
                    {actualSearchEngine === "brave"
                      ? "Brave Search"
                      : actualSearchEngine === "brave (モック)"
                        ? "Brave Search (モック)"
                        : actualSearchEngine === "firecrawl"
                          ? "Firecrawl"
                          : actualSearchEngine === "firecrawl (モック)"
                            ? "Firecrawl (モック)"
                            : "DuckDuckGo"}
                  </Badge>
                </div>
                {searchResults.length > 0 && (
                  <div className="text-sm text-gray-500">{searchResults.length}件の結果</div>
                )}
              </div>
              <SearchResults results={searchResults} isLoading={isSearching} onUseUrls={useUrlsForAnalysis} />
            </>
          )}

          {/* 生のレスポンスデータを含めるように修正 */}
          {searchLogs.length > 0 && (
            <SearchLogs logs={searchLogs} processingTime={searchProcessingTime} rawResponse={rawResponse} />
          )}
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Select AI Provider</CardTitle>
          <CardDescription>Choose which AI model to use for product research</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="openai" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="openai">OpenAI</TabsTrigger>
              <TabsTrigger value="claude">Claude</TabsTrigger>
              <TabsTrigger value="gemini">Gemini</TabsTrigger>
            </TabsList>
            <TabsContent value="openai" className="mt-4">
              <p className="text-sm text-muted-foreground">
                Using OpenAI's deep research capabilities to analyze product information.
              </p>
            </TabsContent>
            <TabsContent value="claude" className="mt-4">
              <p className="text-sm text-muted-foreground">Using Anthropic's Claude to analyze product information.</p>
            </TabsContent>
            <TabsContent value="gemini" className="mt-4">
              <p className="text-sm text-muted-foreground">Using Google's Gemini to analyze product information.</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Enter product name or description</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="製品名や説明を入力してください（例：iPhone 15 Pro、Sony WH-1000XM5ヘッドフォン）..."
              className="min-h-[200px]"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />

            {/* 参考URLの数を指定する入力フィールドを追加 */}
            <div className="space-y-2">
              <Label htmlFor="reference-url-count">参考URLの数</Label>
              <Input
                id="reference-url-count"
                type="number"
                min={1}
                max={10}
                value={referenceUrlCount}
                onChange={(e) => {
                  const parsedValue = Number.parseInt(e.target.value)
                  setReferenceUrlCount(Number.isNaN(parsedValue) ? 1 : parsedValue)
                }}
              />
              <p className="text-xs text-muted-foreground">AIが分析に使用する参考URLの数を指定してください（1〜10）</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || !input.trim() || !apiKeyStatus?.configured}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  分析中...
                </>
              ) : (
                "製品を分析"
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Output</CardTitle>
            <CardDescription>JSON result with product information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Tabs defaultValue="formatted" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="formatted">整形表示</TabsTrigger>
                  <TabsTrigger value="raw">JSON表示</TabsTrigger>
                </TabsList>
                <TabsContent value="formatted" className="mt-4">
                  {formattedOutput && formattedOutput.productInfo ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">良い点</h3>
                        <ul className="space-y-3">
                          {formattedOutput.productInfo.goodPoints.map((point: any, index: number) => (
                            <li key={`good-${index}`} className="bg-green-50 p-3 rounded-md">
                              <div className="font-medium text-green-800">{point.point}</div>
                              <div className="text-sm text-green-700 mt-1">{point.description}</div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-2">悪い点</h3>
                        <ul className="space-y-3">
                          {formattedOutput.productInfo.badPoints.map((point: any, index: number) => (
                            <li key={`bad-${index}`} className="bg-red-50 p-3 rounded-md">
                              <div className="font-medium text-red-800">{point.point}</div>
                              <div className="text-sm text-red-700 mt-1">{point.description}</div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-2">仕様</h3>
                        <div className="bg-gray-50 p-3 rounded-md">
                          <dl className="divide-y divide-gray-200">
                            {formattedOutput.productInfo.specifications.dimensions && (
                              <div className="py-2 grid grid-cols-3">
                                <dt className="font-medium text-gray-700">寸法</dt>
                                <dd className="col-span-2 text-gray-700">
                                  {formattedOutput.productInfo.specifications.dimensions}
                                </dd>
                              </div>
                            )}
                            {formattedOutput.productInfo.specifications.weight && (
                              <div className="py-2 grid grid-cols-3">
                                <dt className="font-medium text-gray-700">重量</dt>
                                <dd className="col-span-2 text-gray-700">
                                  {formattedOutput.productInfo.specifications.weight}
                                </dd>
                              </div>
                            )}
                            {formattedOutput.productInfo.specifications.materials && (
                              <div className="py-2 grid grid-cols-3">
                                <dt className="font-medium text-gray-700">材質</dt>
                                <dd className="col-span-2 text-gray-700">
                                  {formattedOutput.productInfo.specifications.materials.join(", ")}
                                </dd>
                              </div>
                            )}
                            {formattedOutput.productInfo.specifications.standards && (
                              <div className="py-2 grid grid-cols-3">
                                <dt className="font-medium text-gray-700">規格</dt>
                                <dd className="col-span-2 text-gray-700">
                                  {formattedOutput.productInfo.specifications.standards.join(", ")}
                                </dd>
                              </div>
                            )}
                            {formattedOutput.productInfo.specifications.additionalSpecs &&
                              Object.entries(formattedOutput.productInfo.specifications.additionalSpecs).map(
                                ([key, value]: [string, any], index: number) => (
                                  <div key={`spec-${index}`} className="py-2 grid grid-cols-3">
                                    <dt className="font-medium text-gray-700">{key}</dt>
                                    <dd className="col-span-2 text-gray-700">{value}</dd>
                                  </div>
                                ),
                              )}
                          </dl>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      {output
                        ? "出力の解析に失敗しました。JSON表示タブを確認してください。"
                        : "分析結果がここに表示されます。"}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="raw" className="mt-4">
                  <pre className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[500px] text-xs">
                    {output || "分析結果がここに表示されます。"}
                  </pre>
                </TabsContent>
              </Tabs>
            </div>

            {/* 使用量情報を表示 */}
            {usageInfo && (
              <div className="mt-4 border-t pt-4">
                <h3 className="text-sm font-medium mb-2">使用量情報</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="font-medium">処理時間:</span> {formatTime(aiProcessingTime)}
                  </div>
                  {usageInfo.total_tokens && (
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="font-medium">トークン数:</span> {usageInfo.total_tokens.toLocaleString()}
                    </div>
                  )}
                  {usageInfo.prompt_tokens && (
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="font-medium">入力トークン:</span> {usageInfo.prompt_tokens.toLocaleString()}
                    </div>
                  )}
                  {usageInfo.completion_tokens && (
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="font-medium">出力トークン:</span> {usageInfo.completion_tokens.toLocaleString()}
                    </div>
                  )}
                  {usageInfo.cost && (
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="font-medium">コスト:</span> {formatCost(usageInfo.cost)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 合計処理時間を表示 */}
            {totalProcessingTime > 0 && (
              <div className="mt-4 text-xs text-gray-500">
                合計処理時間: {formatTime(totalProcessingTime)}
                {searchProcessingTime > 0 && aiProcessingTime > 0 && (
                  <span>
                    {" "}
                    (検索: {formatTime(searchProcessingTime)}, AI: {formatTime(aiProcessingTime)})
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
