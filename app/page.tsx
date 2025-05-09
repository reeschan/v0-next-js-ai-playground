"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, AlertCircle, ExternalLink, Clock, DollarSign, Hash, Search, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchResults } from "@/components/search-results"
import { SearchLogs } from "@/components/search-logs"
import { SearchEngineSelector } from "@/components/search-engine-selector"
import { ApiKeyStatus } from "@/components/api-key-status"
import { Badge } from "@/components/ui/badge"

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

  // Check API key status on component mount
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const response = await fetch("/api/check-api-key")
        const data = await response.json()
        setApiKeyStatus(data)
      } catch (error) {
        console.error("Error checking API key:", error)
        setApiKeyStatus({
          configured: false,
          message: "Error checking API key configuration",
        })
      } finally {
        setIsCheckingApiKey(false)
      }
    }

    checkApiKey()
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

  // handleSearch関数を更新して、選択された検索エンジンに基づいて検索を実行
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchResults([])
    setSearchLogs([])
    setSearchProcessingTime(0)
    setError(null)
    setActualSearchEngine(null)
    setFallbackReason(null)

    try {
      // 選択された検索エンジンに基づいてAPIエンドポイントを決定
      const apiEndpoint = searchEngine === "brave" ? "/api/brave-search" : "/api/search"

      const response = await fetch(`${apiEndpoint}?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setSearchResults(data.results)

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
      }
    } catch (error) {
      console.error("Error searching:", error)
      setError("検索中にエラーが発生しました")
    } finally {
      setIsSearching(false)
    }
  }

  const useUrlsForAnalysis = (urls: string[]) => {
    // URLを改行で区切って入力フィールドに設定
    setInput(urls.join("\n"))
  }

  const handleAnalyze = async () => {
    if (!input.trim()) return

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

      const result = await response.json()

      // Check if there's an error in the result
      if (result.error) {
        setError(result.error)
        setOutput(JSON.stringify({ error: result.error, details: result.details }, null, 2))
      } else {
        setOutput(JSON.stringify(result, null, 2))
      }
    } catch (error) {
      console.error("Error searching product:", error)
      setError("Failed to process request")
      setOutput(JSON.stringify({ error: "Failed to process request" }, null, 2))
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
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {usageInfo && (
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-blue-800 text-lg">使用量情報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-md shadow-sm">
                <div className="flex items-center text-blue-800 mb-1">
                  <Hash className="h-4 w-4 mr-1" />
                  <h3 className="font-medium">トークン使用量</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">入力トークン:</div>
                  <div className="font-medium text-right">{usageInfo.promptTokens.toLocaleString()}</div>
                  <div className="text-gray-600">出力トークン:</div>
                  <div className="font-medium text-right">{usageInfo.completionTokens.toLocaleString()}</div>
                  <div className="text-gray-600">合計トークン:</div>
                  <div className="font-medium text-right">{usageInfo.totalTokens.toLocaleString()}</div>
                </div>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm">
                <div className="flex items-center text-blue-800 mb-1">
                  <DollarSign className="h-4 w-4 mr-1" />
                  <h3 className="font-medium">コスト (USD)</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">入力コスト:</div>
                  <div className="font-medium text-right">{formatCost(usageInfo.inputCost)}</div>
                  <div className="text-gray-600">出力コスト:</div>
                  <div className="font-medium text-right">{formatCost(usageInfo.outputCost)}</div>
                  <div className="text-gray-600">合計コスト:</div>
                  <div className="font-medium text-right">{formatCost(usageInfo.totalCost)}</div>
                </div>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm">
                <div className="flex items-center text-blue-800 mb-1">
                  <Clock className="h-4 w-4 mr-1" />
                  <h3 className="font-medium">処理情報</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">モデル:</div>
                  <div className="font-medium text-right">{usageInfo.model}</div>
                  <div className="text-gray-600">処理時間:</div>
                  <div className="font-medium text-right">{formatTime(usageInfo.processingTimeMs)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>キーワード検索</CardTitle>
          <CardDescription>検索エンジンを選択して結果URLをAI分析に使用</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 検索エンジン選択コンポーネントを追加 */}
          <SearchEngineSelector onEngineChange={setSearchEngine} defaultEngine={searchEngine} />

          {/* 検索ボタンの部分を更新して、現在の検索エンジンを表示 */}
          <div className="flex gap-2">
            <Input
              placeholder={`${searchEngine === "brave" ? "Brave Search" : "DuckDuckGo"}で検索...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

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

          {/* 検索結果の上に現在の検索エンジンを表示 */}
          {(searchResults.length > 0 || isSearching) && (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500 flex items-center">
                  検索エンジン:{" "}
                  <Badge className="ml-2" variant={actualSearchEngine === "brave" ? "default" : "outline"}>
                    {actualSearchEngine === "brave" ? "Brave Search" : "DuckDuckGo"}
                  </Badge>
                </div>
                {searchResults.length > 0 && (
                  <div className="text-sm text-gray-500">{searchResults.length}件の結果</div>
                )}
              </div>
              <SearchResults results={searchResults} isLoading={isSearching} onUseUrls={useUrlsForAnalysis} />
            </>
          )}
          {searchLogs.length > 0 && <SearchLogs logs={searchLogs} processingTime={searchProcessingTime} />}
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
                onChange={(e) => setReferenceUrlCount(Number.parseInt(e.target.value) || 1)}
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

                      <div>
                        <h3 className="text-lg font-semibold mb-2">参考URL</h3>
                        <ul className="space-y-1 bg-blue-50 p-3 rounded-md">
                          {formattedOutput.productInfo.referenceUrls.map((url: string, index: number) => (
                            <li key={`url-${index}`} className="flex items-center">
                              <ExternalLink className="h-4 w-4 text-blue-600 mr-2" />
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate"
                              >
                                {url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">結果がここに表示されます...</div>
                  )}
                </TabsContent>
                <TabsContent value="raw" className="mt-4">
                  <pre className="bg-slate-100 p-4 rounded-md overflow-auto min-h-[200px] text-sm">
                    {output || "結果がここに表示されます..."}
                  </pre>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (output) {
                  navigator.clipboard.writeText(output)
                }
              }}
              disabled={!output}
              className="w-full"
            >
              クリップボードにコピー
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}
