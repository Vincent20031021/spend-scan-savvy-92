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

console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
console.log('SUPABASE_URL present:', !!supabaseUrl);
console.log('SUPABASE_SERVICE_ROLE_KEY present:', !!supabaseServiceKey);
console.log('GOOGLE_VISION_API_KEY present:', !!googleVisionApiKey);
console.log('GOOGLE_VISION_API_KEY length:', googleVisionApiKey?.length || 0);
console.log('All env vars:', Object.keys(Deno.env.toObject()).filter(key => key.includes('GOOGLE') || key.includes('VISION')));
console.log('=====================================');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== PROCESS-RECEIPT FUNCTION STARTED ===');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      console.error('CRITICAL ERROR: No authorization header found');
      throw new Error('No authorization header');
    }
    
    console.log('Authorization header present, length:', authorization.length);

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authorization.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('CRITICAL ERROR: Authentication failed:', authError);
      throw new Error('Unauthorized');
    }
    
    console.log('User authenticated successfully:', user.id);

    // Parse request body
    let requestBody;
    try {
      const bodyText = await req.text();
      console.log('Raw request body length:', bodyText.length);
      console.log('Request body preview (first 200 chars):', bodyText.substring(0, 200));
      
      if (!bodyText || bodyText.trim() === '') {
        console.error('CRITICAL ERROR: Request body is completely empty');
        throw new Error('Request body is empty');
      }
      
      requestBody = JSON.parse(bodyText);
      console.log('Request body parsed successfully, keys:', Object.keys(requestBody));
    } catch (parseError) {
      console.error('CRITICAL ERROR: Failed to parse JSON body:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    const { imageBase64, fileName } = requestBody;

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
        upsert: true  // Allow overwrite to avoid conflicts
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload image');
    }

    console.log('Image uploaded:', uploadData.path);

    // Process image with Google Vision API
    let extractedData = null;
    
    if (!googleVisionApiKey) {
      console.error('CRITICAL ERROR: Google Vision API key not configured');
      throw new Error('Google Vision API key not configured');
    }
    
    console.log('API Key length:', googleVisionApiKey.length);
    console.log('API Key prefix:', googleVisionApiKey.substring(0, 10) + '...');

    try {
      console.log('Calling Google Vision API with base64 length:', imageBase64.length);
      
      // Validate base64 string
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        throw new Error('Invalid base64 image data');
      }
      
      // Remove data URL prefix if present
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      
      const requestBody = {
        requests: [{
          image: { 
            content: cleanBase64 
          },
          features: [
            { 
              type: 'DOCUMENT_TEXT_DETECTION',
              maxResults: 1 
            }
          ],
          imageContext: {
            languageHints: ['en']
          }
        }]
      };
      
      console.log('Vision API request structure:', {
        requestCount: requestBody.requests.length,
        hasImage: !!requestBody.requests[0].image.content,
        imageDataLength: requestBody.requests[0].image.content.length,
        features: requestBody.requests[0].features
      });
      
      const visionResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${googleVisionApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      console.log('Vision API response status:', visionResponse.status);
      console.log('Vision API response headers:', Object.fromEntries(visionResponse.headers.entries()));

      if (!visionResponse.ok) {
        const errorText = await visionResponse.text();
        console.error('Vision API HTTP error details:');
        console.error('Status:', visionResponse.status);
        console.error('Status Text:', visionResponse.statusText); 
        console.error('Response:', errorText);
        throw new Error(`Vision API error: ${visionResponse.status} - ${errorText}`);
      }

      const visionData = await visionResponse.json();
      
      // Log response structure without the full content
      console.log('Vision API response structure:', {
        hasResponses: !!visionData.responses,
        responseCount: visionData.responses?.length || 0,
        hasTextAnnotations: !!(visionData.responses?.[0]?.textAnnotations),
        annotationCount: visionData.responses?.[0]?.textAnnotations?.length || 0,
        hasError: !!visionData.error
      });
      
      if (visionData.error) {
        console.error('Vision API returned error:', visionData.error);
        throw new Error(`Vision API error: ${visionData.error.message}`);
      }
      
      if (visionData.responses && visionData.responses[0] && visionData.responses[0].textAnnotations) {
        const fullText = visionData.responses[0].textAnnotations[0]?.description || '';
        const textAnnotations = visionData.responses[0].textAnnotations || [];
        console.log('Extracted raw text length:', fullText.length);
        console.log('First 500 chars:', fullText.substring(0, 500));
        console.log('Total text annotations:', textAnnotations.length);
        
        if (fullText.trim()) {
          // Use enhanced parsing with bounding box analysis
          extractedData = parseReceiptTextWithBoundingBoxes(fullText, textAnnotations);
          console.log('Parsed data:', JSON.stringify(extractedData, null, 2));
        } else {
          console.log('No text extracted from image');
          extractedData = {
            storeName: 'Unknown Store',
            totalAmount: 0,
            date: new Date().toISOString().split('T')[0],
            items: [],
            category: 'Other',
            currency: 'USD',
            rawText: ''
          };
        }
      } else {
        console.log('No text annotations in Vision API response');
        extractedData = {
          storeName: 'Unknown Store',
          totalAmount: 0,
          date: new Date().toISOString().split('T')[0],
          items: [],
          category: 'Other',
          currency: 'USD',
          rawText: ''
        };
      }
    } catch (error) {
      console.error('Vision API error:', error);
      throw error;
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
      sustainability_score: calculateEnhancedSustainabilityScore(extractedData?.items || [], extractedData?.storeName || '').toString(),
      image_url: publicUrl,
      raw_text: extractedData?.rawText || ''
    };

    console.log('--- DEBUG: receiptData before insertion ---');
    console.log(JSON.stringify(receiptData, null, 2));
    console.log('--- DEBUG: extractedData.items before insertion ---');
    console.log(JSON.stringify(extractedData?.items || [], null, 2));
    console.log('--- DEBUG: items array length:', extractedData?.items?.length || 0);
    console.log('-------------------------------------------');

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

      console.log('--- DEBUG: Items being inserted into database ---');
      console.log(JSON.stringify(items, null, 2));
      console.log('--- DEBUG: First item details ---');
      if (items.length > 0) {
        console.log('First item.name:', JSON.stringify(items[0].item_name));
        console.log('First item.name length:', items[0].item_name?.length || 0);
        console.log('First item.name type:', typeof items[0].item_name);
      }
      console.log('-------------------------------------------');

      const { error: itemsError } = await supabase
        .from('receipt_items')
        .insert(items);

      if (itemsError) {
        console.error('Items insert error:', itemsError);
      } else {
        console.log(`Inserted ${items.length} items`);
        
        // Update category_id for the newly inserted items
        console.log('Updating category_id for items...');
        const updatePromises = items.map(async (item) => {
          const { data: categoryData, error: categoryError } = await supabase
            .from('categories')
            .select('id')
            .eq('name', item.category)
            .single();

          if (!categoryError && categoryData) {
            const { error: updateError } = await supabase
              .from('receipt_items')  
              .update({ category_id: categoryData.id })
              .eq('receipt_id', receipt.id)
              .eq('item_name', item.item_name)
              .eq('category', item.category);
              
            if (updateError) {
              console.error(`Error updating category_id for item ${item.item_name}:`, updateError);
            }
          } else {
            console.error(`Category not found for: ${item.category}`, categoryError);
          }
        });
        
        await Promise.all(updatePromises);
        console.log('Category IDs updated successfully');
      }
    }

    // Return structured response
    const response = {
      success: true,
      receipt_id: receipt.id,
      receipt: {
        id: receipt.id,
        store_name: receipt.store_name,
        total_amount: receipt.total_amount,
        purchase_date: receipt.purchase_date,
        category: receipt.category,
        sustainability_score: receipt.sustainability_score,
        image_url: receipt.image_url
      },
      items: extractedData?.items || [],
      extracted_data: extractedData
    };

    console.log('Returning response:', JSON.stringify(response, null, 2));

    return new Response(JSON.stringify(response), {
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

// Enhanced parsing function using bounding box analysis
function parseReceiptTextWithBoundingBoxes(text: string, textAnnotations: any[]) {
  console.log('[Enhanced Parser] Starting enhanced parsing with bounding boxes');
  
  // First get basic info using original method
  const basicData = parseReceiptText(text);
  
  // Now enhance with spatial analysis for better item extraction
  const enhancedItems = extractItemsWithSpatialAnalysis(textAnnotations);
  
  return {
    ...basicData,
    items: enhancedItems.length > 0 ? enhancedItems : basicData.items
  };
}

// Spatial analysis for item extraction using bounding boxes
function extractItemsWithSpatialAnalysis(textAnnotations: any[]) {
  if (!textAnnotations || textAnnotations.length < 2) {
    console.log('[Spatial Analysis] Insufficient text annotations for spatial analysis');
    return [];
  }

  console.log('[Spatial Analysis] Processing', textAnnotations.length, 'text annotations');
  
  // Skip the first annotation (full text) and process individual words/phrases
  const wordAnnotations = textAnnotations.slice(1);
  
  // Group annotations by approximate Y position (same line)
  const lines: any[] = [];
  const yTolerance = 10; // pixels tolerance for same line
  
  wordAnnotations.forEach(annotation => {
    if (!annotation.boundingPoly?.vertices) return;
    
    const text = annotation.description?.trim();
    if (!text || text.length === 0) return;
    
    const avgY = annotation.boundingPoly.vertices.reduce((sum: number, v: any) => sum + (v.y || 0), 0) / 4;
    const avgX = annotation.boundingPoly.vertices.reduce((sum: number, v: any) => sum + (v.x || 0), 0) / 4;
    
    // Find existing line or create new one
    let matchingLine = lines.find(line => Math.abs(line.avgY - avgY) <= yTolerance);
    
    if (!matchingLine) {
      matchingLine = { avgY, words: [] };
      lines.push(matchingLine);
    }
    
    matchingLine.words.push({
      text,
      x: avgX,
      y: avgY,
      boundingPoly: annotation.boundingPoly
    });
  });

  // Sort lines by Y position (top to bottom)
  lines.sort((a, b) => a.avgY - b.avgY);
  
  // Sort words in each line by X position (left to right)
  lines.forEach(line => {
    line.words.sort((a: any, b: any) => a.x - b.x);
    line.fullText = line.words.map((w: any) => w.text).join(' ');
  });

  console.log('[Spatial Analysis] Found', lines.length, 'text lines');
  
  // Extract items using enhanced patterns
  const items: any[] = [];
  const pricePattern = /^\$?(\d+\.?\d*)$/;
  const quantityPattern = /^(\d+)x?$/i;
  
  lines.forEach((line, index) => {
    const words = line.words;
    const fullText = line.fullText;
    
    // Skip obvious non-item lines
    if (shouldSkipLine(fullText)) return;
    
    // Look for price patterns in this line
    const priceWords = words.filter((word: any) => pricePattern.test(word.text.replace(/[,$]/g, '')));
    
    if (priceWords.length > 0) {
      // Found potential item line with price
      const price = parseFloat(priceWords[0].text.replace(/[^0-9.]/g, ''));
      
      if (price > 0 && price < 1000) { // Sanity check
        // Extract item name (words before the price)
        const priceIndex = words.findIndex((w: any) => w === priceWords[0]);
        const itemWords = words.slice(0, priceIndex);
        
        if (itemWords.length > 0) {
          const itemName = itemWords.map((w: any) => w.text).join(' ').trim();
          
          // Look for quantity
          let quantity = 1;
          const qtyMatch = fullText.match(/(\d+)\s*x\s/i);
          if (qtyMatch) {
            quantity = parseInt(qtyMatch[1]);
          }
          
          if (itemName.length > 2 && !isCommonNonItem(itemName)) {
            const category = categorizeItem(itemName);
            items.push({
              name: itemName,
              price: price,
              quantity: quantity,
              category: category,
              confidence: calculateItemConfidence(itemName, price, line.words)
            });
            
            console.log('[Item Debug] SUCCESSFULLY ADDED spatial analysis item:', 
              'Name:', JSON.stringify(itemName), 
              'Price:', price,
              'Category:', category
            );
          }
        }
      }
    }
  });

  // Sort by confidence and return top items
  return items
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20); // Limit to 20 items max
}

// Helper function to skip obvious non-item lines
function shouldSkipLine(text: string): boolean {
  const skipPatterns = [
    /^[\d\s\-\/]+$/, // Just numbers/dates/dashes
    /store|receipt|thank|you|visit|again|cashier|register/i,
    /subtotal|tax|total|balance|change|tender|payment/i,
    /phone|address|www\.|\.com|email/i,
    /^[\$\d\.\s\-]+$/ // Just prices and spaces
  ];
  
  return skipPatterns.some(pattern => pattern.test(text.trim()));
}

// Calculate confidence score for extracted items
function calculateItemConfidence(itemName: string, price: number, words: any[]): number {
  let confidence = 0.5; // Base confidence
  
  // Boost confidence for reasonable item names
  if (itemName.length >= 3 && itemName.length <= 50) confidence += 0.2;
  if (/^[a-zA-Z]/.test(itemName)) confidence += 0.1; // Starts with letter
  if (!/^\d+$/.test(itemName)) confidence += 0.1; // Not just numbers
  
  // Boost confidence for reasonable prices
  if (price >= 0.50 && price <= 100) confidence += 0.2;
  
  // Boost confidence for common product words
  const productWords = ['milk', 'bread', 'cheese', 'apple', 'banana', 'chicken', 'beef', 'rice', 'pasta'];
  if (productWords.some(word => itemName.toLowerCase().includes(word))) {
    confidence += 0.3;
  }
  
  return Math.min(confidence, 1.0);
}

// Helper function to identify common non-item text
function isCommonNonItem(itemName: string): boolean {
  const nonItemPatterns = [
    /^(total|subtotal|tax|balance|change|payment|cash|credit|debit|receipt|thank|you|store|address|phone|date|time|served|by|register|cashier)$/i,
    /^\d+$/, // Just numbers
    /^[\d\s\-\/]+$/, // Just numbers/dates/dashes
    /^[#*\-=]+$/, // Just symbols
    /^(www\.|\.com|email|phone|address)/i
  ];
  
  return nonItemPatterns.some(pattern => pattern.test(itemName.trim()));
}

function parseReceiptText(text: string) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  console.log('Parsing receipt text, total lines:', lines.length);
  console.log('First 10 lines:', lines.slice(0, 10));
  console.log('Last 10 lines:', lines.slice(-10));
  
  // Extract store name - improved detection
  let storeName = 'Unknown Store';
  
  // Known store patterns
  const storePatterns = [
    /walmart/i, /target/i, /whole\s*foods/i, /kroger/i, /safeway/i,
    /cvs/i, /walgreens/i, /starbucks/i, /mcdonald/i, /subway/i,
    /best\s*buy/i, /home\s*depot/i, /costco/i, /trader\s*joe/i,
    /amazon/i, /apple\s*store/i, /macy/i, /nordstrom/i
  ];
  
  // Check for known stores first
  for (const pattern of storePatterns) {
    const match = text.match(pattern);
    if (match) {
      storeName = match[0].charAt(0).toUpperCase() + match[0].slice(1).toLowerCase();
      break;
    }
  }
  
  // If no known store found, try to extract from first few lines
  if (storeName === 'Unknown Store') {
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      // Skip lines that are clearly not store names
      if (!line.match(/^\d/) && // Doesn't start with number
          line.length > 2 && line.length < 50 && // Reasonable length
          !line.toLowerCase().includes('receipt') &&
          !line.toLowerCase().includes('tax') &&
          !line.toLowerCase().includes('total') &&
          !line.match(/^[\d\W]+$/) && // Not just numbers and special chars
          !line.match(/^\$/) // Doesn't start with $
      ) {
        storeName = line.replace(/[^a-zA-Z0-9\s&'-]/g, '').trim();
        if (storeName.length > 2) {
          break;
        }
      }
    }
  }

  console.log('Extracted store name:', storeName);

  // Extract total amount - comprehensive patterns
  const totalPatterns = [
    /(?:grand\s+)?total[:\s]+\$?([\d,]+\.?\d*)/i,
    /amount\s+due[:\s]+\$?([\d,]+\.?\d*)/i,
    /balance\s+due[:\s]+\$?([\d,]+\.?\d*)/i,
    /(?:sub)?total[:\s]+\$?([\d,]+\.?\d*)/i,
    /you\s+pay[:\s]+\$?([\d,]+\.?\d*)/i,
    /charge[:\s]+\$?([\d,]+\.?\d*)/i,
    /paid[:\s]+\$?([\d,]+\.?\d*)/i,
    /\$\s*([\d,]+\.\d{2})(?:\s|$)/,  // Any clear dollar amount
    /^([\d,]+\.\d{2})(?:\s|$)/m  // Amount at start of line
  ];
  
  let totalAmount = 0;
  let foundAmounts = [];
  
  // Look through all lines for amounts, prioritizing bottom of receipt
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    for (const pattern of totalPatterns) {
      const match = line.match(pattern);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (amount > 0 && amount < 10000) { // Sanity check
          foundAmounts.push({ amount, line, index: i });
          // If it's explicitly labeled as total, use it
          if (line.toLowerCase().includes('total') && !line.toLowerCase().includes('sub')) {
            totalAmount = amount;
            break;
          }
        }
      }
    }
    if (totalAmount > 0) break;
  }
  
  // If no explicit total found, use the largest reasonable amount from bottom half
  if (totalAmount === 0 && foundAmounts.length > 0) {
    // Sort by position (prefer amounts closer to bottom) and amount
    foundAmounts.sort((a, b) => {
      // Prefer amounts from bottom third of receipt
      const bottomThird = lines.length * 0.66;
      if (a.index >= bottomThird && b.index < bottomThird) return -1;
      if (b.index >= bottomThird && a.index < bottomThird) return 1;
      // Otherwise prefer larger amount
      return b.amount - a.amount;
    });
    totalAmount = foundAmounts[0].amount;
  }

  console.log('Found amounts:', foundAmounts);
  console.log('Extracted total amount:', totalAmount);

  // Extract date - comprehensive patterns
  const datePatterns = [
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
    /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]+\d{1,2}[\s,]+\d{2,4}/i,
    /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{2,4})/i,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})(?:\s|$)/  // Short year format
  ];
  
  let date = null;
  
  // Look for date patterns
  for (const pattern of datePatterns) {
    const matches = text.match(new RegExp(pattern, 'g'));
    if (matches) {
      for (const match of matches) {
        try {
          let dateStr = match;
          
          // Handle short year format (MM/DD/YY)
          if (dateStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2}$/)) {
            const parts = dateStr.split(/[\/\-]/);
            const year = parseInt(parts[2]);
            // Assume 20xx for years 00-30, 19xx for years 31-99
            const fullYear = year <= 30 ? 2000 + year : 1900 + year;
            dateStr = `${parts[0]}/${parts[1]}/${fullYear}`;
          }
          
          const parsedDate = new Date(dateStr);
          
          // Validate the date is reasonable (not in future, not too old)
          const now = new Date();
          const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          
          if (!isNaN(parsedDate.getTime()) && 
              parsedDate <= now && 
              parsedDate >= oneYearAgo) {
            date = parsedDate.toISOString().split('T')[0];
            break;
          }
        } catch (e) {
          console.log('Date parsing error for:', match, e);
        }
      }
      if (date) break;
    }
  }
  
  // Default to today if no date found
  if (!date) {
    date = new Date().toISOString().split('T')[0];
    console.log('No date found, using today:', date);
  } else {
    console.log('Extracted date:', date);
  }

  // Extract items - improved patterns
  const items = [];
  const skipPatterns = [
    /^(total|subtotal|tax|balance|change|payment|cash|credit|debit|receipt|thank|you|store|address|phone|date|time)/i,
    /^\s*$/, // Empty lines
    /^[\d\-\/\s:]+$/, // Just dates/times
    /^[#*\-=]+$/, // Just symbols
  ];
  
  const itemPatterns = [
    // Multi-line scenarios handled separately, but patterns for quantity items
    // Format: "Item Name 2 @ $3.25 EACH" or "Item Name 2 @ 3.25"
    /^([A-Z][A-Z\s\*\-'&\.]{2,40})\s+(\d+)\s*@\s*\$?([\d,]+\.\d{1,2})/,
    // Format: "Item Name 2 x $3.99" 
    /^([A-Z][A-Z\s\*\-'&\.]{2,40})\s+(\d+)\s*[xX]\s*\$?([\d,]+\.\d{1,2})/,
    // Format: "ITEM NAME $12.99" (with dollar sign, name must be substantial)
    /^([A-Z][A-Z\s\*\-'&\.]{3,40})\s+\$\s*([\d,]+\.\d{1,2})$/,
    // Format: "ITEM NAME    12.99" (multiple spaces, name must be substantial)
    /^([A-Z][A-Z\s\*\-'&\.]{3,40})\s{2,}([\d,]+\.\d{1,2})$/,
    // Format: "ITEM NAME	12.99" (tab separated, name must be substantial)
    /^([A-Z][A-Z\s\*\-'&\.]{3,40})\t+([\d,]+\.\d{1,2})$/,
    // Format: "ITEM NAME 12.99" (single space, name must be substantial and not end with numbers)
    /^([A-Z][A-Z\s\*\-'&\.]*[A-Z][A-Z\s\*\-'&\.]{2,35})\s+([\d,]+\.\d{1,2})$/,
  ];
  
  console.log(`Processing ${lines.length} lines for items`);
  console.log('First 10 lines:', lines.slice(0, 10));
  console.log('Last 10 lines:', lines.slice(-10));
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    console.log(`[Item Debug] Processing line #${i}: "${line}"`);
    
    // Skip empty lines
    if (!line) {
      console.log(`[Item Debug] SKIPPING line #${i} (empty)`);
      continue;
    }
    
    // Check skip patterns
    let shouldSkip = false;
    for (const pattern of skipPatterns) {
      if (pattern.test(line)) {
        console.log(`[Item Debug] SKIPPING line #${i} (matches skip pattern): "${line}"`);
        shouldSkip = true;
        break;
      }
    }
    if (shouldSkip) continue;
    
    // Try single-line patterns first
    let itemFound = false;
    for (let patternIndex = 0; patternIndex < itemPatterns.length; patternIndex++) {
      const pattern = itemPatterns[patternIndex];
      const match = line.match(pattern);
      if (match) {
        console.log(`[Item Debug] Line #${i} ("${line}") MATCHED pattern ${patternIndex}: ${pattern}`);
        console.log(`[Item Debug] Match array content for line #${i}:`, match);
        
        let price = 0;
        let name = '';
        let quantity = 1;
        
        if (match.length === 3) {
          // Simple name + price
          name = match[1].trim();
          price = parseFloat(match[2].replace(/[$,]/g, ''));
          console.log(`[Item Debug] Extracted from 3-element match - Name: "${name}", Price: "${price}"`);
        } else if (match.length === 4) {
          // Name + quantity + price
          name = match[1].trim();
          quantity = parseInt(match[2]) || 1;
          const unitPrice = parseFloat(match[3].replace(/[$,]/g, ''));
          price = quantity * unitPrice;
          console.log(`[Item Debug] Extracted from 4-element match - Name: "${name}", Qty: "${quantity}", Unit Price: "${unitPrice}", Total Price: "${price}"`);
        }
        
        // Clean up name
        name = name.replace(/[^\w\s\-'&\.]/g, '').trim();
        
        // Validate item
        if (name.length >= 2 && 
            name.length <= 50 && 
            price > 0 && 
            price <= 1000 && // Reasonable price limit
            !name.match(/^\d+$/) && // Not just numbers
            !name.toLowerCase().match(/(total|tax|subtotal|change|payment|cash|credit|debit)/)
        ) {
          items.push({
            name: name.substring(0, 100),
            price: Math.round(price * 100) / 100, // Round to 2 decimals
            category: categorizeItem(name),
            quantity: quantity
          });
          console.log(`[Item Debug] SUCCESSFULLY ADDED item from line #${i}: Name: "${name}", Price: ${price}, Qty: ${quantity}`);
          itemFound = true;
          break;
        } else {
          console.log(`[Item Debug] Line #${i} ("${line}") FAILED item VALIDATION. Name: "${name}", Price: ${price}`);
        }
      }
    }
    
    // If no single-line pattern matched, try multi-line pattern (item name followed by price on next line)
    if (!itemFound && i < lines.length - 1) {
      const currentLine = line;
      const nextLine = lines[i + 1]?.trim();
      
      // Check if current line looks like an item name and next line is a price
      const itemNamePattern = /^([A-Z\s\*\-'&\.0-9]{3,50})$/;
      const pricePattern = /^(\d+\.\d{1,2})$/;
      
      if (itemNamePattern.test(currentLine) && nextLine && pricePattern.test(nextLine)) {
        const name = currentLine.replace(/[^\w\s\-'&\.]/g, '').trim();
        const price = parseFloat(nextLine);
        
        console.log(`[Item Debug] Multi-line match found: Line #${i} ("${currentLine}") + Line #${i+1} ("${nextLine}")`);
        
        // Validate multi-line item
        if (name.length >= 2 && 
            name.length <= 50 && 
            price > 0 && 
            price <= 1000 && 
            !name.match(/^\d+$/) && 
            !name.toLowerCase().match(/(total|tax|subtotal|change|payment|cash|credit|debit|description|store|phone|manager|served|register|receipt|time)/)) {
          items.push({
            name: name.substring(0, 100),
            price: Math.round(price * 100) / 100,
            category: categorizeItem(name),
            quantity: 1
          });
          console.log(`[Item Debug] SUCCESSFULLY ADDED multi-line item: Name: "${name}", Price: ${price}`);
          itemFound = true;
          i++; // Skip next line since we consumed it
        } else {
          console.log(`[Item Debug] Multi-line item FAILED validation: Name: "${name}", Price: ${price}`);
        }
      }
    }
    
    if (!itemFound) {
      console.log(`[Item Debug] Line #${i} ("${line}") did NOT match any item pattern.`);
    }
  }
  
  console.log('Extracted items count:', items.length);

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
  
  // Food & Beverages
  if (name.match(/(coffee|tea|drink|soda|juice|water|beer|wine|alcohol|beverage)/)) {
    return 'Dining';
  }
  
  // Groceries - Food items
  if (name.match(/(bread|milk|egg|fruit|vegetable|meat|chicken|beef|pork|fish|cheese|yogurt|cereal|rice|pasta|apple|banana|tomato|lettuce|onion|potato|carrot|broccoli|spinach|organic|fresh)/)) {
    return 'Groceries';
  }
  
  // Household items
  if (name.match(/(soap|detergent|clean|tissue|paper|towel|bag|foil|wrap|plate|cup|fork|knife|spoon|dish|laundry|bleach|sponge)/)) {
    return 'Household';
  }
  
  // Personal Care
  if (name.match(/(shampoo|toothpaste|lotion|deodorant|soap|brush|razor|makeup|perfume|cologne|lip|face|hand|body|skin|hair)/)) {
    return 'Personal Care';
  }
  
  // Health & Medicine
  if (name.match(/(medicine|vitamin|pill|tablet|capsule|bandage|aspirin|tylenol|advil|pharmacy|rx|prescription)/)) {
    return 'Health';
  }
  
  // Electronics
  if (name.match(/(phone|computer|laptop|tablet|cable|charger|battery|electronic|tech|digital)/)) {
    return 'Electronics';
  }
  
  // Clothing
  if (name.match(/(shirt|pants|dress|shoe|sock|hat|jacket|coat|jeans|sweater|underwear|bra|clothing|apparel)/)) {
    return 'Clothing';
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

// Enhanced sustainability scoring using LCA methodology
function calculateEnhancedSustainabilityScore(items: any[], storeName: string): number {
  if (!items || items.length === 0) return 50; // Neutral score for no items
  
  console.log('[Eco Score] Calculating enhanced sustainability score for', items.length, 'items');
  
  let totalScore = 0;
  let totalWeight = 0;
  
  items.forEach(item => {
    const itemName = (item.name || '').toLowerCase();
    const price = item.price || 0;
    const category = item.category || 'Other';
    
    // Base LCA score by category (based on environmental impact studies)
    let baseScore = getLCAScoreByCategory(category);
    
    // Product-specific adjustments
    baseScore += getProductSpecificScore(itemName);
    
    // Organic/sustainable product bonuses
    baseScore += getOrganicBonus(itemName);
    
    // Packaging penalty/bonus
    baseScore += getPackagingScore(itemName);
    
    // Store-specific adjustments (some stores focus on sustainability)
    baseScore += getStoreBonus(storeName);
    
    // Price-based adjustment (sometimes correlates with quality/sustainability)
    baseScore += getPriceBasedAdjustment(price, category);
    
    // Weight by price (more expensive items have more impact on overall score)
    const weight = Math.max(price, 1);
    totalScore += baseScore * weight;
    totalWeight += weight;
    
    console.log('[Eco Score] Item:', itemName, 'Category:', category, 'Score:', baseScore, 'Weight:', weight);
  });
  
  const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 50;
  const boundedScore = Math.max(10, Math.min(90, finalScore)); // Keep within 10-90 range
  
  console.log('[Eco Score] Final enhanced score:', boundedScore);
  return boundedScore;
}

// LCA base scores by category (lower = better environmental impact)
function getLCAScoreByCategory(category: string): number {
  const categoryScores: { [key: string]: number } = {
    'Groceries': 65,      // Mixed impact, depends on specific products
    'Personal Care': 55,   // Generally moderate impact
    'Household': 45,       // Cleaning products can be harsh
    'Electronics': 25,     // High environmental impact
    'Clothing': 35,        // Fashion industry has significant impact
    'Dining': 50,          // Varies greatly
    'Other': 50
  };
  
  return categoryScores[category] || 50;
}

// Product-specific scoring based on environmental impact
function getProductSpecificScore(itemName: string): number {
  // High environmental impact products (penalty)
  if (/(beef|steak|lamb|meat)/i.test(itemName)) return -15;
  if (/(plastic|disposable)/i.test(itemName)) return -10;
  if (/(battery|electronics)/i.test(itemName)) return -12;
  
  // Low environmental impact products (bonus)
  if (/(vegetable|fruit|plant|grain|bean|lentil)/i.test(itemName)) return +10;
  if (/(bicycle|bike|walk)/i.test(itemName)) return +15;
  if (/(solar|renewable|eco|green)/i.test(itemName)) return +20;
  
  // Neutral products
  return 0;
}

// Organic and sustainability certifications bonus
function getOrganicBonus(itemName: string): number {
  if (/(organic|bio|natural|sustainable|eco|green|fair.trade|rainforest.alliance)/i.test(itemName)) {
    return +15;
  }
  if (/(local|farm|fresh)/i.test(itemName)) {
    return +8;
  }
  return 0;
}

// Packaging impact scoring
function getPackagingScore(itemName: string): number {
  // Excessive packaging penalty
  if (/(wrapped|packaged|individual|single.use)/i.test(itemName)) return -5;
  
  // Minimal/recyclable packaging bonus
  if (/(bulk|loose|recyclable|biodegradable|compostable)/i.test(itemName)) return +5;
  
  return 0;
}

// Store-specific sustainability bonus
function getStoreBonus(storeName: string): number {
  const sustainableStores = [
    'whole foods', 'trader joe', 'sprouts', 'fresh market', 
    'co-op', 'farmers market', 'natural grocers'
  ];
  
  const store = storeName.toLowerCase();
  if (sustainableStores.some(s => store.includes(s))) {
    return +5;
  }
  
  return 0;
}

// Price-based sustainability correlation
function getPriceBasedAdjustment(price: number, category: string): number {
  // For certain categories, higher price often correlates with better quality/sustainability
  if (category === 'Groceries' && price > 10) return +3;
  if (category === 'Personal Care' && price > 15) return +2;
  
  return 0;
}

function calculateSustainabilityScore(items: any[]): number {
  if (items.length === 0) return 50;
  
  let totalScore = 0;
  
  for (const item of items) {
    const name = item.name.toLowerCase();
    let itemScore = 50; // Base score
    
    // High sustainability items (+30-40 points)
    if (name.match(/(organic|eco|sustainable|green|natural|biodegradable|fresh|local|farm|vegetable|fruit)/)) {
      itemScore += 35;
    }
    
    // Medium sustainability items (+10-20 points)
    else if (name.match(/(whole|grain|natural|unprocessed|water|plant|herb)/)) {
      itemScore += 15;
    }
    
    // Low sustainability items (-20-30 points)
    else if (name.match(/(plastic|disposable|synthetic|artificial|processed|packaged|fast|instant|frozen)/)) {
      itemScore -= 25;
    }
    
    // Very low sustainability items (-30-40 points)
    else if (name.match(/(styrofoam|single.use|non.recyclable|chemical|preservative)/)) {
      itemScore -= 35;
    }
    
    // Category-based adjustments
    if (item.category === 'Groceries') {
      itemScore += 10; // Fresh food is generally better
    } else if (item.category === 'Household') {
      itemScore -= 5; // Cleaning products often have chemicals
    } else if (item.category === 'Electronics') {
      itemScore -= 15; // Electronics have environmental impact
    }
    
    // Ensure score is within bounds
    itemScore = Math.max(0, Math.min(100, itemScore));
    totalScore += itemScore;
  }
  
  const averageScore = Math.round(totalScore / items.length);
  return Math.max(0, Math.min(100, averageScore));
}