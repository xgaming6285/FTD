// Test script to debug header mapping
const normalizeHeader = (header) => {
  return header
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .trim();
};

// Your CSV headers
const testHeaders = [
  "gender", "first name", "last name", "old email", "new email", "prefix", 
  "old phone", "new phone", "agent", "Extension", "Date of birth", "address", 
  "Facebook", "Twitter", "Linkedin", "Instagram", "Telegram", "ID front", 
  "ID back", "Selfie front", "Selfie back", "ID remark", "GEO"
];

const headerMappings = {
  // Core fields
  gender: ["gender"],
  firstname: ["firstname", "first_name", "fname", "first name"],
  lastname: ["lastname", "last_name", "lname", "last name"],
  oldemail: [
    "oldemail",
    "old_email",
    "email_old",
    "previousemail",
    "old email",
  ],
  newemail: [
    "newemail",
    "new_email",
    "email_new",
    "email",
    "new email",
  ],
  prefix: ["prefix"],
  oldphone: ["oldphone", "old_phone", "phone_old", "previousphone", "old phone"],
  newphone: [
    "newphone",
    "new_phone",
    "phone_new",
    "phone",
    "phonenumber",
    "new phone",
  ],
  agent: ["agent"],
  extension: ["extension", "ext"],
  dateofbirth: ["dateofbirth", "date_of_birth", "dob", "birthday", "date of birth"],

  // Social media fields
  facebook: ["facebook", "fb"],
  twitter: ["twitter"],
  linkedin: ["linkedin"],
  instagram: ["instagram", "ig"],
  telegram: ["telegram"],

  // Document fields
  idfront: ["idfront", "id_front", "frontid", "id front"],
  idback: ["idback", "id_back", "backid", "id back"],
  selfieback: ["selfieback", "selfie_back", "backselfie", "selfie back"],
  selfiefront: ["selfiefront", "selfie_front", "frontselfie", "selfie front"],
  idremark: ["idremark", "id_remark", "remark", "id remark"],

  // Address field
  address: ["address", "full_address", "fulladdress", "street_address", "streetaddress", "location_address"],

  // Geographic field
  geo: ["geo", "country", "location", "region"],
};

console.log("=== HEADER MAPPING TEST ===\n");

// Test the mapping
const fieldMapping = {};
testHeaders.forEach((header, index) => {
  const normalizedHeader = normalizeHeader(header);
  console.log(`Processing header ${index}: "${header}" -> normalized: "${normalizedHeader}"`);

  // Find matching field - use exact match only to avoid confusion
  let fieldMapped = false;
  for (const [fieldName, variations] of Object.entries(headerMappings)) {
    // Try exact match only
    const matchFound = variations.some(variation => {
      const normalizedVariation = normalizeHeader(variation);
      const isMatch = normalizedHeader === normalizedVariation;
      if (isMatch) {
        console.log(`✅ EXACT MATCH: "${header}" (${normalizedHeader}) matches ${fieldName} variation "${variation}" (${normalizedVariation})`);
      }
      return isMatch;
    });
    
    if (matchFound) {
      // Check if this field is already mapped to prevent duplicates
      const alreadyMapped = Object.values(fieldMapping).includes(fieldName);
      if (alreadyMapped) {
        console.log(`⚠️  WARNING: Field "${fieldName}" is already mapped to column ${Object.keys(fieldMapping).find(key => fieldMapping[key] === fieldName)}! Skipping duplicate mapping for column ${index} "${header}"`);
        continue;
      }
      
      fieldMapping[index] = fieldName;
      console.log(`✅ MAPPED: Column ${index} ("${header}") -> ${fieldName}`);
      fieldMapped = true;
      break;
    }
  }
  
  // If no exact match found, log it for debugging
  if (!fieldMapped) {
    console.log(`❌ No exact match found for header: "${header}" (normalized: "${normalizedHeader}")`);
  }
  console.log("---");
});

console.log("\n=== FINAL MAPPING ===");
console.log("Field Mapping:", fieldMapping);
console.log("\n=== MAPPED FIELDS ===");
Object.values(fieldMapping).forEach(field => console.log(`- ${field}`));

console.log("\n=== DUPLICATE CHECK ===");
const mappedFields = Object.values(fieldMapping);
const duplicates = mappedFields.filter((field, index) => mappedFields.indexOf(field) !== index);
if (duplicates.length > 0) {
  console.log("❌ DUPLICATES FOUND:", duplicates);
} else {
  console.log("✅ No duplicates found");
} 