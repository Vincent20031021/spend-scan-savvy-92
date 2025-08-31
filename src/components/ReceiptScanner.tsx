import { useState, useRef } from "react";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, Scan, Receipt, TrendingUp, Leaf, LogOut, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useReceipts } from "@/hooks/useReceipts";
import ReceiptDetailModal from "./ReceiptDetailModal";

const ReceiptScanner = () => {
  const { user, signOut } = useAuth();
  const { 
    receipts, 
    loading, 
    processing, 
    processReceipt, 
    calculateTotalSpending, 
    calculateAverageSustainabilityScore 
  } = useReceipts();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Redirect to auth if not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "Today";
    if (diffDays === 2) return "Yesterday";
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString();
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:image/jpeg;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileUpload = async (file: File) => {
    try {
      const base64 = await convertFileToBase64(file);
      const result = await processReceipt(base64, file.name);
      
      toast({
        title: "Receipt processed! 🎉",
        description: `Processed receipt from ${result.receipt?.store_name || 'Unknown Store'}`,
      });
    } catch (error) {
      console.error('Error processing receipt:', error);
      toast({
        title: "Processing failed",
        description: "There was an error processing your receipt. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleScanReceipt = () => {
    // Trigger camera functionality (would require camera API)
    toast({
      title: "Camera not available",
      description: "Please use the upload option to select a receipt image.",
    });
  };

  const handleUploadReceipt = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleReceiptClick = (receipt: any) => {
    setSelectedReceipt(receipt);
    setDetailModalOpen(true);
  };

  const totalSpending = calculateTotalSpending('week');
  const avgSustainabilityScore = calculateAverageSustainabilityScore();

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="text-center flex-1">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full mb-4">
              <Receipt className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Receipt Scanner</h1>
            <p className="text-white/80 text-lg">Track your spending effortlessly</p>
          </div>
          
          {/* User Menu */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={signOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 animate-fade-in">
            <CardContent className="p-4 text-center">
              <div className="text-xl font-bold text-white">
                ${totalSpending.toFixed(2)}
              </div>
              <div className="text-white/70 text-xs">This Week</div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 animate-fade-in">
            <CardContent className="p-4 text-center">
              <div className="text-xl font-bold text-white">{receipts.length}</div>
              <div className="text-white/70 text-xs">Receipts</div>
            </CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 animate-fade-in">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <Leaf className="w-4 h-4 text-sustainability-good" />
                <div className="text-xl font-bold text-sustainability-good">
                  {getSustainabilityGrade(avgSustainabilityScore)}
                </div>
              </div>
              <div className="text-white/70 text-xs">Eco Score</div>
            </CardContent>
          </Card>
        </div>

        {/* Scan Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Button
            onClick={handleScanReceipt}
            disabled={processing}
            className={`h-24 bg-white/20 backdrop-blur-sm border-white/30 hover:bg-white/30 text-white font-semibold transition-all duration-300 hover:scale-105 active:scale-95 ${
              processing ? 'animate-pulse-scale' : ''
            }`}
            variant="outline"
          >
            <div className="flex flex-col items-center gap-2">
              {processing ? (
                <div className="relative">
                  <Scan className="w-6 h-6 animate-spin" />
                  <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
                </div>
              ) : (
                <Camera className="w-6 h-6" />
              )}
              <span>{processing ? "Processing..." : "Scan Receipt"}</span>
            </div>
          </Button>
          
          <Button
            onClick={handleUploadReceipt}
            disabled={processing}
            className="h-24 bg-white/20 backdrop-blur-sm border-white/30 hover:bg-white/30 text-white font-semibold transition-all duration-300 hover:scale-105 active:scale-95"
            variant="outline"
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-6 h-6" />
              <span>Upload Image</span>
            </div>
          </Button>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

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
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-4">Loading receipts...</p>
              </div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No receipts yet. Upload your first receipt!</p>
              </div>
            ) : (
              receipts.map((receipt, index) => (
                <div 
                  key={receipt.id} 
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-all duration-200 hover:scale-[1.02] animate-fade-in cursor-pointer"
                  style={{ animationDelay: `${index * 100}ms` }}
                  onClick={() => handleReceiptClick(receipt)}
                >
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">{receipt.store_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(receipt.created_at)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Leaf className="w-3 h-3" />
                      <span className={`text-xs font-medium ${getSustainabilityColor(parseInt(receipt.sustainability_score || '0'))}`}>
                        Eco Score: {getSustainabilityGrade(parseInt(receipt.sustainability_score || '0'))} ({receipt.sustainability_score}%)
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">${receipt.total_amount?.toFixed(2) || '0.00'}</div>
                    <Badge 
                      className={`text-xs text-white ${categoryColors[receipt.category as keyof typeof categoryColors] || 'bg-secondary'}`}
                    >
                      {receipt.category}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Bottom Navigation Placeholder */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-border/20 p-4">
          <div className="flex justify-center">
            <Button variant="ghost" className="text-muted-foreground">
              <User className="w-4 h-4 mr-2" />
              Welcome, {user.email}
            </Button>
          </div>
        </div>

        {/* Receipt Detail Modal */}
        <ReceiptDetailModal 
          receipt={selectedReceipt}
          isOpen={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedReceipt(null);
          }}
        />
      </div>
    </div>
  );
};

export default ReceiptScanner;