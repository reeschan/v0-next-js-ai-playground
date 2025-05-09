"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Loader2, ExternalLink, Check, Clock, FileText, Link2, Lightbulb, Activity } from "lucide-react"
import { useState } from "react"

interface DeepResearchResultsProps {
  result: any
  isLoading: boolean
  onUseUrls: (urls: string[]) => void
  elapsedTime?: number
}

export function DeepResearchResults({ result, isLoading, onUseUrls, elapsedTime }: DeepResearchResultsProps) {
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState("summary")

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

  const handleUseAllSources = () => {
    if (result.data?.sources && Array.isArray(result.data.sources)) {
      onUseUrls(result.data.sources.map((source: any) => source.url))
    }
  }

  // 経過時間を表示用にフォーマット
  const formatElapsedTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}分${remainingSeconds}秒`
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">Deep Research結果を取得中...</span>
      </div>
    )
  }

  if (!result) {
    return <div className="text-center py-12 text-gray-500">Deep Research結果がありません。</div>
  }

  // 進捗状況の表示
  const progressPercentage = 100 // 完了している場合は100%

  // データの構造に応じて適切にアクセス
  const finalAnalysis = result.data?.finalAnalysis
  const activities = result.data?.activities || []
  const sources = result.data?.sources || []

  return (
    <div className="space-y-4">
      {/* 進捗状況と完了情報 */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Activity className="h-4 w-4 mr-2 text-blue-600" />
              <span className="font-medium text-sm">調査完了</span>
            </div>
            <span className="text-sm text-gray-600">{progressPercentage}% 完了</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="grid grid-cols-2 gap-4 mt-4 text-xs text-gray-600">
            <div className="flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              <span>処理時間: {elapsedTime ? formatElapsedTime(elapsedTime) : "計測なし"}</span>
            </div>
            <div className="flex items-center">
              <FileText className="h-3 w-3 mr-1" />
              <span>ソース数: {sources.length}件</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* タブ付きの結果表示 */}
      <Tabs defaultValue="summary" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="summary">要約</TabsTrigger>
          <TabsTrigger value="sources">ソース</TabsTrigger>
          <TabsTrigger value="activities">活動</TabsTrigger>
        </TabsList>

        {/* 要約タブ */}
        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Lightbulb className="h-5 w-5 mr-2 text-amber-500" />
                最終分析
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {finalAnalysis && (
                <div className="text-sm text-gray-700 bg-amber-50 p-4 rounded-md whitespace-pre-wrap">
                  {finalAnalysis}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ソースタブ */}
        <TabsContent value="sources" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-lg flex items-center">
                <Link2 className="h-5 w-5 mr-2 text-blue-500" />
                情報ソース
              </CardTitle>
              <Button size="sm" onClick={handleUseAllSources} disabled={sources.length === 0} className="text-xs">
                全てのソースを使用
              </Button>
            </CardHeader>
            <CardContent>
              {sources && sources.length > 0 ? (
                <div className="space-y-3">
                  {sources.map((source: any, idx: number) => (
                    <div key={idx} className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex-1">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline flex items-center"
                        >
                          {source.title || source.url}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                        <div className="text-xs text-gray-500 mt-1">{source.url}</div>
                        {source.description && <div className="text-xs text-gray-600 mt-1">{source.description}</div>}
                      </div>
                      <Button
                        variant={selectedUrls.has(source.url) ? "default" : "outline"}
                        size="sm"
                        className="ml-2 h-7 w-7 p-0"
                        onClick={() => toggleUrlSelection(source.url)}
                      >
                        {selectedUrls.has(source.url) ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <span className="text-xs">+</span>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">情報ソースは利用できません。</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 活動タブ */}
        <TabsContent value="activities" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Activity className="h-5 w-5 mr-2 text-purple-500" />
                調査活動
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activities && activities.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  <div className="space-y-4">
                    {activities.map((activity: any, idx: number) => (
                      <div key={idx} className="relative pl-8">
                        <div className="absolute left-0 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center border-2 border-white">
                          <span className="text-xs font-medium text-purple-800">{activity.depth || idx + 1}</span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-md">
                          <div className="font-medium text-sm">{activity.type}</div>
                          <div className="text-xs text-gray-600 mt-1">{activity.message}</div>
                          <div className="text-xs text-gray-400 mt-1">{activity.timestamp}</div>
                          <div className="text-xs text-gray-400">ステータス: {activity.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">調査活動は利用できません。</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 選択したURLを使用するボタン */}
      {selectedUrls.size > 0 && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleUseSelected}>
            選択した{selectedUrls.size}件のURLを使用
          </Button>
        </div>
      )}
    </div>
  )
}
