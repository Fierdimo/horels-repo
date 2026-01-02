-- Set test prices for marketplace rooms
-- Base price: 10 EUR per night

UPDATE rooms 
SET customPrice = 10.00 
WHERE isMarketplaceEnabled = 1 
  AND (customPrice IS NULL OR customPrice = 0);

-- Verify the update
SELECT id, name, type, customPrice, isMarketplaceEnabled 
FROM rooms 
WHERE isMarketplaceEnabled = 1 
LIMIT 10;
