# Filler Leads Phone Number Repetition Filtering

## Overview

This feature implements phone number repetition filtering for filler leads orders based on the number of leads requested. The system prevents excessive repetition of phone number patterns to maintain lead quality and variety.

## Rules Implementation

### Rule 1: Orders with ≤10 Filler Leads

- **Restriction**: No repetition of first four digits after phone prefix
- **Behavior**: Each phone pattern (first 4 digits after country code) can appear only once
- **Example**: From leads with phones +1234567890, +1234567891, +1567890123, only one lead from each unique pattern (2345, 5678) will be selected

### Rule 2: Orders with 11-20 Filler Leads

- **Restriction**: Maximum 2 repetitions per phone pattern, but no more than 10 pairs total
- **Behavior**: Each phone pattern can appear up to 2 times, but if you reach 10 patterns with pairs, additional patterns will only have 1 lead
- **Example**: Can have pairs like (2345, 2345), (5678, 5678), but limited to 10 such pairs maximum

### Rule 3: Orders with 21-40 Filler Leads

- **Restriction**: Maximum 4 repetitions per phone pattern
- **Behavior**: Each phone pattern can appear up to 4 times
- **Example**: Pattern 2345 can have up to 4 leads with phones starting with +X2345...

### Rule 4: Orders with >40 Filler Leads

- **Restriction**: No repetition restrictions
- **Behavior**: All available filler leads are returned without filtering

## Technical Implementation

### Phone Number Processing

```javascript
// Extracts first four digits after country code
// +1234567890 -> "2345"
const getFirstFourDigitsAfterPrefix = (phoneNumber) => {
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  return cleanPhone.substring(1, 5);
};
```

### Lead Fetching Strategy

The system fetches more leads than requested to ensure sufficient variety for filtering:

- **≤10 leads**: Fetches 3x the requested amount
- **11-20 leads**: Fetches 2x the requested amount
- **21-40 leads**: Fetches 1.5x the requested amount
- **>40 leads**: Fetches the exact amount requested

### Modified Order Creation Flow

1. Calculate fetch multiplier based on requested filler count
2. Fetch expanded set of filler leads from database
3. Apply phone repetition filtering rules
4. Return filtered leads (up to requested count)
5. Update order with actual fulfilled count

## API Response Enhancement

Order creation responses now include information about phone filtering:

```json
{
  "success": true,
  "message": "Order created with 8 leads - fully fulfilled (filler leads: max 2 repetitions per phone pattern, max 10 pairs)",
  "data": { ... }
}
```

## Files Modified

- `backend/controllers/orders.js`: Main implementation with helper functions and modified order creation logic
- Added comprehensive JSDoc documentation for all new functions

## Usage Example

When creating an order for 15 filler leads:

1. System fetches up to 30 filler leads from database
2. Groups leads by phone patterns (first 4 digits after prefix)
3. Applies Rule 2: Takes max 2 leads per pattern, max 10 pairs
4. Returns filtered set of leads that comply with repetition rules
5. Creates order with actual number of leads obtained

## Benefits

1. **Quality Control**: Prevents orders with too many similar phone numbers
2. **Variety**: Ensures diverse phone number patterns in each order
3. **Scalability**: Rules adapt based on order size
4. **Transparency**: Clear messaging about filtering applied
5. **Flexibility**: No restrictions for large orders (>40 leads)

## Testing

The implementation has been tested with sample data to verify:

- Correct extraction of phone number patterns
- Proper application of each rule
- Accurate counting and limiting of repetitions
- Correct handling of edge cases (insufficient leads, no phone numbers, etc.)
