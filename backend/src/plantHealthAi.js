const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 20_000;
const GEMINI_TIMEOUT_MS = Math.max(30_000, Number(process.env.PLANT_SCAN_AI_TIMEOUT_MS) || 150_000);

const CATEGORY_KEYS = ["leaf", "color", "pests", "disease", "water", "nutrients"];
const HEALTH_STATUSES = ["healthy", "mild", "moderate", "severe", "critical"];
const ISSUE_TYPES = ["disease", "pest", "nutrient", "water", "environment", "physical", "other"];
const LIKELIHOODS = ["possible", "likely", "very_likely"];
const SEVERITIES = ["low", "medium", "high"];
const ACTION_PRIORITIES = ["urgent", "soon", "monitor"];
const IMAGE_QUALITIES = ["good", "fair", "poor"];

function geminiApiKey() {
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "").trim();
}

function geminiModel() {
  return String(process.env.GEMINI_MODEL || "").trim() || DEFAULT_GEMINI_MODEL;
}

function isPlantHealthAiConfigured() {
  return Boolean(geminiApiKey());
}

const stringArray = (maxItems) => ({ type: "array", maxItems, items: { type: "string" } });

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    isPlant: { type: "boolean" },
    imageQuality: { type: "string", enum: IMAGE_QUALITIES },
    imageQualityNotes: { type: "string" },
    plant: {
      type: "object",
      properties: {
        commonName: { type: "string" },
        scientificName: { type: "string" },
        category: { type: "string" },
        growthStage: { type: "string" },
        confidence: { type: "integer" }
      },
      required: ["commonName", "scientificName", "category", "growthStage", "confidence"]
    },
    healthScore: { type: "integer" },
    healthStatus: { type: "string", enum: HEALTH_STATUSES },
    overallConfidence: { type: "integer" },
    summary: { type: "string" },
    categoryScores: {
      type: "array",
      maxItems: CATEGORY_KEYS.length,
      items: {
        type: "object",
        properties: {
          key: { type: "string", enum: CATEGORY_KEYS },
          score: { type: "integer" },
          note: { type: "string" }
        },
        required: ["key", "score", "note"]
      }
    },
    observedSymptoms: stringArray(5),
    issues: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ISSUE_TYPES },
          likelihood: { type: "string", enum: LIKELIHOODS },
          confidence: { type: "integer" },
          severity: { type: "string", enum: SEVERITIES },
          evidence: { type: "string" },
          explanation: { type: "string" }
        },
        required: ["name", "type", "likelihood", "confidence", "severity", "evidence", "explanation"]
      }
    },
    actions: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          priority: { type: "string", enum: ACTION_PRIORITIES },
          title: { type: "string" },
          detail: { type: "string" },
          timeframe: { type: "string" }
        },
        required: ["priority", "title", "detail", "timeframe"]
      }
    },
    fertilizer: {
      type: "object",
      properties: {
        needed: { type: "boolean" },
        categories: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              reason: { type: "string" },
              howToApply: { type: "string" }
            },
            required: ["category", "reason", "howToApply"]
          }
        },
        caution: { type: "string" }
      },
      required: ["needed", "categories", "caution"]
    },
    pestControl: {
      type: "object",
      properties: {
        ipmSteps: stringArray(4),
        organicOptions: stringArray(3),
        chemicalNote: { type: "string" }
      },
      required: ["ipmSteps", "organicOptions", "chemicalNote"]
    },
    prevention: stringArray(3),
    needsMorePhotos: { type: "boolean" },
    photoRequests: stringArray(3),
    needsExpert: { type: "boolean" },
    expertReason: { type: "string" },
    rescanInDays: { type: "integer" }
  },
  required: [
    "isPlant",
    "imageQuality",
    "imageQualityNotes",
    "plant",
    "healthScore",
    "healthStatus",
    "overallConfidence",
    "summary",
    "categoryScores",
    "observedSymptoms",
    "issues",
    "actions",
    "fertilizer",
    "pestControl",
    "prevention",
    "needsMorePhotos",
    "photoRequests",
    "needsExpert",
    "expertReason",
    "rescanInDays"
  ]
};

