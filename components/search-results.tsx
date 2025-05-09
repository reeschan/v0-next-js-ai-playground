"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExternalLink, Copy, ChevronDown, ChevronUp, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// 検索結果の型定義を拡張
interface SearchResult {
  title: string
  url: string
  description: string
  source?: string
  favicon?: string | null
  age?: string | null
  isFamily?: boolean
  publishedTime?: string | null
  publisher?: string | null
}

interface SearchResultsProps {
  results: SearchResult[]
  isLoading: boolean
  onUseUrls: (urls: string[]) => void
}

export function SearchResults({ results, isLoading, onUseUrls }: SearchResultsProps) {
  const [showAll, setShowAll] = useState(false)

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!results || results.length === 0) {
    return <div className="text-center py-8 text-gray-500">検索結果がありません。別のキーワードで試してください。</div>
  }

  // 表示する結果の数を決定
  const displayResults = showAll ? results : results.slice(0, 5)

  const handleUseUrls = () => {
    // 最大5つのURLを選択
    const urls = results.slice(0, 5).map((result) => result.url)
    onUseUrls(urls)
  }

  // ソースに基づいて色を決定
  const getSourceColor = (source: string) => {
    switch (source) {
      case "Abstract":
        return "bg-blue-100 text-blue-800"
      case "Results":
        return "bg-green-100 text-green-800"
      case "RelatedTopics":
        return "bg-purple-100 text-purple-800"
      case "Infobox":
        return "bg-yellow-100 text-yellow-800"
      case "Brave Web":
        return "bg-orange-100 text-orange-800"
      case "Brave News":
        return "bg-red-100 text-red-800"
      case "Fallback":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">検索結果 ({results.length}件)</h3>
        <Button onClick={handleUseUrls} size="sm" className="bg-blue-600 hover:bg-blue-700">
          <Copy className="h-4 w-4 mr-2" />
          上位5件をAI分析に使用
        </Button>
      </div>

      <div className="space-y-3">
        {displayResults.map((result, index) => (
          <Card key={index} className="overflow-hidden">
            <CardHeader className="py-3 px-4 bg-gray-50 flex flex-row justify-between items-start">
              <CardTitle className="text-base font-medium truncate">{result.title}</CardTitle>
              {result.source && <Badge className={`ml-2 ${getSourceColor(result.source)}`}>{result.source}</Badge>}
            </CardHeader>
            <CardContent className="py-3 px-4">
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">{result.description}</p>
              <div className="flex items-center text-blue-600 mb-2">
                <ExternalLink className="h-4 w-4 mr-1" />
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm truncate hover:underline"
                >
                  {result.url}
                </a>
              </div>

              {/* Brave Search固有の追加情報 - オプションのプロパティを安全に処理 */}
              {result.source?.includes("Brave") && (
                <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-2">
                  {result.favicon && (
                    <span className="flex items-center">
                      <img
                        src={result.favicon || "/placeholder.svg"}
                        alt="favicon"
                        className="w-4 h-4 mr-1"
                        onError={(e) => {
                          // 画像読み込みエラー時に代替画像を表示
                          e.currentTarget.src = "/generic-icon.png"
                        }}
                      />
                    </span>
                  )}
                  {result.age && (
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {result.age}
                    </span>
                  )}
                  {result.publishedTime && (
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {new Date(result.publishedTime).toLocaleDateString()}
                    </span>
                  )}
                  {result.publisher && (
                    <span className="flex items-center">
                      <span className="font-medium">{result.publisher}</span>
                    </span>
                  )}
                  {result.isFamily !== undefined && (
                    <Badge
                      className={result.isFamily ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}
                    >
                      {result.isFamily ? "ファミリーフレンドリー" : "成人向け"}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {results.length > 5 && (
        <Button variant="outline" onClick={() => setShowAll(!showAll)} className="w-full mt-2">
          {showAll ? (
            <>
              <ChevronUp className="h-4 w-4 mr-2" />
              結果を折りたたむ
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-2" />
              すべての結果を表示 ({results.length}件)
            </>
          )}
        </Button>
      )}
    </div>
  )
}
