"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, Clock, FileText, Activity, Timer, ChevronDown, ChevronUp } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface DeepResearchProgressProps {
  jobId: string
  onComplete: (result: any, elapsedTime: number) => void
  onError: (error: string) => void
  startTime?: number
}

export function DeepResearchProgress({ jobId, onComplete, onError, startTime }: DeepResearchProgressProps) {
  const [status, setStatus] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

  // 経過時間を追跡するための状態
  const [elapsedTime, setElapsedTime] = useState<number>(0)
  const [displayTime, setDisplayTime] = useState<string>("00:00")
  const jobStartTime = useRef<number>(startTime || Date.now())
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [pollCount, setPollCount] = useState<number>(0) // ポーリング回数を追跡

  // ポーリングログを追跡するための状態
  const [pollingLogs, setPollingLogs] = useState<
    Array<{
      timestamp: string
      count: number
      status: string
      depth?: number
      maxDepth?: number
      responseTime?: number
    }>
  >([])
  const [showLogs, setShowLogs] = useState(false)
  const isComponentMounted = useRef(false)

  // タイマーを開始する関数
  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    timerRef.current = setInterval(() => {
      const currentTime = Date.now()
      const timeElapsed = Math.floor((currentTime - jobStartTime.current) / 1000) // 秒単位
      setElapsedTime(timeElapsed)

      // MM:SS 形式でフォーマット
      const minutes = Math.floor(timeElapsed / 60)
      const seconds = timeElapsed % 60
      setDisplayTime(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`)
    }, 1000)
  }

  const fetchStatus = async () => {
    if (!isComponentMounted.current) return
    if (!jobId) {
      console.error("ジョブIDが指定されていないため、ステータスを取得できません")
      return
    }

    try {
      const requestStartTime = Date.now()
      setIsLoading(true)
      setError(null)
      const currentCount = pollCount + 1
      setPollCount(currentCount) // ポーリング回数をインクリメント

      // 現在の時刻を取得
      const now = new Date()
      const formattedTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now.getMilliseconds().toString().padStart(3, "0")}`

      // ログにリクエスト開始を記録
      const newLog = {
        timestamp: formattedTime,
        count: currentCount,
        status: "リクエスト送信中",
      }
      setPollingLogs((prev) => [...prev, newLog])

      console.log(`[${formattedTime}] Deep Research ステータスリクエスト #${currentCount}: jobId=${jobId}`)

      // ステータス取得リクエスト
      const statusUrl = `/api/firecrawl-status?jobId=${jobId}`
      console.log(`ステータス取得URL: ${statusUrl}`)
      const response = await fetch(statusUrl)

      const requestEndTime = Date.now()
      const responseTime = requestEndTime - requestStartTime

      if (!response.ok) {
        throw new Error(`ステータス取得エラー: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`[${formattedTime}] Deep Research ステータスレスポンス #${currentCount}:`, data)
      setStatus(data)

      // ログにレスポンスを記録
      const responseLog = {
        timestamp: formattedTime,
        count: currentCount,
        status: data.status || "不明",
        depth: data.currentDepth,
        maxDepth: data.maxDepth,
        responseTime: responseTime,
      }
      setPollingLogs((prev) => [...prev.slice(0, -1), responseLog])

      // 完了した場合、ポーリングとタイマーを停止して結果を親コンポーネントに通知
      if (data.status === "completed") {
        console.log(`[${formattedTime}] Deep Research ジョブ完了を検出: jobId=${jobId}`)
        if (pollingInterval) {
          clearInterval(pollingInterval)
          setPollingInterval(null)
        }

        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        // 経過時間を親コンポーネントに渡す
        onComplete(data, elapsedTime)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラー"
      console.error(`Deep Research ステータス取得エラー:`, error)
      setError(errorMessage)

      // エラーをログに記録
      const now = new Date()
      const formattedTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now.getMilliseconds().toString().padStart(3, "0")}`

      setPollingLogs((prev) => [
        ...prev,
        {
          timestamp: formattedTime,
          count: pollCount,
          status: `エラー: ${errorMessage}`,
        },
      ])

      onError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // コンポーネントマウント時にポーリングとタイマーを開始
  useEffect(() => {
    if (!jobId) {
      console.error("ジョブIDが指定されていないため、ポーリングを開始できません")
      return
    }

    isComponentMounted.current = true
    console.log(`DeepResearchProgress コンポーネントマウント: jobId=${jobId}`)

    // タイマーを開始
    startTimer()

    // 初回のステータス取得
    fetchStatus()

    // 1秒ごとにステータスを更新
    const interval = setInterval(() => {
      if (isComponentMounted.current) {
        fetchStatus()
      }
    }, 1000)

    setPollingInterval(interval)
    console.log(`Deep Research ポーリング開始: jobId=${jobId}, interval=${interval}`)

    // クリーンアップ関数
    return () => {
      isComponentMounted.current = false
      console.log(`DeepResearchProgress コンポーネントアンマウント: jobId=${jobId}`)

      if (interval) {
        clearInterval(interval)
        console.log(`Deep Research ポーリング停止: interval=${interval}`)
      }

      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [jobId])

  // 進捗率を計算
  const progressPercentage =
    status?.progressPercentage || (status && status.currentDepth !== undefined && status.maxDepth !== undefined)
      ? Math.round((status.currentDepth / status.maxDepth) * 100)
      : 0

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Activity className="h-5 w-5 mr-2 text-blue-600" />
            Deep Research 進行状況
          </div>
          <Button variant="outline" size="sm" onClick={fetchStatus} disabled={isLoading} className="h-8 w-8 p-0">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 p-2 rounded text-sm">
          <div className="font-medium">ジョブID: {jobId}</div>
          <div className="text-xs text-gray-500">このIDを使用してDeep Researchのステータスを追跡しています</div>
        </div>

        {error ? (
          <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">エラー: {error}</div>
        ) : status ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">ステータス: {status.status === "completed" ? "完了" : "進行中"}</div>
              <div className="text-sm text-gray-600">{progressPercentage}% 完了</div>
            </div>
            <Progress value={progressPercentage} className="h-2" />

            <div className="grid grid-cols-3 gap-4 mt-4 text-xs text-gray-600">
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                <span>
                  進捗: {status.currentDepth || 0}/{status.maxDepth || 5} ステップ
                </span>
              </div>
              <div className="flex items-center">
                <Timer className="h-3 w-3 mr-1" />
                <span>経過時間: {displayTime}</span>
              </div>
              <div className="flex items-center">
                <FileText className="h-3 w-3 mr-1" />
                <span>ポーリング回数: {pollCount}回</span>
              </div>
            </div>

            {/* ポーリングログの表示 */}
            <Collapsible open={showLogs} onOpenChange={setShowLogs} className="mt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">ポーリングログ ({pollingLogs.length}件)</h4>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    {showLogs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent className="mt-2">
                <div className="bg-black text-green-400 font-mono text-xs p-3 rounded-md overflow-auto max-h-60">
                  {pollingLogs.map((log, idx) => (
                    <div key={idx} className="whitespace-pre-wrap mb-1">
                      [{log.timestamp}] #{log.count} - {log.status}
                      {log.depth !== undefined && log.maxDepth !== undefined && ` (進捗: ${log.depth}/${log.maxDepth})`}
                      {log.responseTime !== undefined && ` [応答時間: ${log.responseTime}ms]`}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* 最近のアクティビティ表示 */}
            {status.data?.activities && status.data.activities.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">最近のアクティビティ:</h4>
                <div className="relative">
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  <div className="space-y-3">
                    {status.data.activities.slice(-3).map((activity: any, idx: number) => (
                      <div key={idx} className="relative pl-8">
                        <div className="absolute left-0 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center border-2 border-white">
                          <span className="text-xs font-medium text-purple-800">{activity.depth || idx + 1}</span>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-md">
                          <div className="text-xs font-medium">{activity.message}</div>
                          <div className="text-xs text-gray-400 mt-1">{activity.timestamp}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">ステータスを取得中...</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