function cleanText(value, max = 600) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function buildPrompt({ language, context, locationLabel, monthLabel }) {
  const ctx = context || {};
  const lines = [
    "You are an experienced agronomist and plant pathologist helping small farmers and home gardeners in India.",
    "Analyse the attached photo(s) of ONE plant or tree and return the JSON described by the response schema.",
    "",
    "Rules:",
    "- Base every finding on what is actually visible. List visible symptoms in observedSymptoms, and put possible causes in issues. Never present a cause as certain from a photo.",
    "- observedSymptoms: at most 5. issues: at most 3, ordered from most to least likely. Use likelihood 'possible' unless the evidence is strong. confidence is 0-100.",
    "- healthScore is 0-100 (100 = perfectly healthy). categoryScores must contain exactly one entry for each key: leaf, color, pests, disease, water, nutrients (each 0-100, higher is healthier).",
    "- healthStatus: healthy (85-100), mild (70-84), moderate (50-69), severe (30-49), critical (0-29).",
    "- categoryScores.note: a few words only (empty string if nothing notable).",
    "- actions: 3-5 practical steps ordered by priority (urgent first). Prefer cultural, mechanical and biological measures first (integrated pest management).",
    "- pestControl: at most 4 ipmSteps and 3 organicOptions. prevention: at most 3 tips.",
    "- fertilizer: at most 3 categories. Recommend fertilizer CATEGORIES only (e.g. 'Nitrogen-rich fertilizer', 'Organic compost / FYM', 'Micronutrient mix with zinc'), never a single brand. Mention that the right dose depends on crop, growth stage, soil and a soil test. If nutrients look fine, set needed=false.",
    "- pestControl.chemicalNote: if a chemical pesticide/fungicide might be required, name only the class of product and say to confirm with the local agriculture officer / Krishi Vigyan Kendra and follow the label. Never give dosages for chemicals.",
    "- If the images are blurry, too dark, too far, or do not show the affected part, set imageQuality accordingly, set needsMorePhotos=true and list the exact shots needed in photoRequests (e.g. 'Close-up of the underside of an affected leaf').",
    "- If overall confidence is below 60, set needsMorePhotos=true.",
    "- needsExpert=true when damage is severe, spreading fast, affects many plants, or you are unsure. Explain why in expertReason (empty string otherwise).",
    "- rescanInDays: when to check again (3-14).",
    "- If the photo is not a plant, set isPlant=false, healthScore=0, keep arrays empty and explain in summary.",
    "",
    `Write every human-readable text value in ${language}. Keep JSON keys and enum values exactly as defined in English.`,
    "Use simple words a farmer can understand. Be brief: every text value is ONE short sentence (about 20 words or fewer); summary at most two sentences. Do not repeat the same advice in different sections."
  ];

  const facts = [];
  if (ctx.plantName) facts.push(`Plant / crop (as told by the user): ${cleanText(ctx.plantName, 80)}`);
  if (ctx.plantType) facts.push(`Plant type: ${cleanText(ctx.plantType, 40)}`);
  if (ctx.growthStage) facts.push(`Growth stage: ${cleanText(ctx.growthStage, 40)}`);
  if (ctx.symptoms) facts.push(`Farmer's description of the problem: ${cleanText(ctx.symptoms, 400)}`);
  if (ctx.recentInputs) facts.push(`Recent fertilizer / spray: ${cleanText(ctx.recentInputs, 200)}`);
  if (ctx.watering) facts.push(`Watering / irrigation: ${cleanText(ctx.watering, 120)}`);
  if (locationLabel) facts.push(`Location: ${cleanText(locationLabel, 120)}`);
  if (monthLabel) facts.push(`Current month: ${monthLabel}`);
  if (Array.isArray(ctx.previousIssues) && ctx.previousIssues.length) {
    facts.push(`Issues found in the previous scan of this plant: ${ctx.previousIssues.map((x) => cleanText(x, 80)).join("; ")}`);
  }
  if (Number.isFinite(Number(ctx.previousScore))) {
    facts.push(`Previous health score: ${Math.round(Number(ctx.previousScore))}/100`);
  }
  if (facts.length) {
    lines.push("", "Context from the user (may be incomplete):", ...facts.map((f) => `- ${f}`));
  }
  if (Array.isArray(ctx.photoLabels) && ctx.photoLabels.length) {
    lines.push("", `Photos in order: ${ctx.photoLabels.map((x) => cleanText(x, 40)).join(", ")}.`);
  }
  return lines.join("\n");
}

