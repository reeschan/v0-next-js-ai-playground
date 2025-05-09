"use client"

import { useState } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export interface DeepResearchParams {
  maxDepth: number
  timeLimit: number
  maxUrls: number
}

interface SearchEngineSelectorProps {
  onEngineChange: (engine: string) => void
  onDeepResearchChange: (enabled: boolean) => void
  onDeepResearchParamsChange: (params: DeepResearchParams) => void
  defaultEngine?: string
  defaultDeepResearch?: boolean
  defaultDeepResearchParams?: DeepResearchParams
}

export function SearchEngineSelector({
  onEngineChange,
  onDeepResearchChange,
  onDeepResearchParamsChange,
  defaultEngine = "duckduckgo",
  defaultDeepResearch = false,
  defaultDeepResearchParams = { maxDepth: 5, timeLimit: 180, maxUrls: 15 },
}: SearchEngineSelectorProps) {
  const [selectedEngine, setSelectedEngine] = useState(defaultEngine)
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(defaultDeepResearch)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [deepResearchParams, setDeepResearchParams] = useState<DeepResearchParams>(defaultDeepResearchParams)

  const handleEngineChange = (value: string) => {
    setSelectedEngine(value)
    onEngineChange(value)
  }

  const handleDeepResearchChange = (checked: boolean) => {
    setDeepResearchEnabled(checked)
    onDeepResearchChange(checked)
  }

  const updateDeepResearchParams = (key: keyof DeepResearchParams, value: number) => {
    const newParams = { ...deepResearchParams, [key]: value }
    setDeepResearchParams(newParams)
    onDeepResearchParamsChange(newParams)
  }

  return (
    <div className="space-y-4">
      <RadioGroup
        defaultValue={defaultEngine}
        value={selectedEngine}
        onValueChange={handleEngineChange}
        className="flex flex-wrap gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="duckduckgo" id="duckduckgo" />
          <Label htmlFor="duckduckgo" className="cursor-pointer">
            DuckDuckGo
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="brave" id="brave" />
          <Label htmlFor="brave" className="cursor-pointer">
            Brave Search
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="firecrawl" id="firecrawl" />
          <Label htmlFor="firecrawl" className="cursor-pointer">
            Firecrawl
          </Label>
        </div>
      </RadioGroup>

      {selectedEngine === "firecrawl" && (
        <div className="pl-4 border-l-2 border-gray-200 space-y-4">
          <div className="flex items-center space-x-2">
            <Switch id="deep-research" checked={deepResearchEnabled} onCheckedChange={handleDeepResearchChange} />
            <Label htmlFor="deep-research" className="cursor-pointer">
              Deep Research モード
            </Label>
          </div>

          {deepResearchEnabled && (
            <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen} className="bg-gray-50 p-3 rounded-md">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">詳細設定</Label>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                    onValueChange={(value) => updateDeepResearchParams("maxDepth", value[0])}
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
                    onValueChange={(value) => updateDeepResearchParams("timeLimit", value[0])}
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
                    onValueChange={(value) => updateDeepResearchParams("maxUrls", value[0])}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  )
}
