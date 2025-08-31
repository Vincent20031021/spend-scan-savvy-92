import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleVisionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      throw new Error('No authorization header');
    }

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authorization.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { imageBase64, fileName } = await req.json();

    if (!imageBase64) {
      throw new Error('No image provided');
    }

    console.log('Processing receipt for user:', user.id);

    // Upload image to Supabase Storage
    const imageBuffer = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
    const imagePath = `${user.id}/${fileName || `receipt-${Date.now()}.jpg`}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipt-images')
      .upload(imagePath, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload image');
    }

    console.log('Image uploaded:', uploadData.path);

    // Process image with Google Vision API
    let extractedData = null;
    
    if (googleVisionApiKey) {
      try {
        const visionResponse = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${googleVisionApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requests: [{
                image: { content: imageBase64 },
                features: [
                  { type: 'TEXT_DETECTION', maxResults: 1 },
                  { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }
                ]
              }]
            })
          }
        );

        const visionData = await visionResponse.json();
        
        if (visionData.responses && visionData.responses[0] && visionData.responses[0].textAnnotations) {
          const fullText = visionData.responses[0].textAnnotations[0]?.description || '';
          extractedData = parseReceiptText(fullText);
          console.log('Extracted data:', extractedData);
        }
      } catch (error) {
        console.error('Vision API error:', error);
        // Continue without OCR if Vision API fails
      }
    }

    // Get image URL
    const { data: { publicUrl } } = supabase.storage
      .from('receipt-images')
      .getPublicUrl(imagePath);

    // Create receipt record
    const receiptData = {
      user_id: user.id,
      store_name: extractedData?.storeName || 'Unknown Store',
      total_amount: extractedData?.totalAmount || 0,
      purchase_date: extractedData?.date || new Date().toISOString().split('T')[0],
      currency: extractedData?.currency || 'USD',
      category: extractedData?.category || 'Other',
      sustainability_score: calculateSustainabilityScore(extractedData?.items || []).toString(),
      image_url: publicUrl,
      raw_text: extractedData?.rawText || ''
    };

    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert(receiptData)
      .select()
      .single();

    if (receiptError) {
      console.error('Receipt insert error:', receiptError);
      throw new Error('Failed to create receipt');
    }

    console.log('Receipt created:', receipt.id);

    // Insert receipt items if extracted
    if (extractedData?.items && extractedData.items.length > 0) {
      const items = extractedData.items.map((item: any) => ({
        receipt_id: receipt.id,
        item_name: item.name,
        category: item.category || 'Other',
        price: item.price || 0,
        quantity: item.quantity || 1
      }));

      const { error: itemsError } = await supabase
        .from('receipt_items')
        .insert(items);

      if (itemsError) {
        console.error('Items insert error:', itemsError);
      } else {
        console.log(`Inserted ${items.length} items`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      receipt,
      extractedData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-receipt function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function parseReceiptText(text: string) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  console.log('Parsing receipt text, total lines:', lines.length);
  
  // Extract store name (usually first few lines)
  const storeName = lines.slice(0, 5).find(line => 
    !line.match(/^\d/) && 
    line.length > 2 && 
    !line.toLowerCase().includes('receipt') &&
    !line.match(/^[\d\W]+$/) // Not just numbers and special chars
  ) || 'Unknown Store';

  console.log('Extracted store name:', storeName);

  // Extract total amount - improved regex patterns
  const totalPatterns = [
    /total[:\s]+\$?([\d,]+\.?\d*)/i,
    /amount[:\s]+\$?([\d,]+\.?\d*)/i,
    /sum[:\s]+\$?([\d,]+\.?\d*)/i,
    /grand\s+total[:\s]+\$?([\d,]+\.?\d*)/i,
    /balance[:\s]+\$?([\d,]+\.?\d*)/i,
    /\$?([\d,]+\.\d{2})(?:\s|$)/  // Any dollar amount with 2 decimals
  ];
  
  let totalAmount = 0;
  for (const line of lines.slice(-10)) { // Check last 10 lines for total
    for (const pattern of totalPatterns) {
      const match = line.match(pattern);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (amount > totalAmount && amount < 10000) { // Sanity check
          totalAmount = amount;
        }
      }
    }
  }

  console.log('Extracted total amount:', totalAmount);

  // Extract date - improved patterns
  const datePatterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}/i
  ];
  
  let date = null;
  for (const pattern of datePatterns) {
    const dateMatch = text.match(pattern);
    if (dateMatch) {
      try {
        const parsedDate = new Date(dateMatch[0]);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate.toISOString().split('T')[0];
          break;
        }
      } catch (e) {
        console.log('Date parsing error:', e);
      }
    }
  }
  
  if (!date) {
    date = new Date().toISOString().split('T')[0];
  }

  console.log('Extracted date:', date);

  // Extract items - improved patterns
  const items = [];
  const itemPatterns = [
    /^(.+?)\s+\$?([\d,]+\.?\d{0,2})$/,  // Item name followed by price
    /^(.+?)\s{2,}\$?([\d,]+\.?\d{0,2})$/,  // With multiple spaces
    /^(.+?)\t+\$?([\d,]+\.?\d{0,2})$/,  // With tabs
    /^([\w\s]+)\s+(\d+)\s+@\s+\$?([\d,]+\.?\d{0,2})/,  // With quantity format
  ];
  
  for (const line of lines) {
    // Skip lines that are likely headers or totals
    if (line.toLowerCase().match(/(total|tax|subtotal|balance|change|payment|cash|credit|debit)/)) {
      continue;
    }
    
    for (const pattern of itemPatterns) {
      const match = line.match(pattern);
      if (match) {
        let price = 0;
        let name = '';
        
        if (match.length === 3) {
          name = match[1].trim();
          price = parseFloat(match[2].replace(/,/g, ''));
        } else if (match.length === 4) {
          // Quantity format
          name = match[1].trim();
          const qty = parseInt(match[2]);
          const unitPrice = parseFloat(match[3].replace(/,/g, ''));
          price = qty * unitPrice;
        }
        
        // Validate item
        if (name.length > 2 && price > 0 && price < (totalAmount || 1000)) {
          items.push({
            name: name.substring(0, 100), // Limit name length
            price: price,
            category: categorizeItem(name),
            quantity: 1
          });
          break; // Found a match, move to next line
        }
      }
    }
  }

  console.log('Extracted items:', items.length);

  // Determine category based on store or items
  const category = determineReceiptCategory(storeName, items);

  // If we didn't find a total but have items, sum them up
  if (totalAmount === 0 && items.length > 0) {
    totalAmount = items.reduce((sum, item) => sum + item.price, 0);
    console.log('Calculated total from items:', totalAmount);
  }

  return {
    storeName: storeName.replace(/[^a-zA-Z0-9\s&'-]/g, '').trim().substring(0, 100),
    totalAmount: Math.round(totalAmount * 100) / 100, // Round to 2 decimals
    date,
    items,
    category,
    currency: 'USD',
    rawText: text.substring(0, 5000) // Limit raw text size
  };
}

function categorizeItem(itemName: string): string {
  const name = itemName.toLowerCase();
  
  if (name.includes('coffee') || name.includes('tea') || name.includes('drink') || 
      name.includes('soda') || name.includes('juice')) {
    return 'Dining';
  }
  
  if (name.includes('bread') || name.includes('milk') || name.includes('egg') ||
      name.includes('fruit') || name.includes('vegetable') || name.includes('meat')) {
    return 'Groceries';
  }
  
  if (name.includes('soap') || name.includes('detergent') || name.includes('clean') ||
      name.includes('tissue') || name.includes('paper')) {
    return 'Household';
  }
  
  if (name.includes('shampoo') || name.includes('toothpaste') || name.includes('lotion') ||
      name.includes('deodorant')) {
    return 'Personal Care';
  }
  
  return 'Other';
}

function determineReceiptCategory(storeName: string, items: any[]): string {
  const name = storeName.toLowerCase();
  
  if (name.includes('starbucks') || name.includes('coffee') || name.includes('restaurant') ||
      name.includes('cafe') || name.includes('food')) {
    return 'Dining';
  }
  
  if (name.includes('whole foods') || name.includes('grocery') || name.includes('market') ||
      name.includes('supermarket') || name.includes('kroger') || name.includes('safeway')) {
    return 'Groceries';
  }
  
  if (name.includes('target') || name.includes('walmart') || name.includes('costco')) {
    return 'Household';
  }
  
  if (name.includes('best buy') || name.includes('electronic') || name.includes('apple store')) {
    return 'Electronics';
  }
  
  if (name.includes('macy') || name.includes('clothing') || name.includes('fashion') ||
      name.includes('apparel')) {
    return 'Clothing';
  }
  
  // Categorize based on items if store category is unclear
  if (items.length > 0) {
    const categories = items.map(item => item.category);
    const categoryCount = categories.reduce((acc: any, cat: string) => {
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});
    
    return Object.keys(categoryCount).reduce((a, b) => 
      categoryCount[a] > categoryCount[b] ? a : b
    );
  }
  
  return 'Other';
}

function calculateSustainabilityScore(items: any[]): number {
  if (items.length === 0) return 50;
  
  let score = 60; // Base score
  
  // Boost score for organic, eco-friendly items
  const ecoKeywords = ['organic', 'eco', 'sustainable', 'green', 'natural', 'biodegradable'];
  const ecoItems = items.filter(item => 
    ecoKeywords.some(keyword => item.name.toLowerCase().includes(keyword))
  );
  
  score += (ecoItems.length / items.length) * 30;
  
  // Reduce score for processed/packaged items
  const processedKeywords = ['plastic', 'processed', 'artificial', 'synthetic'];
  const processedItems = items.filter(item => 
    processedKeywords.some(keyword => item.name.toLowerCase().includes(keyword))
  );
  
  score -= (processedItems.length / items.length) * 20;
  
  // Cap score between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}