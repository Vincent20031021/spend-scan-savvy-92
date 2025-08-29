import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, Scan, Receipt, TrendingUp } from "lucide-react";
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
      category: "Groceries"
    },
    {
      id: 2,
      store: "Target",
      total: 23.15,
      items: 3,
      date: "Yesterday", 
      category: "Household"
    }
  ]);
  
  const { toast } = useToast();

  const handleScanReceipt = () => {
    setIsScanning(true);
    // Simulate scanning process
    setTimeout(() => {
      setIsScanning(false);
      toast({
        title: "Receipt processed!",
        description: "Your receipt has been scanned and categorized.",
      });
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
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-white">$142.67</div>
              <div className="text-white/70 text-sm">This Week</div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-white">23</div>
              <div className="text-white/70 text-sm">Receipts</div>
            </CardContent>
          </Card>
        </div>

        {/* Scan Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Button
            onClick={handleScanReceipt}
            disabled={isScanning}
            className="h-24 bg-white/20 backdrop-blur-sm border-white/30 hover:bg-white/30 text-white font-semibold"
            variant="outline"
          >
            <div className="flex flex-col items-center gap-2">
              {isScanning ? (
                <Scan className="w-6 h-6 animate-pulse" />
              ) : (
                <Camera className="w-6 h-6" />
              )}
              <span>{isScanning ? "Scanning..." : "Scan Receipt"}</span>
            </div>
          </Button>
          
          <Button
            onClick={handleUploadReceipt}
            className="h-24 bg-white/20 backdrop-blur-sm border-white/30 hover:bg-white/30 text-white font-semibold"
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
            {recentReceipts.map((receipt) => (
              <div key={receipt.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <div className="font-semibold text-foreground">{receipt.store}</div>
                  <div className="text-sm text-muted-foreground">{receipt.items} items • {receipt.date}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">${receipt.total}</div>
                  <Badge variant="secondary" className="text-xs">
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