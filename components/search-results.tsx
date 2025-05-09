"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, ExternalLink, Check } from "lucide-react"
import { useState } from "react"

interface SearchResult {
  title: string
  url: string
  description?: string
  source?: string
  confidence?: number
}

interface SearchResultsProps {
  results: SearchResult[]
  isLoading: boolean
  onUseUrls: (urls: string[]) => void
}

export function SearchResults({ results, isLoading, onUseUrls }: SearchResultsProps) {
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())

  const toggleUrlSelection = (url: string) => {
    const newSelection = new Set(selectedUrls)
    if (newSelection.has(url)) {
      newSelection.delete(url)
    } else {
      newSelection.add(url)
    }
    setSelectedUrls(newSelection)
  }

  const handleUseSelected = () => {
    onUseUrls(Array.from(selectedUrls))
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">検索結果を取得中...</span>
      </div>
    )
  }

  if (results.length === 0 && !isLoading) {
    return <div className="text-center py-12 text-gray-500">検索結果がありません。別のキーワードで試してください。</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-gray-500">
          {selectedUrls.size > 0 ? `${selectedUrls.size}件選択中` : "URLを選択してください"}
        </div>
        <Button size="sm" onClick={handleUseSelected} disabled={selectedUrls.size === 0} className="text-xs">
          選択したURLを使用
        </Button>
      </div>

      <div className="space-y-3">
        {results.map((result, index) => (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-medium line-clamp-2 flex-1">
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center"
                    >
                      {result.title}
                      <ExternalLink className="h-3 w-3 ml-1 inline-flex" />
                    </a>
                  </h3>
                  <Button
                    variant={selectedUrls.has(result.url) ? "default" : "outline"}
                    size="sm"
                    className="ml-2 h-8 w-8 p-0 flex-shrink-0"
                    onClick={() => toggleUrlSelection(result.url)}
                  >
                    {selectedUrls.has(result.url) ? <Check className="h-4 w-4" /> : <span className="text-xs">+</span>}
                  </Button>
                </div>
                <div className="text-sm text-green-700 mt-1 break-all">{result.url}</div>
                {result.description && <p className="text-sm text-gray-600 mt-2 line-clamp-3">{result.description}</p>}
                {(result.source || result.confidence) && (
                  <div className="flex items-center mt-2 text-xs text-gray-500">
                    {result.source && <span className="mr-2">ソース: {result.source}</span>}
                    {result.confidence && <span>信頼度: {(result.confidence * 100).toFixed(0)}%</span>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
