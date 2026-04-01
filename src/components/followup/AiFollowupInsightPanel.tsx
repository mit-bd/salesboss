import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, BrainCircuit, Copy, Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface AiFollowupInsightPanelProps {
  customerName: string;
  productTitle: string;
  productPrice: number;
  stepNumber: number;
  selectedProblems: string[];
  quickInfoSummary: string;
  products: { id: string; title: string; price: number; packageDuration?: number }[];
}

export default function AiFollowupInsightPanel({
  customerName,
  productTitle,
  productPrice,
  stepNumber,
  selectedProblems,
  quickInfoSummary,
  products,
}: AiFollowupInsightPanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const fetchInsight = useCallback(async () => {
    setLoading(true);
    setSuggestion("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-followup-insight", {
        body: {
          problems: selectedProblems.join(", "),
          quickInfo: quickInfoSummary,
          customerName,
          productTitle,
          productPrice,
          stepNumber,
          products: products.map((p) => ({
            title: p.title,
            price: p.price,
            packageDuration: (p as any).packageDuration || 30,
          })),
        },
      });
      if (error) throw error;
      setSuggestion(data?.suggestion || "No suggestion available.");
    } catch (err: any) {
      console.error("[AiInsight] Error:", err);
      toast({
        title: "AI Error",
        description: err.message || "Failed to get AI suggestion",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [customerName, productTitle, productPrice, stepNumber, selectedProblems, quickInfoSummary, products, toast]);

  const handleCopy = () => {
    navigator.clipboard.writeText(suggestion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "AI suggestion copied to clipboard." });
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-primary">AI Sales Assistant</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
          onClick={fetchInsight}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <BrainCircuit className="h-3 w-3" />
          )}
          {loading ? "Analyzing..." : suggestion ? "Refresh" : "Get AI Insight"}
        </Button>
      </div>

      {!suggestion && !loading && (
        <p className="text-xs text-muted-foreground">
          Select problems and fill customer info, then click "Get AI Insight" for smart recommendations.
        </p>
      )}

      {suggestion && (
        <div className="space-y-2">
          <div className="rounded-md bg-background p-3 text-xs prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{suggestion}</ReactMarkdown>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy Script"}
          </Button>
        </div>
      )}
    </div>
  );
}