async function fetchImageAsInlineData(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Could not load photo (${res.status})`);
    const contentType = String(res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) throw new Error("Photo is empty");
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Photo is too large");
    const mimeType = contentType.startsWith("image/") ? contentType : "image/jpeg";
    return { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } };
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(`${GEMINI_API_BASE}/${encodeURIComponent(geminiModel())}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey() },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pickEnum(value, allowed, fallback) {
  const v = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  return allowed.includes(v) ? v : fallback;
}

function textList(value, maxItems, maxLen = 240) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function statusForScore(score) {
  if (score >= 85) return "healthy";
  if (score >= 70) return "mild";
  if (score >= 50) return "moderate";
  if (score >= 30) return "severe";
  return "critical";
}

function normalizeDiagnosis(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const isPlant = r.isPlant !== false;
  const healthScore = isPlant ? clampInt(r.healthScore, 0, 100, 50) : 0;
  const plant = r.plant && typeof r.plant === "object" ? r.plant : {};

  const scoreByKey = new Map();
  if (Array.isArray(r.categoryScores)) {
    for (const row of r.categoryScores) {
      const key = pickEnum(row?.key, CATEGORY_KEYS, "");
      if (key && !scoreByKey.has(key)) {
        scoreByKey.set(key, { key, score: clampInt(row?.score, 0, 100, healthScore), note: cleanText(row?.note, 200) });
      }
    }
  }
  const categoryScores = isPlant
    ? CATEGORY_KEYS.map((key) => scoreByKey.get(key) || { key, score: healthScore, note: "" })
    : [];

  const issues = (Array.isArray(r.issues) ? r.issues : [])
    .map((row) => ({
      name: cleanText(row?.name, 120),
      type: pickEnum(row?.type, ISSUE_TYPES, "other"),
      likelihood: pickEnum(row?.likelihood, LIKELIHOODS, "possible"),
      confidence: clampInt(row?.confidence, 0, 100, 50),
      severity: pickEnum(row?.severity, SEVERITIES, "medium"),
      evidence: cleanText(row?.evidence, 300),
      explanation: cleanText(row?.explanation, 400)
    }))
    .filter((row) => row.name)
    .slice(0, 4);

  const priorityRank = { urgent: 0, soon: 1, monitor: 2 };
  const actions = (Array.isArray(r.actions) ? r.actions : [])
    .map((row) => ({
      priority: pickEnum(row?.priority, ACTION_PRIORITIES, "soon"),
      title: cleanText(row?.title, 120),
      detail: cleanText(row?.detail, 400),
      timeframe: cleanText(row?.timeframe, 60)
    }))
    .filter((row) => row.title)
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 8);

  const fert = r.fertilizer && typeof r.fertilizer === "object" ? r.fertilizer : {};
  const fertilizer = {
    needed: Boolean(fert.needed),
    categories: (Array.isArray(fert.categories) ? fert.categories : [])
      .map((row) => ({
        category: cleanText(row?.category, 120),
        reason: cleanText(row?.reason, 300),
        howToApply: cleanText(row?.howToApply, 300)
      }))
      .filter((row) => row.category)
      .slice(0, 4),
    caution: cleanText(fert.caution, 400)
  };

  const pest = r.pestControl && typeof r.pestControl === "object" ? r.pestControl : {};
  const overallConfidence = clampInt(r.overallConfidence, 0, 100, 50);
  const imageQuality = pickEnum(r.imageQuality, IMAGE_QUALITIES, "fair");
  const photoRequests = textList(r.photoRequests, 4, 160);

  return {
    isPlant,
    imageQuality,
    imageQualityNotes: cleanText(r.imageQualityNotes, 300),
    plant: {
      commonName: cleanText(plant.commonName, 120),
      scientificName: cleanText(plant.scientificName, 120),
      category: cleanText(plant.category, 60),
      growthStage: cleanText(plant.growthStage, 60),
      confidence: clampInt(plant.confidence, 0, 100, 50)
    },
    healthScore,
    healthStatus: isPlant ? pickEnum(r.healthStatus, HEALTH_STATUSES, statusForScore(healthScore)) : "critical",
    overallConfidence,
    summary: cleanText(r.summary, 600),
    categoryScores,
    observedSymptoms: textList(r.observedSymptoms, 8, 200),
    issues,
    actions,
    fertilizer,
    pestControl: {
      ipmSteps: textList(pest.ipmSteps, 6, 240),
      organicOptions: textList(pest.organicOptions, 5, 240),
      chemicalNote: cleanText(pest.chemicalNote, 400)
    },
    prevention: textList(r.prevention, 6, 240),
    needsMorePhotos: Boolean(r.needsMorePhotos) || overallConfidence < 60 || imageQuality === "poor",
    photoRequests,
    needsExpert: Boolean(r.needsExpert),
    expertReason: cleanText(r.expertReason, 300),
    rescanInDays: clampInt(r.rescanInDays, 3, 14, 7)
  };
}

