import { useState, useRef } from "react";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, Scan, Receipt, TrendingUp, Leaf, LogOut, User, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useReceipts } from "@/hooks/useReceipts";
import ReceiptDetailModal from "./ReceiptDetailModal";
import { CategoryPieChart } from "./CategoryPieChart";
import BudgetCategories from "./BudgetCategories";

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
      // Validate file type
      if (!file.type.startsWith('image/')) {
        reject(new Error('File must be an image'));
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        reject(new Error('File size must be less than 10MB'));
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const result = event.target?.result as string;
          if (!result) {
            reject(new Error('Failed to read file'));
            return;
          }
          
          // Extract base64 data after the comma
          const base64Data = result.split(',')[1];
          if (!base64Data) {
            reject(new Error('Invalid base64 data'));
            return;
          }
          
          // Validate base64 string
          try {
            atob(base64Data);
            resolve(base64Data);
          } catch (e) {
            reject(new Error('Invalid base64 encoding'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.onabort = () => {
        reject(new Error('File reading was aborted'));
      };
      
      // Read file as data URL
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (file: File) => {
    console.log('Starting file upload for:', file.name, 'Type:', file.type, 'Size:', file.size);
    
    try {
      console.log('Converting file to base64...');
      const base64 = await convertFileToBase64(file);
      console.log('Base64 conversion successful, length:', base64.length);
      
      console.log('Calling processReceipt...');
      const result = await processReceipt(base64, file.name);
      console.log('processReceipt completed successfully:', result);
      
      toast({
        title: "Receipt processed! 🎉",
        description: `Processed receipt from ${result.receipt?.store_name || 'Unknown Store'}`,
      });
    } catch (error) {
      console.error('Error processing receipt:', error);
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "There was an error processing your receipt. Please try again.",
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
    console.log('Upload button clicked, file input ref:', fileInputRef.current);
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed, files:', event.target.files);
    const file = event.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name, file.type, file.size);
      handleFileUpload(file);
    } else {
      console.log('No file selected');
    }
  };

  const handleReceiptClick = (receipt: any) => {
    setSelectedReceipt(receipt);
    setDetailModalOpen(true);
  };

  const totalSpending = calculateTotalSpending('week');
  const avgSustainabilityScore = calculateAverageSustainabilityScore();

  return (
    <div className="min-h-screen bg-gradient-mint">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Budget Tracker</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Welcome Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-1">
            Welcome, {user.email?.split('@')[0]}!
          </h2>
        </div>

        {/* Balance and Expense Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-card shadow-soft border-border/50">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Total Balance</div>
              <div className="text-2xl font-bold text-foreground">
                ${(7783 - totalSpending).toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card shadow-soft border-border/50">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Total Expense
              </div>
              <div className="text-2xl font-bold text-primary">
                -${totalSpending.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Budget Progress */}
        <Card className="bg-card shadow-soft border-border/50 mb-6">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <div className="text-lg font-semibold">Budget Progress</div>
              <div className="text-lg font-bold text-primary">$1,000.00</div>
            </div>
            <div className="w-full bg-muted rounded-full h-3 mb-2">
              <div 
                className="bg-primary h-3 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min((totalSpending / 1000) * 100, 100)}%` }}
              ></div>
            </div>
            <div className="text-sm text-muted-foreground">
              {((totalSpending / 1000) * 100).toFixed(0)}% of your expenses. Looking good!
            </div>
          </CardContent>
        </Card>

        {/* Budget Categories and Sustainability Score */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <BudgetCategories totalSpent={totalSpending} receipts={receipts} />
          </div>
          
          <Card className="bg-card shadow-soft border-border/50">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="w-full h-full bg-primary/10 rounded-full flex items-center justify-center">
                  <Leaf className="w-8 h-8 text-primary" />
                </div>
                <div className="absolute inset-0 border-4 border-primary rounded-full" 
                     style={{ 
                       background: `conic-gradient(hsl(var(--primary)) ${(avgSustainabilityScore / 100) * 360}deg, hsl(var(--muted)) 0deg)` 
                     }}>
                </div>
              </div>
              <div className="text-lg font-semibold text-foreground mb-1">Sustainability</div>
              <div className="text-sm text-muted-foreground">On Goals</div>
              <div className="text-2xl font-bold text-primary mt-2">
                {getSustainabilityGrade(avgSustainabilityScore)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scan Actions */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Button
            onClick={handleScanReceipt}
            disabled={processing}
            className={`h-20 bg-card shadow-soft hover:shadow-elegant border-border/50 text-foreground font-semibold transition-all duration-300 hover:scale-[1.02] ${
              processing ? 'animate-pulse-scale' : ''
            }`}
            variant="outline"
          >
            <div className="flex flex-col items-center gap-2">
              {processing ? (
                <div className="relative">
                  <Scan className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <Camera className="w-6 h-6 text-primary" />
              )}
              <span>{processing ? "Processing..." : "Scan Receipt"}</span>
            </div>
          </Button>
          
          <Button
            onClick={handleUploadReceipt}
            disabled={processing}
            className="h-20 bg-card shadow-soft hover:shadow-elegant border-border/50 text-foreground font-semibold transition-all duration-300 hover:scale-[1.02]"
            variant="outline"
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-6 h-6 text-primary" />
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card shadow-soft border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <TrendingUp className="w-5 h-5 text-primary" />
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
                receipts.slice(0, 5).map((receipt, index) => (
                  <div 
                    key={receipt.id} 
                    className="flex items-center justify-between p-4 bg-background/50 rounded-lg hover:bg-background/70 transition-all duration-200 hover:scale-[1.02] animate-fade-in cursor-pointer border border-border/30"
                    style={{ animationDelay: `${index * 100}ms` }}
                    onClick={() => handleReceiptClick(receipt)}
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-foreground">
                        {receipt.store_name || 'Unknown Store'}
                        {!receipt.store_name && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">⚠️</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(receipt.created_at)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Leaf className="w-3 h-3" />
                        <span className={`text-xs font-medium ${getSustainabilityColor(parseInt(receipt.sustainability_score || '0'))}`}>
                          Eco Score: {getSustainabilityGrade(parseInt(receipt.sustainability_score || '0'))} ({receipt.sustainability_score || '0'}%)
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        ${receipt.total_amount ? receipt.total_amount.toFixed(2) : '0.00'}
                        {(!receipt.total_amount || receipt.total_amount === 0) && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">⚠️</span>
                        )}
                      </div>
                      <Badge 
                        className={`text-xs text-white ${categoryColors[receipt.category as keyof typeof categoryColors] || 'bg-secondary'}`}
                      >
                        {receipt.category || 'Other'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
              {receipts.length > 5 && (
                <div className="text-center pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing 5 of {receipts.length} receipts
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Pie Chart */}
          <CategoryPieChart />
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

        {/* Floating Action Button */}
        <div className="fixed bottom-6 right-6">
          <Button
            onClick={handleUploadReceipt}
            size="lg"
            className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 shadow-elegant"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptScanner;