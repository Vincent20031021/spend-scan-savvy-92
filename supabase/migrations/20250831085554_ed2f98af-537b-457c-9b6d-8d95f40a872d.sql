-- Enable Row Level Security on receipts table
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for receipts table
CREATE POLICY "Users can view their own receipts" 
ON public.receipts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own receipts" 
ON public.receipts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipts" 
ON public.receipts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own receipts" 
ON public.receipts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create items table for receipt line items
CREATE TABLE public.receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT,
  price NUMERIC,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on receipt_items
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for receipt_items (users can access items for their receipts)
CREATE POLICY "Users can view their own receipt items" 
ON public.receipt_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.receipts 
  WHERE receipts.id = receipt_items.receipt_id 
  AND receipts.user_id = auth.uid()
));

CREATE POLICY "Users can insert items for their own receipts" 
ON public.receipt_items 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.receipts 
  WHERE receipts.id = receipt_items.receipt_id 
  AND receipts.user_id = auth.uid()
));

CREATE POLICY "Users can update items for their own receipts" 
ON public.receipt_items 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.receipts 
  WHERE receipts.id = receipt_items.receipt_id 
  AND receipts.user_id = auth.uid()
));

CREATE POLICY "Users can delete items for their own receipts" 
ON public.receipt_items 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.receipts 
  WHERE receipts.id = receipt_items.receipt_id 
  AND receipts.user_id = auth.uid()
));

-- Add indexes for performance
CREATE INDEX idx_receipt_items_receipt_id ON public.receipt_items(receipt_id);
CREATE INDEX idx_receipts_user_id ON public.receipts(user_id);
CREATE INDEX idx_receipts_purchase_date ON public.receipts(purchase_date);