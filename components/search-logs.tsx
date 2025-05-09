"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronUp, Clock, Code } from "lucide-react"

interface SearchLogsProps {
  logs: string[]
  processingTime: number
  rawResponse?: any // 生のレスポンスデータを追加
}

export function SearchLogs({ logs, processingTime, rawResponse }: SearchLogsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showRawResponse, setShowRawResponse] = useState(false)

  if (!logs || logs.length === 0) {
    return null
  }

  return (
    <Card className="mt-4 bg-gray-50 border-gray-200">
      <CardHeader
        className="py-3 px-4 flex flex-row items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-sm font-medium flex items-center">
          <Clock className="h-4 w-4 mr-2 text-gray-500" />
          検索ログ ({logs.length}件) - 処理時間: {(processingTime / 1000).toFixed(2)}秒
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {isExpanded && (
        <CardContent className="py-3 px-4">
          {rawResponse && (
            <div className="mb-4">
              <Button
                variant="outline"
                size="sm"
                className="mb-2 flex items-center"
                onClick={() => setShowRawResponse(!showRawResponse)}
              >
                <Code className="h-4 w-4 mr-2" />
                {showRawResponse ? "生レスポンスを隠す" : "生レスポンスを表示"}
              </Button>

              {showRawResponse && (
                <div className="bg-black text-green-400 font-mono text-xs p-3 rounded-md overflow-auto max-h-80 mb-4">
                  <pre>{JSON.stringify(rawResponse, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          <div className="bg-black text-green-400 font-mono text-xs p-3 rounded-md overflow-auto max-h-60">
            {logs.map((log, index) => (
              <div key={index} className="whitespace-pre-wrap mb-1">
                {log}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
