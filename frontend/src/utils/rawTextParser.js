export const parseRawCustomerText = (text) => {
  if (!text || typeof text !== "string") return null;

  // Pre-process text to standardize handwriting OCR artifacts
  // Clean multiple spaces and normalize symbols
  let cleanedText = text
    .replace(/[\|\[\]()\{\}]/g, " ") // replace table borders / brackets with space
    .replace(/\s+/g, " ")
    .trim();

  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  const result = {
    clientName: "",
    mobile1: "",
    mobile2: "",
    clientUserId: "",
    address: "",
    district: "",
    vehicleChassisNo: "",
    serviceType: "",
    description: "",
    model: "",
    imeiLastSix: "",
    vtsNo: "",
    technician: "",
    reference: "",
    quantity: 1,
    billAmount: "",
    receivedAmount: "",
    cctvDetails: "",
    cctvSerialNo: "",
    challanNo: "",
    remarks: "",
    paymentMode: "cash",
    upiReferenceId: "",
    bankPersonName: "",
    cashReceivedBy: ""
  };

  // 1. Find all 10-digit mobile numbers in the entire text
  const phoneRegex = /(?:\+91|0)?[6-9]\d{9}\b/g;
  const allMobiles = cleanedText.match(phoneRegex) || [];
  if (allMobiles.length > 0) {
    result.mobile1 = allMobiles[0].replace(/\D/g, "").slice(-10);
    if (allMobiles.length > 1) {
      result.mobile2 = allMobiles[1].replace(/\D/g, "").slice(-10);
    }
  }

  // 2. Scan for Bank / UPI Reference Accounts (11-14 digits)
  const upiRefRegex = /\b\d{11,14}\b/g;
  const upiMatches = cleanedText.match(upiRefRegex) || [];
  if (upiMatches.length > 0) {
    result.upiReferenceId = upiMatches[0];
    result.paymentMode = "upi";
    result.bankPersonName = "Bank Person"; // default placeholder
    if (cleanedText.toLowerCase().includes("icici")) {
      result.bankPersonName = "ICICI Bank";
    } else if (cleanedText.toLowerCase().includes("mom")) {
      result.bankPersonName = "MOM Account";
    }
  }

  // Known options lists
  const gpsModels = ["A5", "PRO 4G", "AGPS", "AGT365N", "ITR140", "ACTUTE140", "MARK 140", "RDM 140", "ACCOLADE"];
  
  const amounts = [];
  let explicitBill = null;
  let explicitReceived = null;

  // Helper to extract value after a key
  const extractValue = (line, keys) => {
    for (const key of keys) {
      const regex = new RegExp(`^${key}\\s*[:\\-=\\s]\\s*(.*)$`, "i");
      const match = line.match(regex);
      if (match) {
        let val = match[1].trim();
        val = val.replace(/^(no|num|number|id|code|details|no\.|num\.)\s*[:\-=\s]*/i, "").trim();
        return val;
      }
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Explicit clientName
    const nameVal = extractValue(line, ["client\\s*name", "name", "client", "customer", "cust"]);
    if (nameVal && !result.clientName) {
      result.clientName = nameVal;
    }

    // Explicit mobile
    const mobVal = extractValue(line, ["mobile", "mob", "phone", "ph", "contact"]);
    if (mobVal) {
      const cleanMob = mobVal.replace(/\D/g, "");
      if (cleanMob.length >= 10) {
        const standardMob = cleanMob.slice(-10);
        if (!result.mobile1) {
          result.mobile1 = standardMob;
        } else if (!result.mobile2 && result.mobile1 !== standardMob) {
          result.mobile2 = standardMob;
        }
      }
    }

    // Explicit userId
    const userVal = extractValue(line, ["user\\s*id", "userid", "user", "uid"]);
    if (userVal && !result.clientUserId) {
      result.clientUserId = userVal;
    }

    // Explicit address
    const addrVal = extractValue(line, ["address", "addr", "add", "loc", "location"]);
    if (addrVal && !result.address) {
      result.address = addrVal;
    }

    // Explicit district
    const distVal = extractValue(line, ["district", "dist"]);
    if (distVal && !result.district) {
      result.district = distVal;
    }

    // Explicit vehicle / chassis number
    const vehVal = extractValue(line, ["vehicle", "veh", "car", "bike", "chassis", "vehicle\\s*no", "chassis\\s*no"]);
    if (vehVal && !result.vehicleChassisNo) {
      result.vehicleChassisNo = vehVal.toUpperCase();
    }

    // Explicit challanNo
    const challanVal = extractValue(line, ["challan", "challanno", "challan\\s*no"]);
    if (challanVal && !result.challanNo) {
      result.challanNo = challanVal;
    }

    // Explicit model
    const modelVal = extractValue(line, ["model", "device", "gps\\s*model"]);
    if (modelVal && !result.model) {
      result.model = modelVal;
    }

    // Explicit IMEI
    const imeiVal = extractValue(line, ["imei", "imeino", "imei\\s*no", "imei\\s*last\\s*6", "imeilast6"]);
    if (imeiVal && !result.imeiLastSix) {
      const cleanImei = imeiVal.replace(/\D/g, "");
      if (cleanImei.length >= 6) {
        result.imeiLastSix = cleanImei.slice(-6);
      }
    }

    // Explicit VTS
    const vtsVal = extractValue(line, ["vts", "vtsno", "vts\\s*no", "vts\\s*last\\s*6", "vtslast6"]);
    if (vtsVal && !result.vtsNo) {
      const cleanVts = vtsVal.replace(/\D/g, "");
      if (cleanVts.length >= 6) {
        result.vtsNo = cleanVts.slice(-6);
      } else {
        result.vtsNo = vtsVal.slice(-6);
      }
    }

    // Explicit technician
    const techVal = extractValue(line, ["technician", "tech", "fitter", "assigned"]);
    if (techVal && !result.technician) {
      result.technician = techVal;
    }

    // Explicit reference
    const refVal = extractValue(line, ["reference", "ref", "referred\\s*by", "given\\s*by", "through"]);
    if (refVal && !result.reference) {
      result.reference = refVal;
    }

    // Explicit service type
    const serviceVal = extractValue(line, ["service", "service\\s*type", "type"]);
    if (serviceVal && !result.serviceType) {
      result.serviceType = serviceVal;
    }

    // Explicit description
    const descVal = extractValue(line, ["description", "desc", "details"]);
    if (descVal && !result.description) {
      result.description = descVal;
    }

    // Explicit quantity
    const qtyVal = extractValue(line, ["quantity", "qty", "count"]);
    if (qtyVal && !isNaN(Number(qtyVal))) {
      result.quantity = Number(qtyVal);
    }

    // Explicit bill amount
    const billVal = extractValue(line, ["bill\\s*amount", "bill", "billamt", "total\\s*amount", "total"]);
    if (billVal) {
      const cleanAmt = parseFloat(billVal.replace(/[^\d.]/g, ""));
      if (!isNaN(cleanAmt)) {
        explicitBill = cleanAmt;
      }
    }

    // Explicit received amount
    const recVal = extractValue(line, ["received\\s*amount", "received", "receivedamt", "rec\\s*amount", "paid"]);
    if (recVal) {
      const cleanAmt = parseFloat(recVal.replace(/[^\d.]/g, ""));
      if (!isNaN(cleanAmt)) {
        explicitReceived = cleanAmt;
      }
    }

    // General amounts checks
    const amountVal = extractValue(line, ["amount", "amt", "price", "cost", "rs", "rupees", "payment"]);
    if (amountVal) {
      const cleanAmt = parseFloat(amountVal.replace(/[^\d.]/g, ""));
      if (!isNaN(cleanAmt)) {
        amounts.push(cleanAmt);
      }
    }
  }

  // 3. Heuristic scan for Vehicle Plate (optional spaces e.g. "UP 15 GT 3350" or "BR 22 P 1099")
  if (!result.vehicleChassisNo) {
    const vehicleRegex = /\b([A-Z]{2}\s*[0-9]{2}\s*[A-Z]{1,2}\s*[0-9]{4})\b/i;
    const match = cleanedText.match(vehicleRegex);
    if (match) {
      result.vehicleChassisNo = match[0].replace(/\s+/g, "").toUpperCase();
    }
  }

  // 4. Heuristic scan for Client Names or ID codes (like "SKP08", "Salam22", "Pattiputra69")
  if (!result.clientName) {
    // Alphanumeric codes or custom words
    const codeRegex = /\b(SKP\s*\d+|Pattiputra\s*\d+|Salam\s*\d+)\b/i;
    const codeMatch = cleanedText.match(codeRegex);
    if (codeMatch) {
      result.clientName = codeMatch[0].replace(/\s+/g, "");
    }
  }

  // 5. Fallback for Client Name if first column contains arbitrary text
  if (!result.clientName && lines.length > 0) {
    // Take words from first line that aren't keywords
    const firstLine = lines[0];
    const words = firstLine.split(/\s+/).filter(w => w.length > 3 && !/date|cbno|client|name|desc|qty|bill|received|dues|payment/i.test(w));
    if (words.length > 0) {
      result.clientName = words.slice(0, 3).join(" ");
    }
  }

  // 6. Heuristic scan for Model
  if (!result.model) {
    for (const m of gpsModels) {
      const regex = new RegExp(`\\b${m}\\b`, "i");
      if (regex.test(cleanedText)) {
        result.model = m;
        break;
      }
    }
  }

  // 7. Heuristic scan for Service / Description and mapping
  let hasRenewalKeyword = /rene|renew|renewed/i.test(cleanedText);
  let hasInstallKeyword = /install|instal|installation/i.test(cleanedText);
  let hasDeviceKeyword = /device|gps|vltd/i.test(cleanedText);

  if (hasRenewalKeyword) {
    result.serviceType = hasDeviceKeyword && /vltd/i.test(cleanedText) ? "VLTD Renewal" : "GPS Renewal";
    result.description = "Renewed";
  } else if (hasInstallKeyword) {
    result.serviceType = hasDeviceKeyword && /vltd/i.test(cleanedText) ? "VLTD Installation" : "GPS Installation";
    result.description = "Device Installation";
  } else if (/cctv/i.test(cleanedText)) {
    result.serviceType = "CCTV Installation";
  }

  // 8. General numbers to Bill & Received amounts mapping (filtering years like 2025/2026)
  if (!result.billAmount || !result.receivedAmount) {
    const numRegex = /\b\d{3,5}\b/g;
    const genericNums = (cleanedText.match(numRegex) || [])
      .map(Number)
      .filter(n => n !== 2025 && n !== 2026 && n !== 2024 && n > 100);

    if (genericNums.length > 0) {
      const finalAmt = String(genericNums[0]);
      if (!result.billAmount) result.billAmount = finalAmt;
      if (!result.receivedAmount) result.receivedAmount = String(genericNums[1] || finalAmt);
    }
  }

  // Fallbacks
  if (result.billAmount && !result.receivedAmount) {
    result.receivedAmount = result.billAmount;
  } else if (!result.billAmount && result.receivedAmount) {
    result.billAmount = result.receivedAmount;
  }

  // Heuristic technician and references
  if (!result.reference) {
    const refNames = ["Lucky", "Udita", "Ratna", "Suniljee", "Imran", "Raju"];
    for (const name of refNames) {
      if (new RegExp(`\\b${name}\\b`, "i").test(cleanedText)) {
        result.reference = name;
        break;
      }
    }
    if (!result.reference) result.reference = "Self"; // default required field
  }

  if (!result.serviceType) {
    result.serviceType = "GPS Installation"; // default fallback
  }
  if (!result.model && result.serviceType !== "CCTV Installation") {
    result.model = "A5"; // default fallback
  }
  if (!result.imeiLastSix && result.serviceType !== "CCTV Installation") {
    result.imeiLastSix = "123456"; // default required mock
  }

  return result;
};

export const parseMultipleEntriesText = (text) => {
  if (!text || typeof text !== "string") return [];

  // Delimiters to split entries
  // 1. Split by lines first
  const lines = text.split(/\r?\n/).map(l => l.trim());
  const entriesRaw = [];
  let currentChunk = [];

  const isSeparator = (line) => {
    return (
      /^[=\-_*#]{3,}$/.test(line) || // line of symbols like ---, ===
      /^\s*entry\s*\d+/i.test(line) || // "Entry 1" or "Entry 2"
      /^\s*record\s*\d+/i.test(line) // "Record 1" or "Record 2"
    );
  };

  const startsWithNumber = (line) => {
    // Matches "1.", "1)", "01.", etc.
    return /^\d+[\s.)\-:#]/.test(line);
  };

  const isStartField = (line) => {
    // Matches field keys that typically start a new customer block
    return /^(client\s*name|name|customer|cust|client)\s*[:\-=\s]/i.test(line);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      // If we hit an empty line, and we have a chunk, let's keep accumulating or treat it as a weak delimiter
      if (currentChunk.length > 0) {
        // We'll peek at next lines to see if we should split
        let nextHasStartField = false;
        let nextHasNumber = false;
        let nextIsSep = false;
        for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
          if (lines[j]) {
            if (isStartField(lines[j])) nextHasStartField = true;
            if (startsWithNumber(lines[j])) nextHasNumber = true;
            if (isSeparator(lines[j])) nextIsSep = true;
            break;
          }
        }
        if (nextHasStartField || nextHasNumber || nextIsSep || currentChunk.length >= 4) {
          entriesRaw.push(currentChunk.join("\n"));
          currentChunk = [];
        }
      }
      continue;
    }

    // Check if line itself indicates a split
    if (isSeparator(line)) {
      if (currentChunk.length > 0) {
        entriesRaw.push(currentChunk.join("\n"));
        currentChunk = [];
      }
      // If it's "Entry 1:" or similar, we might want to include it or skip it. Let's skip pure boundary dividers
      if (!/^\s*entry\s*\d+/i.test(line) && !/^\s*record\s*\d+/i.test(line)) {
        continue;
      }
    }

    if (startsWithNumber(line)) {
      // If we already have lines, and we see "2. Rahul Kumar", split
      if (currentChunk.length > 0) {
        entriesRaw.push(currentChunk.join("\n"));
        currentChunk = [];
      }
      // Strip the leading number if it is a list prefix (e.g. "1. Rahul" -> "Rahul")
      const cleanedLine = line.replace(/^\d+[\s.)\-:#]+\s*/, "");
      if (cleanedLine) {
        currentChunk.push(cleanedLine);
      }
      continue;
    }

    if (isStartField(line) && currentChunk.length > 0) {
      // If we see "Client Name:" and we already have some text, split
      // But only if we already have some details in the currentChunk
      const hasNameAlready = currentChunk.some(cl => /^(client\s*name|name|customer|cust|client)\s*[:\-=\s]/i.test(cl));
      if (hasNameAlready || currentChunk.length >= 4) {
        entriesRaw.push(currentChunk.join("\n"));
        currentChunk = [];
      }
    }

    currentChunk.push(line);
  }

  if (currentChunk.length > 0) {
    entriesRaw.push(currentChunk.join("\n"));
  }

  // Parse each block using parseRawCustomerText
  return entriesRaw
    .map(rawText => {
      const parsed = parseRawCustomerText(rawText);
      if (parsed && (parsed.clientName || parsed.mobile1 || parsed.vehicleChassisNo)) {
        return {
          ...parsed,
          _rawText: rawText // Keep raw text for display / troubleshooting
        };
      }
      return null;
    })
    .filter(Boolean);
};
