import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Receipt {
  id: string;
  store_name: string;
  total_amount: number;
  purchase_date: string;
  category: string;
  sustainability_score: string;
  image_url?: string;
  created_at: string;
}

interface ReceiptItem {
  id: string;
  receipt_id: string;
  item_name: string;
  category: string;
  price: number;
  quantity: number;
}

export function useReceipts() {
  const { user, session } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchReceipts = async () => {
    if (!user) {
      setReceipts([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching receipts:', error);
        return;
      }

      setReceipts(data || []);
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [user]);

  const processReceipt = async (imageBase64: string, fileName?: string) => {
    // Get fresh session to ensure we have a valid token
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !currentSession?.access_token) {
      throw new Error('Not authenticated - please sign in again');
    }

    if (!imageBase64 || imageBase64.trim() === '') {
      throw new Error('Image data is required');
    }

    setProcessing(true);
    
    try {
      // Validate base64 string before sending
      try {
        atob(imageBase64);
      } catch (e) {
        throw new Error('Invalid image data format');
      }

      const requestBody = {
        imageBase64: imageBase64.trim(),
        fileName: fileName || `receipt-${Date.now()}.jpg`
      };

      console.log('Sending fetch request with:', {
        bodyLength: JSON.stringify(requestBody).length,
        imageBase64Length: requestBody.imageBase64.length,
        fileName: requestBody.fileName,
        hasAccessToken: !!currentSession.access_token
      });

      // Use native fetch with all required headers
      const response = await fetch('https://qjzrmjbavocerdswrkyb.supabase.co/functions/v1/process-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqenJtamJhdm9jZXJkc3dya3liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2MjI2OTcsImV4cCI6MjA3MjE5ODY5N30.WGIfJwPS-LWZyKXmu07hjh65HzcQVcx_w_pXV4cC1Aw'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Processing successful:', data);

      // Refresh receipts list
      await fetchReceipts();
      
      return data;
    } catch (error) {
      console.error('Error processing receipt:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          throw new Error('Authentication failed - please sign in again');
        } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
          throw new Error('Invalid image data - please try a different image');
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          throw new Error('Access denied - check your permissions');
        } else if (error.message.includes('timeout')) {
          throw new Error('Processing timed out - please try again');
        }
      }
      
      throw error;
    } finally {
      setProcessing(false);
    }
  };

  const getReceiptItems = async (receiptId: string): Promise<ReceiptItem[]> => {
    if (!user) {
      console.log('getReceiptItems: No user, returning empty array');
      return [];
    }

    console.log('getReceiptItems: Fetching items for receipt:', receiptId);
    try {
      const { data, error } = await supabase
        .from('receipt_items')
        .select('*')
        .eq('receipt_id', receiptId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('getReceiptItems: Supabase error:', error);
        return [];
      }

      console.log('getReceiptItems: Raw data from Supabase:', data);
      console.log('getReceiptItems: Returning', data?.length || 0, 'items');
      return data || [];
    } catch (error) {
      console.error('getReceiptItems: Catch error:', error);
      return [];
    }
  };

  const calculateTotalSpending = (timeframe: 'week' | 'month' = 'week'): number => {
    const now = new Date();
    const cutoff = new Date(now);
    
    if (timeframe === 'week') {
      cutoff.setDate(now.getDate() - 7);
    } else {
      cutoff.setMonth(now.getMonth() - 1);
    }

    return receipts
      .filter(receipt => new Date(receipt.created_at) >= cutoff)
      .reduce((total, receipt) => total + (receipt.total_amount || 0), 0);
  };

  const calculateAverageSustainabilityScore = (): number => {
    if (receipts.length === 0) return 0;
    
    const scores = receipts
      .map(receipt => parseInt(receipt.sustainability_score || '0'))
      .filter(score => !isNaN(score));
    
    if (scores.length === 0) return 0;
    
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return Math.round(average);
  };

  return {
    receipts,
    loading,
    processing,
    processReceipt,
    getReceiptItems,
    fetchReceipts,
    calculateTotalSpending,
    calculateAverageSustainabilityScore,
  };
}