function aiError(message, status = 502, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

/**
 * Sends the plant photos to Gemini and returns a normalized diagnosis.
 * `imageUrls` must be publicly readable (our media storage URLs).
 */
async function analyzePlantImages({ imageUrls, language, context, locationLabel }) {
  if (!isPlantHealthAiConfigured()) {
    throw aiError("Plant scan is not configured on the server (GEMINI_API_KEY missing).", 503, "AI_NOT_CONFIGURED");
  }
  const urls = (Array.isArray(imageUrls) ? imageUrls : []).filter(Boolean).slice(0, 4);
  if (!urls.length) throw aiError("At least one photo is required.", 400);

  const startedAt = Date.now();
  let imageParts;
  try {
    imageParts = await Promise.all(urls.map((url) => fetchImageAsInlineData(url)));
  } catch (error) {
    throw aiError(`Could not read the uploaded photos: ${error?.message || error}`, 400);
  }
  const imagesMs = Date.now() - startedAt;

  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "Asia/Kolkata" }).format(new Date());
  const prompt = buildPrompt({ language: language || "English", context, locationLabel, monthLabel });
  const model = geminiModel();
  const generationConfig = {
    temperature: 0.2,
    responseMimeType: "application/json",
    responseSchema: RESPONSE_SCHEMA
  };
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }, ...imageParts] }],
    generationConfig: /^gemini-3/i.test(model)
      ? { ...generationConfig, thinkingConfig: { thinkingLevel: "low" } }
      : generationConfig
  };

  let result;
  try {
    result = await callGemini(body);
    if (!result.ok && result.status === 400 && body.generationConfig.thinkingConfig && /thinking/i.test(result.text)) {
      const { thinkingConfig: _drop, ...rest } = body.generationConfig;
      result = await callGemini({ ...body, generationConfig: rest });
    }
  } catch (error) {
    const aborted = error?.name === "AbortError";
    // eslint-disable-next-line no-console
    console.warn("[plant-health] Gemini call failed", {
      model,
      language,
      photos: urls.length,
      imagesMs,
      totalMs: Date.now() - startedAt,
      error: aborted ? "timeout" : error?.message || String(error)
    });
    throw aiError(aborted ? "The plant analysis took too long. Please try again." : "Could not reach the AI service.", 504);
  }

  const usage = result.json?.usageMetadata || {};
  // eslint-disable-next-line no-console
  console.log("[plant-health] Gemini done", {
    model,
    language,
    status: result.status,
    photos: urls.length,
    imagesMs,
    totalMs: Date.now() - startedAt,
    promptTokens: usage.promptTokenCount,
    outputTokens: usage.candidatesTokenCount,
    thinkingTokens: usage.thoughtsTokenCount
  });

  if (!result.ok) {
    const detail = result.json?.error?.message || result.text.slice(0, 300);
    // eslint-disable-next-line no-console
    console.warn("[plant-health] Gemini error", result.status, detail);
    if (result.status === 429) throw aiError("Too many scans right now. Please try again in a minute.", 429);
    throw aiError("The AI service could not analyse this photo. Please try again.", 502);
  }

  const candidate = result.json?.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .filter((p) => typeof p?.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("");
  if (!text) {
    const blocked = candidate?.finishReason || result.json?.promptFeedback?.blockReason;
    throw aiError(blocked ? `The AI could not analyse this photo (${blocked}).` : "The AI returned an empty answer.", 502);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw aiError("The AI returned an unreadable answer. Please try again.", 502);
    parsed = JSON.parse(match[0]);
  }
  return { diagnosis: normalizeDiagnosis(parsed), model };
}

module.exports = {
  analyzePlantImages,
  isPlantHealthAiConfigured,
  normalizeDiagnosis
};
