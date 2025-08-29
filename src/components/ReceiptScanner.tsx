import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, Scan, Receipt, TrendingUp, Leaf, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ReceiptScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [recentReceipts, setRecentReceipts] = useState([
    {
      id: 1,
      store: "Whole Foods Market",
      total: 47.82,
      items: 8,
      date: "Today",
      category: "Groceries",
      sustainabilityScore: 85
    },
    {
      id: 2,
      store: "Target",
      total: 23.15,
      items: 3,
      date: "Yesterday", 
      category: "Household",
      sustainabilityScore: 62
    },
    {
      id: 3,
      store: "Starbucks",
      total: 12.45,
      items: 2,
      date: "2 days ago", 
      category: "Dining",
      sustainabilityScore: 40
    }
  ]);

  const categoryColors = {
    "Groceries": "bg-category-groceries",
    "Household": "bg-category-household", 
    "Personal Care": "bg-category-personal-care",
    "Electronics": "bg-category-electronics",
    "Clothing": "bg-category-clothing",
    "Dining": "bg-category-dining"
  };

  const getSustainabilityColor = (score: number) => {
    if (score >= 80) return "text-sustainability-excellent";
    if (score >= 60) return "text-sustainability-good";
    if (score >= 40) return "text-sustainability-fair";
    return "text-sustainability-poor";
  };

  const getSustainabilityGrade = (score: number) => {
    if (score >= 80) return "A";
    if (score >= 60) return "B";
    if (score >= 40) return "C";
    return "D";
  };
  
  const { toast } = useToast();

  const handleScanReceipt = () => {
    setIsScanning(true);
    // Simulate scanning process with enhanced feedback
    setTimeout(() => {
      setIsScanning(false);
      toast({
        title: "Receipt processed! 🎉",
        description: "Your receipt has been scanned, categorized, and sustainability score calculated.",
      });
      
      // Add a new receipt to simulate the scan result
      const newReceipt = {
        id: Date.now(),
        store: "Fresh Market",
        total: 32.67,
        items: 6,
        date: "Just now",
        category: "Groceries",
        sustainabilityScore: Math.floor(Math.random() * 40) + 60 // Random score 60-100
      };
      setRecentReceipts(prev => [newReceipt, ...prev]);
    }, 2000);
  };

  const handleUploadReceipt = () => {
    toast({
      title: "Upload receipt",
      description: "Select an image from your gallery to process.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full mb-4">
            <Receipt className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Receipt Scanner</h1>
          <p className="text-white/80 text-lg">Track your spending effortlessly</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 animate-fade-in">
            <CardContent className="p-4 text-center">
              <div className="text-xl font-bold text-white">$142.67</div>
              <div className="text-white/70 text-xs">This Week</div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 animate-fade-in">
            <CardContent className="p-4 text-center">
              <div className="text-xl font-bold text-white">23</div>
              <div className="text-white/70 text-xs">Receipts</div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 animate-fade-in">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <Leaf className="w-4 h-4 text-sustainability-good" />
                <div className="text-xl font-bold text-sustainability-good">B+</div>
              </div>
              <div className="text-white/70 text-xs">Eco Score</div>
            </CardContent>
          </Card>
        </div>

        {/* Scan Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Button
            onClick={handleScanReceipt}
            disabled={isScanning}
            className={`h-24 bg-white/20 backdrop-blur-sm border-white/30 hover:bg-white/30 text-white font-semibold transition-all duration-300 hover:scale-105 active:scale-95 ${
              isScanning ? 'animate-pulse-scale' : ''
            }`}
            variant="outline"
          >
            <div className="flex flex-col items-center gap-2">
              {isScanning ? (
                <div className="relative">
                  <Scan className="w-6 h-6 animate-spin" />
                  <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
                </div>
              ) : (
                <Camera className="w-6 h-6" />
              )}
              <span>{isScanning ? "Scanning..." : "Scan Receipt"}</span>
            </div>
          </Button>
          
          <Button
            onClick={handleUploadReceipt}
            className="h-24 bg-white/20 backdrop-blur-sm border-white/30 hover:bg-white/30 text-white font-semibold transition-all duration-300 hover:scale-105 active:scale-95"
            variant="outline"
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-6 h-6" />
              <span>Upload Image</span>
            </div>
          </Button>
        </div>

        {/* Recent Receipts */}
        <Card className="bg-white/95 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Recent Receipts
            </CardTitle>
            <CardDescription>Your latest spending activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentReceipts.map((receipt, index) => (
              <div 
                key={receipt.id} 
                className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-all duration-200 hover:scale-[1.02] animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex-1">
                  <div className="font-semibold text-foreground">{receipt.store}</div>
                  <div className="text-sm text-muted-foreground">{receipt.items} items • {receipt.date}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Leaf className="w-3 h-3" />
                    <span className={`text-xs font-medium ${getSustainabilityColor(receipt.sustainabilityScore)}`}>
                      Eco Score: {getSustainabilityGrade(receipt.sustainabilityScore)} ({receipt.sustainabilityScore}%)
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">${receipt.total}</div>
                  <Badge 
                    className={`text-xs text-white ${categoryColors[receipt.category as keyof typeof categoryColors] || 'bg-secondary'}`}
                  >
                    {receipt.category}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Bottom Navigation Placeholder */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-border/20 p-4">
          <div className="flex justify-center">
            <Button variant="ghost" className="text-muted-foreground">
              More features coming with Supabase integration...
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptScanner;