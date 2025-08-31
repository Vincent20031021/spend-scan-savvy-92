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
    if (!session) {
      throw new Error('Not authenticated');
    }

    setProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('process-receipt', {
        body: { imageBase64, fileName },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error processing receipt:', error);
        throw error;
      }

      // Refresh receipts list
      await fetchReceipts();
      
      return data;
    } catch (error) {
      console.error('Error processing receipt:', error);
      throw error;
    } finally {
      setProcessing(false);
    }
  };

  const getReceiptItems = async (receiptId: string): Promise<ReceiptItem[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('receipt_items')
        .select('*')
        .eq('receipt_id', receiptId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching receipt items:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching receipt items:', error);
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