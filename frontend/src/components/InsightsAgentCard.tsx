import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Brain, AlertTriangle, CheckCircle2, RefreshCw, Bot, Lightbulb, ShieldAlert, Cpu } from "lucide-react";
import { getProjectInsights, type ProjectInsightResponse } from "@/api/genai";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface InsightsAgentCardProps {
  projectId?: number | string | null;
  projectName?: string;
  className?: string;
  compact?: boolean;
}

export function InsightsAgentCard({
  projectId,
  projectName,
  className,
  compact = false,
}: InsightsAgentCardProps) {
  const [insight, setInsight] = useState<ProjectInsightResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    if (!projectId) {
      setInsight(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectInsights(projectId);
      setInsight(data);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Failed to load AI insights";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [projectId]);

  if (!projectId) {
    return (
      <Card className={cn("border border-dashed border-border/80 bg-card/50", className)}>
        <CardContent className="py-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
          <Brain className="h-8 w-8 text-muted-foreground/40 animate-pulse" />
          <p className="text-sm">Select a project above to generate AI plain-text insights for CPI, SPI, and forecasts.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-2 border-primary/20 shadow-elevated bg-card relative overflow-hidden", className)}>
      {/* Decorative top gradient stripe */}
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />

      <CardHeader className="pb-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
              <Sparkles className="h-5 w-5 text-blue-500 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base md:text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
                  AI Insights Agent
                </CardTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11px] px-2 py-0.5 border font-semibold flex items-center gap-1",
                    insight?.source === "llm"
                      ? "bg-purple-500/10 text-purple-600 border-purple-500/30"
                      : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                  )}
                >
                  <Cpu className="h-3 w-3" />
                  {insight?.source === "llm" ? "AI Powered" : "EVM Rule Engine"}
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Plain-language interpretation of complex CPI, SPI, QPI metrics & delay forecasts
              </CardDescription>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchInsights}
            disabled={loading}
            className="h-8 text-xs gap-1.5 border-border hover:bg-muted/80 shadow-sm"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin text-primary")} />
            {loading ? "Analyzing..." : "Refresh Insights"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1 pb-5">
        {loading && !insight ? (
          <div className="py-8 space-y-3">
            <div className="flex items-center justify-center gap-2 text-primary text-sm font-medium">
              <Bot className="h-5 w-5 animate-bounce" />
              <span>Analyzing EVM numbers with AI Agent...</span>
            </div>
            <div className="h-4 bg-muted/60 rounded animate-pulse w-3/4 mx-auto" />
            <div className="h-4 bg-muted/40 rounded animate-pulse w-1/2 mx-auto" />
          </div>
        ) : error && !insight ? (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to generate AI insights</p>
              <p className="text-xs mt-0.5">{error}</p>
              <Button size="sm" variant="outline" onClick={fetchInsights} className="mt-2 h-7 text-xs">
                Try Again
              </Button>
            </div>
          </div>
        ) : insight ? (
          <>
            {/* Plain-language Executive Summary */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 border border-primary/15">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                  <Brain className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase font-bold tracking-wider text-primary">Executive Summary</span>
                  <p className="text-sm font-medium leading-relaxed text-foreground">
                    {insight.summary}
                  </p>
                </div>
              </div>
            </div>

            {/* Split layout: Key Risks & Actionable Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Risks Column */}
              <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 space-y-2.5">
                <div className="flex items-center gap-2 text-destructive font-semibold text-xs tracking-wider uppercase">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Identified Risk Factors</span>
                </div>
                {insight.risks && insight.risks.length > 0 ? (
                  <ul className="space-y-1.5">
                    {insight.risks.map((risk, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground/90 leading-snug">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No immediate risks detected.</p>
                )}
              </div>

              {/* Recommendations Column */}
              <div className="p-3.5 rounded-xl border border-success/20 bg-success/5 space-y-2.5">
                <div className="flex items-center gap-2 text-success font-semibold text-xs tracking-wider uppercase">
                  <Lightbulb className="h-4 w-4" />
                  <span>AI Recommendations</span>
                </div>
                {insight.recommendations && insight.recommendations.length > 0 ? (
                  <ul className="space-y-1.5">
                    {insight.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground/90 leading-snug">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Cadence is stable; keep monitoring metrics.</p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
