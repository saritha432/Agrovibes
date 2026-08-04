import React, { useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../../theme/appColors";

const BG = "#303132";
const SHEET_BG = "#1A1A1A";
const CARD = "#373838";
const FIELD = "#373838";
const CHANNEL_PILL = "#000000";
const HAIRLINE = "#FFFFFF1A";

type ListingChannel = "Store" | "Rental" | "Services" | "Educators";
type Step = 1 | 2 | 3 | 4;

const PLATFORM_FEE_PCT = 0.15;

type AssetOption = {
  id: string;
  title: string;
  subtitle: string;
};

const CHANNELS: Array<{
  id: ListingChannel;
  label: string;
  icon?: number;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: "Store", label: "Store", fallbackIcon: "storefront-outline" },
  {
    id: "Rental",
    label: "Rental",
    icon: require("../../../../assets/provider/bottom-icons/rental.png"),
    fallbackIcon: "car-outline"
  },
  {
    id: "Services",
    label: "Services",
    icon: require("../../../../assets/provider/bottom-icons/services.png"),
    fallbackIcon: "build-outline"
  },
  { id: "Educators", label: "Educators", fallbackIcon: "school-outline" }
];

const RENTAL_ASSETS: AssetOption[] = [
  { id: "farm_equipment", title: "Farm Equipment", subtitle: "Pumps, Sprayers, Drills, Tools" },
  { id: "machinery", title: "Machinery", subtitle: "Tractors, Harvesters, Ploughs, Threshers" },
  { id: "labor", title: "Labor", subtitle: "Farm Hands, Laborers, Seasonal Workers" },
  { id: "drivers", title: "Drivers", subtitle: "Professional Truck Drivers, Delivery Drivers" },
  { id: "land", title: "Land", subtitle: "Agricultural Land, Farmland For Lease/Rent" },
  { id: "warehouse", title: "Warehouse", subtitle: "Cold Storage, Dry Storage, Climate-Controlled Storage" }
];

const SERVICE_ASSETS: AssetOption[] = [
  { id: "soil_testing", title: "Soil Testing", subtitle: "NPK, pH, micronutrients & lab reports" },
  { id: "farm_consultancy", title: "Farm Consultancy", subtitle: "Crop advice, planning & field visits" },
  { id: "mechanic_services", title: "Mechanic Services", subtitle: "On-farm equipment diagnosis & repair" },
  { id: "irrigation_services", title: "Irrigation Services", subtitle: "Drip, sprinkler setup & maintenance" },
  { id: "drone_spraying", title: "Drone Spraying", subtitle: "Precision pesticide & nutrient spraying" },
  { id: "crop_inspection", title: "Crop Inspection", subtitle: "Health checks, pest & disease scouting" },
  { id: "equipment_repair", title: "Equipment Repair", subtitle: "Workshop repair for farm machinery" }
];

const STORE_ASSETS: AssetOption[] = [
  { id: "inputs", title: "Farm Inputs", subtitle: "Seeds, fertilizers, pesticides" },
  { id: "tools", title: "Tools & Parts", subtitle: "Spare parts and hand tools" },
  { id: "produce", title: "Produce", subtitle: "Sell harvested crops" }
];

const EDUCATOR_ASSETS: AssetOption[] = [
  { id: "course", title: "Course", subtitle: "Structured learning modules" },
  { id: "workshop", title: "Workshop", subtitle: "Hands-on training sessions" },
  { id: "webinar", title: "Webinar", subtitle: "Live online education" }
];

const EQUIPMENT_TYPES = [
  "Sprayer",
  "Power Sprayer",
  "Power Generator",
  "Water Pump",
  "Weed Tools",
  "Brush Cutter",
  "Chain Saw",
  "Other"
];
const POWER_OPTIONS = ["< 20 HP", "20-40 HP", "40-60 HP", "60-90 HP", "90+ HP", "N/A"];
const FUEL_TYPES = ["Petrol", "Manual", "Electric", "Diesel"];
const USAGE_GUIDANCE = [
  "Yes — Instructional Material Included",
  "Yes — Available On Request",
  "No"
];
const RATE_UNITS = ["Hour", "Day", "Shift"];
const SERVICE_AREAS = ["5 km", "10 km", "15 km", "20 km", "25 km"];

const ENGINE_TYPES = ["Petrol", "Manual", "Electric", "Diesel"];
const FUEL_CONSUMPTION = [
  "1-2 Litre Per Hour",
  "3 Litre Per Hour",
  "4-7 Litre Per Hour",
  "8-12 Litre Per Hour"
];
const OPERATOR_SUPPORT = ["Operator Included", "Training", "Machine Only", "With Driver"];
const DELIVERY_AVAILABLE = [
  "Self: Free Service Within Area",
  "Paid: Paid Delivery Services",
  "Pick Up Only"
];

const LABOR_CATEGORIES = ["Agriculture", "Construction", "Harvesting", "Livestock", "Other"];
const LABOR_TYPES = ["Skilled", "Unskilled", "Semi-skilled", "Strong Labour", "Other"];
const LABOR_TEAM_SIZE = ["1-3 People", "4-6 People", "7-9 People", "9-12 People", "12-20 People"];
const LABOR_GENDER = ["Male", "Female", "Both (Mixed)"];
const LABOR_SHIFT = ["Day Shift", "Night Shift", "Both"];
const LABOR_HOURS = ["0-2 Hours", "2-4 Hours", "4-6 Hours", "6-8 Hours", "8+ Hours"];
const LABOR_LANGUAGE = ["English", "Telugu", "Hindi"];
const LABOR_PERIOD = ["Hour", "Day", "Week"];
const LABOR_MIN_DURATION = ["1 Day", "2 Days", "3 Days", "1 Week", "2 Weeks"];

const DRIVER_SKILL_SETS = [
  "Wheel Drive",
  "Crawler / Chain",
  "Harvester",
  "Drill",
  "Baler",
  "Other Equipment"
];
const DRIVER_EXPERTISE = [
  "Tractor Driving",
  "Harvester Operation",
  "Heavy Machinery",
  "Transport / Delivery",
  "Multi-Equipment"
];
const DRIVER_LICENSE_TYPES = ["LMV", "HMV", "HMV With Trailer", "Trans", "Tractor"];
const DRIVER_EXPERIENCE_YEARS = [
  "0-2 Years",
  "2-4 Years",
  "4-6 Years",
  "6-8 Years",
  "8-10 Years",
  "10-15 Years"
];
const DRIVER_AVAILABILITY = ["Full Time", "Part Time", "On Demand"];
const DRIVER_LANGUAGES = ["English", "Telugu", "Hindi", "Kannada"];

const LAND_CATEGORIES = ["Agricultural", "Commercial", "Residential Farm", "Industrial", "Other"];
const LAND_TYPES = [
  "Cultivated With Irrigation",
  "Bare Land",
  "Building",
  "Greenhouse",
  "Orchard",
  "Other"
];
const LAND_DISTRICTS = ["Guntur", "Krishna", "West Godavari", "East Godavari", "Prakasam", "Other"];
const LAND_TOWNS = ["Amaravati", "Vijayawada", "Guntur", "Eluru", "Ongole", "Other"];
const LAND_UNITS = ["Acre", "Hectare", "Sq. Ft", "Sq. Yard", "Cent"];
const LAND_RENTAL_TYPES = ["Short Term Lease", "Long Term Lease", "Seasonal", "Share Cropping"];
const LAND_WATER_ACCESS = ["Yes — Borewell", "Yes — Canal", "Yes — River", "No"];
const LAND_SOIL_TYPES = ["Black", "Clay", "Sandy", "Red", "Alluvial"];
const LAND_SERVICE_AREAS = ["10 Km", "20 Km", "30 Km", "50 Km", "100 Km"];
const LAND_AVAILABLE_FROM = ["Now", "Within 1 Week", "Within 1 Month", "Select Date"];
const LAND_OWNED_BY = ["Self Owned", "Family Owned", "Leased", "Partnership"];
const LAND_CATEGORY_SUPPORTED = ["All", "Agricultural", "Horticultural", "Commercial", "Mixed"];

const WAREHOUSE_STORAGE_TYPES = [
  "Warehouse Space",
  "Silobins",
  "Cold Storage",
  "Storage Barn (Outside Flat)",
  "Small Silo / Container",
  "Drying Shed",
  "Drying Floor (Small/Household)",
  "Earth Fill Storage",
  "Metal Storage Room",
  "Underground Cellar/Storage",
  "Greenhouse",
  "Polytunnels",
  "Open Space / Shipping Yard"
];
const WAREHOUSE_CAPACITY_UNITS = ["Square Feet (Sq Ft)", "Square Meters", "Bags", "Tons", "Cubic Meters"];
const WAREHOUSE_COVERAGE = [
  "Open (Uncovered)",
  "Partly Covered",
  "Fully Covered",
  "Limited / Partitioned Area",
  "Others"
];
const WAREHOUSE_SECURITY = [
  "Fenced & Gated Access",
  "24/7 On-site Guard",
  "Security Staff",
  "CCTV Cameras",
  "Alarm System",
  "Motion Lighting",
  "Fire Extinguisher / Safety",
  "No Special Security"
];
const WAREHOUSE_LOADING = [
  "Truck / Articulated Truck",
  "Tractor Access",
  "Loading Ramp",
  "Forklift / Hand-Lift Access",
  "Paved Approach Road",
  "Easy Maneuverability Inside / Outside",
  "Dedicated Loading Bay",
  "Tailgate Access"
];
const WAREHOUSE_POWER_WATER = [
  "National Grid Power",
  "3-Phase Power",
  "Backup Generator",
  "Industrial Water / Pumping",
  "Water Tap On-site",
  "Reservoir / Water Tank(s)",
  "Interior Lighting",
  "No Power & Water"
];
const WAREHOUSE_DIMENSIONS = ["10x10", "20x30", "40x40", "50x70"];
const WAREHOUSE_DURATIONS = ["0.5 hr", "01 hr", "02 hr", "03 hr", "04 hr", "24 hr"];
const WAREHOUSE_STORAGE_CONDITIONS = ["Cold", "Ambient", "Dry", "Climate Controlled", "Open Air"];

const FARM_EQUIPMENT_CONDITIONS = [
  { id: "functions", label: "All Functions Work Smoothly" },
  { id: "damage", label: "No Damage, Dents, Or Rust" },
  { id: "safety", label: "Safety Features Intact" },
  { id: "clean", label: "Clean & Well-Maintained" },
  { id: "accessories", label: "Complete With All Accessories" }
] as const;

const MACHINERY_CONDITIONS = [
  { id: "engine", label: "Engine Runs Smoothly" },
  { id: "hydraulics", label: "All Hydraulics Working" },
  { id: "dents", label: "No Major Dents/Welding Issues" },
  { id: "lights", label: "Lights & Safety Features OK" },
  { id: "papers", label: "Papers Complete (RC, Insurance)" }
] as const;

const LABOR_CONDITIONS = [
  { id: "work_desc", label: "Clear Description Of Work" },
  { id: "work_hours", label: "Hours Of Work Confirmed" },
  { id: "availability", label: "Availability (Year-Round)" },
  { id: "authentic", label: "Authentic Image Of Person" },
  { id: "performance", label: "Performance Records (0-10 Scale)" }
] as const;

const DRIVER_CONDITIONS = [
  { id: "license", label: "License Details & Validity Verified" },
  { id: "exp_verified", label: "Years Of Experience Verified" },
  { id: "legal", label: "Verified Against Any Legal Disputes" },
  { id: "verify_through", label: "Availability To Verify Through" },
  { id: "score", label: "Score Clearly Stated" },
  { id: "references", label: "2 References From Previous Employers" }
] as const;

const LAND_CONDITIONS = [
  { id: "size", label: "Exact Size/Measurement Verified" },
  { id: "soil", label: "Soil Type & Yield Documented" },
  { id: "ownership", label: "Legal Ownership/Land Rights Identified" },
  { id: "irrigation", label: "Irrigation Infrastructure Identified" },
  { id: "road", label: "Road Access Status Identified" },
  { id: "lease", label: "Lease Duration Options Listed" },
  { id: "govt", label: "APC/Government Description Provided" }
] as const;

const WAREHOUSE_CONDITIONS = [
  { id: "size", label: "Asset Size / Dimensions Verified" },
  { id: "storage_type", label: "Storage Type (Open / Covered / Cold) Power" },
  { id: "ventilation", label: "Ventilation & Moisture Control Operational" },
  { id: "security", label: "Security Measures Verified" },
  { id: "loading", label: "Loading / Unloading Access Spacious" },
  { id: "utilities", label: "Power & Water Availability Tested" },
  { id: "maintenance", label: "Maintenance Responsibility Verified" }
] as const;

const SOIL_TEST_PACKAGES = [
  "Basic NPK",
  "NPK + PH + EC",
  "Full + Micronutrients",
  "Organic Carbon / Organic Matter",
  "Water Quality Panel",
  "Custom Package"
];
const SOIL_TEST_LOCATIONS = [
  "My Own Lab",
  "Partner / Govt Lab",
  "Field Kit (On-Site)",
  "Mobile Lab Van",
  "Other"
];
const SOIL_SAMPLE_COLLECTION = [
  "I Collect On-Site",
  "Farmer Brings Sample",
  "Courier / Pickup Point",
  "Both On-Site & Pickup"
];
const SOIL_SAMPLES_PER_VISIT = ["1 Sample", "2-3 Samples", "4-5 Samples", "6-10 Samples", "10+ Samples"];
const SOIL_CROPS = [
  "Paddy | Rice",
  "Cotton",
  "Chili",
  "Maize",
  "Sugarcane",
  "Vegetables",
  "Pulses",
  "Oilseeds",
  "Fruits | Orchard",
  "Grapes",
  "Flowers",
  "All Crops"
];
const SOIL_REPORT_FORMATS = [
  "Printed Report",
  "WhatsApp / Digital PDF",
  "Verbal Explanation Of Data",
  "Both Print & Digital"
];
const SOIL_TURNAROUND = ["Same Day", "1-2 Days", "3-5 Days", "1 Week", "2 Weeks"];
const SERVICE_SUPPORT_AREAS = ["5 km", "10 km", "15 km", "20 km", "25 km", "50 km", "District Wide"];
const SERVICE_PRICE_UNITS = ["Per Visit", "Per Sample", "Per Acre", "Per Hour", "Per Day", "Flat Fee"];
const SERVICE_DURATIONS = [
  "1 hour",
  "2 hours",
  "3 hours",
  "5 hours",
  "Half day",
  "Full day",
  "1 Day",
  "2 Days"
];
const SERVICE_AVAILABILITY = [
  "Weekdays",
  "Weekends",
  "Full day",
  "Mornings",
  "Evenings",
  "Mon-Sat",
  "On Request"
];
const SERVICE_AREA_LIMITS = ["10 km", "25 km", "50 km", "100 km", "District Wide", "State Wide"];
const SERVICE_PLATFORM_FEE_PCT = 0.1;

const CONSULTANCY_FARMERS_GET = [
  "Farm Visit Package",
  "Video / Phone Advice",
  "Season Crop Plan",
  "Pest & Disease Diagnosis",
  "Input Plan + Costing",
  "Custom Advisory Package"
];
const CONSULTANCY_ADVISORY_FOCUS = [
  "Fertilizer Planning",
  "Pest & Disease Management",
  "Irrigation Advice",
  "Organic / Natural Farming",
  "Farm Business / Marketing",
  "Soil Health",
  "Seed Variety Choice",
  "Post-harvest / Storage"
];
const CONSULTANCY_DELIVERY = [
  "On-farm Visit",
  "Phone/Video Call",
  "Group/FPO Session",
  "Farm Visit or Call"
];
const CONSULTANCY_EXPERIENCE = ["1-2 Years", "3-5 Years", "5-10 Years", "10+ Years"];
const CONSULTANCY_BACKGROUND = [
  "Agriculture Degree/Diploma",
  "Extension/KVK Experience",
  "Progressive Farmer",
  "Self-Taught/Field Experience",
  "Agri Input Professional",
  "Other"
];
const CONSULTANCY_CROPS = [
  "Paddy / Rice",
  "Cotton",
  "Chilli",
  "Groundnut",
  "Maize",
  "Sugarcane",
  "Oilseeds",
  "Vegetables",
  "Fruits / Orchard",
  "Grapes",
  "Flowers",
  "Pulses",
  "Other Crops"
];
const CONSULTANCY_SEASONS = [
  "Kharif",
  "Rabi",
  "Summer / Zaid",
  "Year Round",
  "Pre-sowing",
  "Harvest Season"
];
const CONSULTANCY_LANGUAGES = [
  "Telugu",
  "Hindi",
  "English",
  "Kannada",
  "Marathi",
  "Malayalam",
  "Tamil"
];

const CONSULTANCY_CONDITIONS = [
  { id: "visit_or_call", label: "Farm Visit Or Video Call" },
  { id: "input_recs", label: "Input Recommendations" },
  { id: "written_notes", label: "Written Summary Notes" },
  { id: "crop_plan", label: "Crop / Season Plan" },
  { id: "cost_estimate", label: "Cost Estimate Guidance" },
  { id: "followup", label: "One Follow-Up Within 7 Days" }
] as const;

const MECHANIC_CATEGORIES = [
  "Repair",
  "Maintenance",
  "Diagnosis",
  "Overhaul",
  "Installation",
  "Other"
];
const MECHANIC_MACHINERY = [
  "Water Pumps",
  "Tractors",
  "Power Tillers",
  "Sprayers",
  "Generators",
  "Attachments",
  "Harvester",
  "Earth Movers",
  "Farm Vehicles"
];
const MECHANIC_SKILLS = [
  "Diesel Engines",
  "Petrol Engines",
  "Electricals",
  "Wiring",
  "Welding",
  "Hydraulics",
  "Fabrications",
  "Steering"
];
const MECHANIC_WHERE = ["Onsite", "Workshop", "Irrigation Advice"];
const MECHANIC_SPARE_PARTS = [
  "I Can Arrange Parts",
  "Provide Parts To Farmers",
  "Other - Discussion Call"
];
const MECHANIC_AVAILABLE_FOR = [
  "Weekdays",
  "Weekends",
  "Full Week",
  "On Call",
  "Peak Season Only"
];
const MECHANIC_TOOLS = [
  "Basic Kit",
  "Full Kit",
  "Tools And Welding Kit",
  "Basic Internal Tools"
];
const MECHANIC_EMERGENCY = [
  "Visit Same day",
  "Peak/Seasonal Only",
  "Scheduled Visit only"
];
const MECHANIC_EXPERIENCE = ["1-2 Years", "3-5 Years", "6-10 Years", "10+ Years"];
const MECHANIC_LANGUAGES = [
  "Telugu",
  "Hindi",
  "English",
  "Kannada",
  "Marathi",
  "Malayalam",
  "Tamil"
];
const MECHANIC_CONDITIONS = [
  { id: "onsite_diag", label: "On-Site Diagnosis" },
  { id: "parts_estimate", label: "Parts Estimate Before Work" },
  { id: "maint_tips", label: "Basic Maintenance Tips" },
  { id: "labor_repair", label: "Labor For Repair" },
  { id: "test_run", label: "Test Run After Repair" },
  { id: "warranty", label: "7-Day Workmanship Warranty" }
] as const;

const IRRIGATION_TYPES = [
  "Start Up / Drip Installation",
  "Maintenance / Repairs",
  "Winterization Service"
];
const IRRIGATION_METHODS = [
  "Design & Installation",
  "Installation Only",
  "Design + Installation",
  "Maintenance / Repair",
  "Audit / Troubleshooting"
];
const IRRIGATION_JOB_SIZES = ["Under 1 acre", "1-5 acres", "10 acres", "20+ acres"];
const IRRIGATION_TECH = [
  "Drip Irrigation",
  "Sprinkler",
  "Infiltration",
  "Micro-Sprinkler",
  "Pump Installation",
  "Civil / Pipeline Work",
  "Fertigation",
  "Monitoring",
  "Training"
];
const IRRIGATION_CONSULTATION = [
  "Basic Advice",
  "On-site Survey",
  "Full Design Consult",
  "Remote Guidance",
  "No Consultation"
];
const IRRIGATION_DURATION = ["1 Day", "2-3 Days", "1 Week", "2 Weeks", "1 Month+"];
const IRRIGATION_BASE_RATES = [
  "₹ 500 / Hour",
  "₹ 2,000 / Day",
  "₹ 5,000 / Acre",
  "Custom Quote"
];
const IRRIGATION_SUPPORT = [
  "Free – 30 days after installation",
  "Limited maintenance (fees apply)",
  "Installation only"
];
const IRRIGATION_CONDITIONS = [
  { id: "drip_sprinkler", label: "Drip System / Sprinkler System" },
  { id: "install_advisor", label: "Installation Advisor" },
  { id: "pump_design", label: "Pump design/selection" },
  { id: "layout_blueprint", label: "Layout & Design Blueprint" },
  { id: "system_test", label: "System Test & Setup" },
  { id: "year_service", label: "One Year Service and Maintenance" }
] as const;

const DRONE_BRANDS = [
  "DJI Agras T50",
  "DJI Agras T40",
  "XAG P100",
  "Yamaha RMAX",
  "Other"
];
const DRONE_SERVICE_TYPES = [
  "Fertilizing",
  "Crop Spraying",
  "Field Scouting",
  "Weed Seeding",
  "Broadcasts"
];
const DRONE_MIN_AREA = ["Under 1 acre", "1-5 Acres", "5-10 Acres"];
const DRONE_MAX_AREA = ["Under 1 acre", "1-5 Acres", "5-10 Acres", "10-20 Acres", "20+ Acres"];
const DRONE_EXPERIENCE = ["Beginner", "Intermediate", "Advanced", "Expert"];
const DRONE_LICENSE = ["Licensed", "In Training", "Applied For", "Not Required"];
const DRONE_INSURANCE = ["Fully Insured", "Partial Coverage", "Not Insured"];
const DRONE_CROPS = [
  "Maize / Corn",
  "Cotton",
  "Grain",
  "Fruits",
  "Vegetables",
  "Coffee",
  "Oilseeds",
  "Roots / Tubers",
  "Legumes",
  "Tea",
  "Other crops"
];
const DRONE_FLUID = [
  "Normal Pesticides/chemicals",
  "Crop Protection Chemicals",
  "Water Soluble Fertilizers"
];
const DRONE_EQUIPMENT = [
  "GPS RTK",
  "Multispectral Camera",
  "Standard Spray Kit",
  "Mapping Module",
  "Basic Kit"
];
const DRONE_COVERAGE = [
  "Normal (Regular) Field area",
  "3-Core Average Coverage",
  "Drones with Mapping Precision"
];
const DRONE_CAPACITY = ["10-liter Pro", "16-liter Agri-jet", "20-liter + Large area"];
const DRONE_PHASE = ["Low Bio", "Mid Bio", "New Sprayer/Prot"];
const DRONE_POLICY = [
  "Reschedule due to weather conditions",
  "Partial Spray + Refund policy",
  "Standard Drone Care"
];
const DRONE_CONDITIONS = [
  { id: "pilot_license", label: "Pilot license/operator" },
  { id: "spray_plan", label: "Spray plan for detailed area" },
  { id: "flight_boundary", label: "Flight boundary / map ready" },
  { id: "prespray_weather", label: "Pre-spray / weather check" },
  { id: "weather_safety", label: "Weather safety checks" },
  { id: "obstacle_avoid", label: "Ultrasonic spray avoidance" }
] as const;

const INSPECTION_FOCUS = [
  "Pest Scouting",
  "Disease Check",
  "Nutrient Deficiency Signs",
  "Growth Stage Assessment",
  "Fire and Heat Readiness",
  "Livestock & Pasture Health",
  "Weed identification"
];
const INSPECTION_CROPS = [
  "Paddy/Rice",
  "Maize",
  "Wheat",
  "Millet",
  "Sugar cane",
  "Vegetables",
  "Tubers",
  "Oil seeds",
  "Fruits & Orchard",
  "Walnuts",
  "Fiber crops"
];
const INSPECTION_TOOLS = ["Hand lenses", "Soil probes", "Drones", "Others"];
const INSPECTION_EXPERIENCE = [
  "Field Scouting",
  "Remote Pilot",
  "Professional Agronomist",
  "10+ years"
];
const INSPECTION_METHODS = [
  "Field Walk-through",
  "Drone + Aerial Analysis",
  "Soil Sampling",
  "Laboratory Analysis Referral"
];
const INSPECTION_REPORTING = [
  "Photo + WhatsApp report",
  "Written Inspection Report",
  "Data & Analysis Dashboard Link",
  "Verbal Summary on Site"
];
const INSPECTION_FOLLOWUP = [
  "Yes - One follow up call",
  "Yes - Within 7 days",
  "Advice on treatment/action"
];
const INSPECTION_LEAD_TIME = ["1 - 2 days", "2 - 5 days", "5 - 10 days", "10+ days"];
const INSPECTION_SOIL_HEALTH = [
  "Basic NPK Check",
  "Full Soil Panel",
  "Visual Assessment Only",
  "Lab Referral",
  "Not Included"
];
const INSPECTION_CONDITIONS = [
  { id: "professional", label: "Professional Thorough" },
  { id: "photo_evidence", label: "Photo Evidence" },
  { id: "market_summary", label: "Short Market Summary" },
  { id: "followup_call", label: "One Follow-up Call" },
  { id: "action_recs", label: "Action recommendations" },
  { id: "pest_disease", label: "Pest & Disease Identification" }
] as const;

const REPAIR_EQUIPMENT_CATEGORIES = [
  "Compost",
  "Tillers",
  "Seeders/Drills",
  "Planters",
  "Transplanters",
  "Fertilizers",
  "Sprayers"
];
const REPAIR_BRANDS = [
  "John Deere",
  "CNH Industrial",
  "Kubota",
  "AGCO Corporation",
  "Mahindra & Mahindra Ltd",
  "Yanmar",
  "CLAAS"
];
const REPAIR_SERVICE_CATEGORIES = [
  "Repair",
  "Maintenance",
  "Irrigation Advice",
  "Crop Inspection"
];
const REPAIR_TYPES = [
  "Common Parts in Stock",
  "1-Day Brake Fix",
  "Standard Quality Parts"
];
const REPAIR_SERVICE_TYPES = ["Standard", "Premium", "Advanced", "Full Inspection"];
const REPAIR_DRIVE_POWER = ["Manual", "Electric", "Petrol", "Diesel", "PTO"];
const REPAIR_LIFT_CAPACITY = ["N/A", "Under 500 kg", "500-1000 kg", "1-2 Ton", "2+ Ton"];
const REPAIR_MIN_ORDER = ["1 Job", "2-3 Jobs", "Weekly Retainer", "Custom"];
const REPAIR_WARRANTY = ["No Warranty", "7 Days", "30 Days", "6 Months"];
const REPAIR_LANGUAGES = [
  "Telugu",
  "Hindi",
  "English",
  "Kannada",
  "Marathi",
  "Malayalam",
  "Tamil"
];
const REPAIR_CONDITIONS = [
  { id: "inspection_checklist", label: "Inspection checklist" },
  { id: "photos_videos", label: "Photos/Videos approved" },
  { id: "visual_note", label: "Visual account note" },
  { id: "pickup_drop", label: "Pickup/Drop off timestamp" },
  { id: "post_test", label: "Post Service Test" },
  { id: "logbook", label: "Logbook for Service/Repair" }
] as const;

const SOIL_CONDITIONS = [
  { id: "onsite", label: "On-Site Sample Collection" },
  { id: "analysis", label: "Soil Analysis Report" },
  { id: "calibration", label: "Lab Calibration / Standards Shared" },
  { id: "turnaround", label: "Report Turnaround Confirmed" },
  { id: "recommendations", label: "Crop Recommendations Included" },
  { id: "support", label: "Follow-Up Support Available" }
] as const;

const SERVICE_CONDITIONS = [
  { id: "scope", label: "Clear Scope Of Service Listed" },
  { id: "area", label: "Service Area Confirmed" },
  { id: "timing", label: "Availability / Timing Confirmed" },
  { id: "pricing", label: "Pricing Basis Explained" },
  { id: "proof", label: "Proof Of Work / Credentials Available" }
] as const;

type ConditionItem = { id: string; label: string };

function conditionsForAsset(assetId: string): ConditionItem[] {
  if (assetId === "machinery") return [...MACHINERY_CONDITIONS];
  if (assetId === "labor") return [...LABOR_CONDITIONS];
  if (assetId === "drivers") return [...DRIVER_CONDITIONS];
  if (assetId === "land") return [...LAND_CONDITIONS];
  if (assetId === "warehouse") return [...WAREHOUSE_CONDITIONS];
  if (assetId === "soil_testing") return [...SOIL_CONDITIONS];
  if (assetId === "farm_consultancy") return [...CONSULTANCY_CONDITIONS];
  if (assetId === "mechanic_services") return [...MECHANIC_CONDITIONS];
  if (assetId === "irrigation_services") return [...IRRIGATION_CONDITIONS];
  if (assetId === "drone_spraying") return [...DRONE_CONDITIONS];
  if (assetId === "crop_inspection") return [...INSPECTION_CONDITIONS];
  if (assetId === "equipment_repair") return [...REPAIR_CONDITIONS];
  return [...FARM_EQUIPMENT_CONDITIONS];
}

function parseDurationHours(value: string): number {
  const match = value.match(/([\d.]+)/);
  return match ? Number(match[1]) || 0 : 0;
}

function formatInr(n: number) {
  return `₹ ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function assetsForChannel(channel: ListingChannel): AssetOption[] {
  switch (channel) {
    case "Services":
      return SERVICE_ASSETS;
    case "Store":
      return STORE_ASSETS;
    case "Educators":
      return EDUCATOR_ASSETS;
    case "Rental":
    default:
      return RENTAL_ASSETS;
  }
}

function SelectField({
  label,
  placeholder,
  value,
  options,
  onSelect,
  required
}: {
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.req}>*</Text> : null}
      </Text>
      <Pressable style={styles.select} onPress={() => setOpen((v) => !v)}>
        <Text style={value ? styles.selectVal : styles.selectPlaceholder}>{value || placeholder}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#FFFFFF" />
      </Pressable>
      {open ? (
        <View style={styles.selectList}>
          <Text style={styles.selectListTitle}>{placeholder}</Text>
          {options.map((opt, index) => {
            const selected = value === opt;
            const isLast = index === options.length - 1;
            return (
              <View key={opt}>
                <Pressable
                  style={[styles.selectItem, selected && styles.selectItemSelected]}
                  onPress={() => {
                    onSelect(opt);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.selectItemText, selected && styles.selectItemTextSelected]}>{opt}</Text>
                </Pressable>
                {!isLast ? <View style={styles.selectItemDivider} /> : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <View style={styles.stepDots}>
      {[1, 2, 3].map((n, i) => {
        const done = n < step;
        const active = n === step;
        return (
          <React.Fragment key={n}>
            <View style={[styles.dot, active && styles.dotActive, done && styles.dotDone]}>
              {done ? <Ionicons name="checkmark" size={10} color="#000" /> : null}
              {!done ? (
                <View style={[styles.dotCore, active ? styles.dotCoreActive : styles.dotCoreMuted]} />
              ) : null}
            </View>
            {i < 2 ? <View style={[styles.dotLine, done && styles.dotLineDone]} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export function ProviderNewListingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const [channel, setChannel] = useState<ListingChannel>("Rental");
  const [step, setStep] = useState<Step>(1);
  const [selectedAsset, setSelectedAsset] = useState<string>("");

  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [powerHp, setPowerHp] = useState("");
  const [fuel, setFuel] = useState("");
  const [usageGuidance, setUsageGuidance] = useState("");
  const [priceHr, setPriceHr] = useState("");
  const [engineType, setEngineType] = useState("");
  const [fuelConsumption, setFuelConsumption] = useState("");
  const [operatorSupport, setOperatorSupport] = useState("");
  const [deliveryAvailable, setDeliveryAvailable] = useState("");
  const [laborCategory, setLaborCategory] = useState("");
  const [laborType, setLaborType] = useState("");
  const [laborTeamSize, setLaborTeamSize] = useState("");
  const [laborGender, setLaborGender] = useState("");
  const [laborShift, setLaborShift] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [laborLanguage, setLaborLanguage] = useState("");
  const [driverSkillSet, setDriverSkillSet] = useState("");
  const [driverExpertise, setDriverExpertise] = useState("");
  const [driverLicense, setDriverLicense] = useState("");
  const [driverExperience, setDriverExperience] = useState("");
  const [driverAvailability, setDriverAvailability] = useState("");
  const [driverLanguage, setDriverLanguage] = useState("");
  const [landCategory, setLandCategory] = useState("");
  const [landType, setLandType] = useState("");
  const [landDistrict, setLandDistrict] = useState("");
  const [landTown, setLandTown] = useState("");
  const [landUnit, setLandUnit] = useState("");
  const [landRentalType, setLandRentalType] = useState("");
  const [landWaterAccess, setLandWaterAccess] = useState("");
  const [landSoilType, setLandSoilType] = useState("");
  const [landAvailableFrom, setLandAvailableFrom] = useState("");
  const [landOwnedBy, setLandOwnedBy] = useState("");
  const [landCategorySupported, setLandCategorySupported] = useState("");
  const [warehouseStorageType, setWarehouseStorageType] = useState("");
  const [warehouseCapacity, setWarehouseCapacity] = useState("");
  const [warehouseCoverage, setWarehouseCoverage] = useState("");
  const [warehouseSecurity, setWarehouseSecurity] = useState("");
  const [warehouseLoading, setWarehouseLoading] = useState("");
  const [warehousePowerWater, setWarehousePowerWater] = useState("");
  const [warehouseDuration, setWarehouseDuration] = useState("");
  const [warehouseDimension, setWarehouseDimension] = useState("");
  const [warehouseStorageCondition, setWarehouseStorageCondition] = useState("");
  const [farmersGet, setFarmersGet] = useState("");
  const [soilTestPackage, setSoilTestPackage] = useState("");
  const [soilTestingLocation, setSoilTestingLocation] = useState("");
  const [soilSampleCollection, setSoilSampleCollection] = useState("");
  const [soilSamplesPerVisit, setSoilSamplesPerVisit] = useState("");
  const [soilCrops, setSoilCrops] = useState("");
  const [soilReportFormat, setSoilReportFormat] = useState("");
  const [soilTurnaround, setSoilTurnaround] = useState("");
  const [serviceSupportArea, setServiceSupportArea] = useState("");
  const [serviceDuration, setServiceDuration] = useState("");
  const [serviceAvailability, setServiceAvailability] = useState("");
  const [consultancyAdvisoryFocus, setConsultancyAdvisoryFocus] = useState("");
  const [consultancyDelivery, setConsultancyDelivery] = useState("");
  const [consultancyExperience, setConsultancyExperience] = useState("");
  const [consultancyBackground, setConsultancyBackground] = useState("");
  const [consultancySeasons, setConsultancySeasons] = useState("");
  const [consultancyLanguages, setConsultancyLanguages] = useState("");
  const [mechanicCategory, setMechanicCategory] = useState("");
  const [mechanicMachinery, setMechanicMachinery] = useState("");
  const [mechanicSkills, setMechanicSkills] = useState("");
  const [mechanicWhere, setMechanicWhere] = useState("");
  const [mechanicSpareParts, setMechanicSpareParts] = useState("");
  const [mechanicAvailableFor, setMechanicAvailableFor] = useState("");
  const [mechanicTools, setMechanicTools] = useState("");
  const [mechanicEmergency, setMechanicEmergency] = useState("");
  const [mechanicExperience, setMechanicExperience] = useState("");
  const [mechanicLanguages, setMechanicLanguages] = useState("");
  const [irrigationType, setIrrigationType] = useState("");
  const [irrigationMethod, setIrrigationMethod] = useState("");
  const [irrigationJobSize, setIrrigationJobSize] = useState("");
  const [irrigationTech, setIrrigationTech] = useState("");
  const [irrigationConsultation, setIrrigationConsultation] = useState("");
  const [irrigationDuration, setIrrigationDuration] = useState("");
  const [irrigationBaseRate, setIrrigationBaseRate] = useState("");
  const [irrigationSupport, setIrrigationSupport] = useState("");
  const [droneBrand, setDroneBrand] = useState("");
  const [droneServiceType, setDroneServiceType] = useState("");
  const [droneMinArea, setDroneMinArea] = useState("");
  const [droneMaxArea, setDroneMaxArea] = useState("");
  const [droneExperience, setDroneExperience] = useState("");
  const [droneLicense, setDroneLicense] = useState("");
  const [droneInsurance, setDroneInsurance] = useState("");
  const [droneCrops, setDroneCrops] = useState("");
  const [droneFluid, setDroneFluid] = useState("");
  const [droneEquipment, setDroneEquipment] = useState("");
  const [droneCoverage, setDroneCoverage] = useState("");
  const [droneCapacity, setDroneCapacity] = useState("");
  const [dronePhase, setDronePhase] = useState("");
  const [dronePolicy, setDronePolicy] = useState("");
  const [inspectionFocus, setInspectionFocus] = useState("");
  const [inspectionCrops, setInspectionCrops] = useState("");
  const [inspectionTools, setInspectionTools] = useState("");
  const [inspectionExperience, setInspectionExperience] = useState("");
  const [inspectionMethods, setInspectionMethods] = useState("");
  const [inspectionReporting, setInspectionReporting] = useState("");
  const [inspectionFollowup, setInspectionFollowup] = useState("");
  const [inspectionLeadTime, setInspectionLeadTime] = useState("");
  const [inspectionSoilHealth, setInspectionSoilHealth] = useState("");
  const [repairEquipCategory, setRepairEquipCategory] = useState("");
  const [repairBrand, setRepairBrand] = useState("");
  const [repairServiceCategory, setRepairServiceCategory] = useState("");
  const [repairType, setRepairType] = useState("");
  const [repairServiceType, setRepairServiceType] = useState("");
  const [repairDrivePower, setRepairDrivePower] = useState("");
  const [repairLiftCapacity, setRepairLiftCapacity] = useState("");
  const [repairMinOrder, setRepairMinOrder] = useState("");
  const [repairWarranty, setRepairWarranty] = useState("");
  const [repairLanguages, setRepairLanguages] = useState("");
  const [minDuration, setMinDuration] = useState("");
  const [personsRequired, setPersonsRequired] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<Array<{ uri: string; name: string }>>([]);
  const [conditions, setConditions] = useState<Record<string, boolean>>({});
  const [agreedTerms, setAgreedTerms] = useState(false);

  const [dailyRate, setDailyRate] = useState("");
  const [rateUnit, setRateUnit] = useState("Hour");
  const [serviceArea, setServiceArea] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  const assets = assetsForChannel(channel);
  const selectedAssetMeta = useMemo(
    () => assets.find((a) => a.id === selectedAsset) ?? assets[0],
    [assets, selectedAsset]
  );
  const isMachinery = selectedAsset === "machinery";
  const isLabor = selectedAsset === "labor";
  const isDriver = selectedAsset === "drivers";
  const isLand = selectedAsset === "land";
  const isWarehouse = selectedAsset === "warehouse";
  const isSoilTesting = selectedAsset === "soil_testing";
  const isFarmConsultancy = selectedAsset === "farm_consultancy";
  const isMechanic = selectedAsset === "mechanic_services";
  const isIrrigation = selectedAsset === "irrigation_services";
  const isDrone = selectedAsset === "drone_spraying";
  const isCropInspection = selectedAsset === "crop_inspection";
  const isEquipmentRepair = selectedAsset === "equipment_repair";
  const isService = channel === "Services";
  const conditionItems = useMemo(() => conditionsForAsset(selectedAsset), [selectedAsset]);

  const canGoStep3 = isSoilTesting
    ? equipmentName.trim().length > 1 &&
      farmersGet.trim().length > 0 &&
      soilTestPackage.trim().length > 0 &&
      soilTestingLocation.trim().length > 0 &&
      soilSampleCollection.trim().length > 0 &&
      soilSamplesPerVisit.trim().length > 0 &&
      soilCrops.trim().length > 0 &&
      soilReportFormat.trim().length > 0 &&
      soilTurnaround.trim().length > 0 &&
      photos.length > 0 &&
      agreedTerms
    : isFarmConsultancy
      ? equipmentName.trim().length > 1 &&
        farmersGet.trim().length > 0 &&
        consultancyAdvisoryFocus.trim().length > 0 &&
        consultancyDelivery.trim().length > 0 &&
        consultancyExperience.trim().length > 0 &&
        consultancyBackground.trim().length > 0 &&
        soilCrops.trim().length > 0 &&
        consultancySeasons.trim().length > 0 &&
        consultancyLanguages.trim().length > 0 &&
        photos.length > 0 &&
        agreedTerms
      : isMechanic
        ? equipmentName.trim().length > 1 &&
          mechanicCategory.trim().length > 0 &&
          mechanicMachinery.trim().length > 0 &&
          mechanicSkills.trim().length > 0 &&
          mechanicWhere.trim().length > 0 &&
          mechanicSpareParts.trim().length > 0 &&
          mechanicAvailableFor.trim().length > 0 &&
          mechanicTools.trim().length > 0 &&
          mechanicEmergency.trim().length > 0 &&
          mechanicExperience.trim().length > 0 &&
          mechanicLanguages.trim().length > 0 &&
          photos.length > 0 &&
          agreedTerms
        : isIrrigation
          ? equipmentName.trim().length > 1 &&
            farmersGet.trim().length > 0 &&
            irrigationType.trim().length > 0 &&
            irrigationMethod.trim().length > 0 &&
            irrigationJobSize.trim().length > 0 &&
            irrigationTech.trim().length > 0 &&
            irrigationConsultation.trim().length > 0 &&
            irrigationDuration.trim().length > 0 &&
            irrigationBaseRate.trim().length > 0 &&
            irrigationSupport.trim().length > 0 &&
            photos.length > 0 &&
            agreedTerms
          : isDrone
            ? equipmentName.trim().length > 1 &&
              droneBrand.trim().length > 0 &&
              droneServiceType.trim().length > 0 &&
              droneMinArea.trim().length > 0 &&
              droneMaxArea.trim().length > 0 &&
              droneExperience.trim().length > 0 &&
              droneLicense.trim().length > 0 &&
              droneInsurance.trim().length > 0 &&
              droneCrops.trim().length > 0 &&
              droneFluid.trim().length > 0 &&
              droneEquipment.trim().length > 0 &&
              droneCoverage.trim().length > 0 &&
              droneCapacity.trim().length > 0 &&
              dronePhase.trim().length > 0 &&
              dronePolicy.trim().length > 0 &&
              photos.length > 0 &&
              agreedTerms
            : isCropInspection
              ? equipmentName.trim().length > 1 &&
                farmersGet.trim().length > 0 &&
                inspectionFocus.trim().length > 0 &&
                inspectionCrops.trim().length > 0 &&
                inspectionTools.trim().length > 0 &&
                inspectionExperience.trim().length > 0 &&
                inspectionMethods.trim().length > 0 &&
                inspectionReporting.trim().length > 0 &&
                inspectionFollowup.trim().length > 0 &&
                inspectionLeadTime.trim().length > 0 &&
                inspectionSoilHealth.trim().length > 0 &&
                photos.length > 0 &&
                agreedTerms
              : isEquipmentRepair
                ? equipmentName.trim().length > 1 &&
                  farmersGet.trim().length > 0 &&
                  repairEquipCategory.trim().length > 0 &&
                  repairBrand.trim().length > 0 &&
                  repairServiceCategory.trim().length > 0 &&
                  repairType.trim().length > 0 &&
                  repairServiceType.trim().length > 0 &&
                  repairDrivePower.trim().length > 0 &&
                  repairLiftCapacity.trim().length > 0 &&
                  repairMinOrder.trim().length > 0 &&
                  repairWarranty.trim().length > 0 &&
                  repairLanguages.trim().length > 0 &&
                  photos.length > 0 &&
                  agreedTerms
                : isService
                  ? equipmentName.trim().length > 1 &&
                    farmersGet.trim().length > 0 &&
                    serviceSupportArea.trim().length > 0 &&
                    photos.length > 0 &&
                    agreedTerms
                  : isWarehouse
                    ? equipmentName.trim().length > 1 &&
                      warehouseStorageType.trim().length > 0 &&
                      warehouseCapacity.trim().length > 0 &&
                      warehouseCoverage.trim().length > 0 &&
                      warehouseSecurity.trim().length > 0 &&
                      warehouseLoading.trim().length > 0 &&
                      warehousePowerWater.trim().length > 0 &&
                      photos.length > 0 &&
                      agreedTerms
                    : isLand
                      ? equipmentName.trim().length > 1 &&
                        landCategory.trim().length > 0 &&
                        landType.trim().length > 0 &&
                        landDistrict.trim().length > 0 &&
                        landTown.trim().length > 0 &&
                        landUnit.trim().length > 0 &&
                        landRentalType.trim().length > 0 &&
                        photos.length > 0 &&
                        agreedTerms
                      : isDriver
                        ? equipmentName.trim().length > 1 &&
                          driverSkillSet.trim().length > 0 &&
                          driverExpertise.trim().length > 0 &&
                          driverLicense.trim().length > 0 &&
                          driverExperience.trim().length > 0 &&
                          driverAvailability.trim().length > 0 &&
                          photos.length > 0 &&
                          agreedTerms
                        : isLabor
                          ? equipmentName.trim().length > 1 &&
                            laborCategory.trim().length > 0 &&
                            laborType.trim().length > 0 &&
                            laborTeamSize.trim().length > 0 &&
                            laborGender.trim().length > 0 &&
                            laborShift.trim().length > 0 &&
                            laborHours.trim().length > 0 &&
                            photos.length > 0 &&
                            agreedTerms
                          : isMachinery
                            ? equipmentName.trim().length > 1 &&
                              priceHr.trim().length > 0 &&
                              engineType.trim().length > 0 &&
                              fuelConsumption.trim().length > 0 &&
                              operatorSupport.trim().length > 0 &&
                              deliveryAvailable.trim().length > 0 &&
                              photos.length > 0 &&
                              agreedTerms
                            : equipmentName.trim().length > 1 &&
                              equipmentType.trim().length > 0 &&
                              powerHp.trim().length > 0 &&
                              usageGuidance.trim().length > 0 &&
                              photos.length > 0 &&
                              agreedTerms;

  const rateNum = Number(dailyRate.replace(/,/g, "")) || 0;
  const warehouseHours = parseDurationHours(warehouseDuration);
  const warehouseTotal = isWarehouse && warehouseHours > 0 ? rateNum * warehouseHours : rateNum;
  const feePct = isWarehouse ? 0.05 : isService ? SERVICE_PLATFORM_FEE_PCT : PLATFORM_FEE_PCT;
  const feeBase = isWarehouse ? warehouseTotal : rateNum;
  const platformFee = feeBase * feePct;
  const youReceive = feeBase - platformFee;
  const feePctLabel = Math.round(feePct * 1000) / 10;
  const earnPctLabel = Math.round((1 - feePct) * 1000) / 10;
  const rateUnitShort = rateUnit.replace(/^Per\s+/i, "") || rateUnit;
  const canGoReview = isSoilTesting || isService
    ? rateNum > 0 &&
      !!rateUnit &&
      !!serviceDuration &&
      !!serviceAvailability &&
      !!serviceArea
    : isWarehouse
      ? rateNum > 0 && !!warehouseDuration && !!warehouseDimension && !!warehouseStorageCondition
      : isLand
        ? rateNum > 0 && !!rateUnit && !!landAvailableFrom && !!serviceArea
        : isLabor
          ? rateNum > 0 && !!rateUnit && !!minDuration && personsRequired.trim().length > 0
          : rateNum > 0 && !!rateUnit && !!serviceArea;
  const checkedConditions = conditionItems.filter((c) => conditions[c.id]);

  const onHeaderBack = () => {
    if (step === 1) {
      navigation.goBack();
      return;
    }
    setStep((s) => (s - 1) as Step);
  };

  const pickPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to upload listing images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 6
    });
    if (result.canceled || !result.assets?.length) return;
    const next = result.assets
      .filter((a) => !!a.uri)
      .map((a, idx) => ({
        uri: a.uri,
        name: a.fileName || `photo-${Date.now()}-${idx}.jpg`
      }));
    setPhotos((prev) => [...prev, ...next].slice(0, 8));
  };

  const toggleCondition = (id: string) => {
    setConditions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const onAddFarmEquipment = () => {
    if (!canGoStep3) {
      Alert.alert(
        "Complete required fields",
        isSoilTesting
          ? "Service name, what farmers get, test package, location, sample collection, samples, crops, report format, turnaround, photo, and terms are required."
          : isFarmConsultancy
            ? "Service name, what farmers get, advisory focus, delivery, experience, background, crops, seasons, languages, photo, and terms are required."
            : isMechanic
              ? "Service name, category, machinery, skills, location, spare parts, availability, tools, emergency support, experience, languages, photo, and terms are required."
              : isIrrigation
                ? "Display name, short description, type, method, job size, tech, consultation, duration, base rate, support, photo, and terms are required."
                : isDrone
                  ? "Service name, brand, type, areas, experience, license, insurance, crops, fluid, equipment, coverage, capacity, phase, policy, photo, and terms are required."
                  : isCropInspection
                    ? "Service name, brief description, focus, crops, tools, experience, methods, reporting, follow-up, lead time, soil health, photo, and terms are required."
                    : isEquipmentRepair
                      ? "Service name, description, equipment category, brand, service category, type, quality, drive/power, lift capacity, min order, warranty, language, photo, and terms are required."
                      : isService
                        ? "Service name, what farmers get, support area, photo, and terms are required."
                        : isWarehouse
                          ? "Name, storage type, capacity, coverage, security, loading access, power & water, photo, and terms are required."
                          : isLand
                            ? "Name, category, land type, district, town, unit, rental type, photo, and terms are required."
                            : isDriver
                              ? "Name, skill set, expertise, license, experience, availability, photo, and terms are required."
                              : isLabor
                                ? "Name, category, labour type, team size, gender, shift, hours, photo, and terms are required."
                                : isMachinery
                                  ? "Name, price, engine type, fuel consumption, operator support, delivery, photo, and terms are required."
                                  : "Name, type, power, usage guidance, at least one photo, and terms are required."
      );
      return;
    }
    if (isMachinery && priceHr.trim() && !dailyRate.trim()) {
      setDailyRate(priceHr);
      setRateUnit("Hour");
    }
    setStep(3);
  };

  const onPublish = () => {
    Alert.alert(
      "Listing published",
      isSoilTesting
        ? "Your soil testing service listing is live for review."
        : isFarmConsultancy
          ? "Your farm consultancy listing is live for review."
          : isMechanic
            ? "Your mechanic service listing is live for review."
            : isIrrigation
              ? "Your irrigation service listing is live for review."
              : isDrone
                ? "Your drone spray listing is live for review."
                : isCropInspection
                  ? "Your crop inspection listing is live for review."
                  : isEquipmentRepair
                    ? "Your equipment repair listing is live for review."
                    : isService
                      ? "Your service listing is live for review."
                      : isWarehouse
                        ? "Your warehouse listing is live for review."
                        : isLand
                          ? "Your land listing is live for review."
                          : isDriver
                            ? "Your driver listing is live for review."
                            : isLabor
                              ? "Your labour listing is live for review."
                              : isMachinery
                                ? "Your machinery listing is live for review."
                                : "Your farm equipment listing is live for review.",
      [
      { text: "OK", onPress: () => navigation.goBack() }
    ]);
  };

  const headerTitle = step === 4 ? "Review & Publish" : "New Listing";
  const winH = Dimensions.get("window").height;
  const topGap = Math.max(insets.top + 8, 52);
  const sheetHeight = step === 4 ? winH - topGap : Math.min(594, winH - topGap);

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={() => navigation.goBack()} />
      <View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            paddingBottom: Math.max(insets.bottom, 8)
          }
        ]}
      >
        {step < 4 ? <View style={styles.handle} /> : null}

        <View style={styles.topBar}>
          <Pressable style={styles.backBtn} onPress={onHeaderBack} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={APP_LIME} />
          </Pressable>
          <Text style={styles.topTitle}>{headerTitle}</Text>
        </View>

        {step < 4 ? (
          <View style={styles.channelRow}>
            {CHANNELS.map((item) => {
              const active = channel === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.channelItem, active && styles.channelItemActive]}
                  onPress={() => {
                    if (step !== 1) return;
                    setChannel(item.id);
                    setSelectedAsset("");
                    if (item.id === "Services") {
                      setRateUnit("Per Visit");
                    } else if (rateUnit.startsWith("Per ")) {
                      setRateUnit("Hour");
                    }
                  }}
                >
                  {item.icon ? (
                    <Image
                      source={item.icon}
                      style={[styles.channelIcon, { tintColor: active ? APP_LIME : "#FFFFFF" }]}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons
                      name={item.fallbackIcon}
                      size={18}
                      color={active ? APP_LIME : "#FFFFFF"}
                    />
                  )}
                  <Text style={[styles.channelLabel, active && styles.channelLabelActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 ? (
            <View style={[styles.card, styles.step1Card]}>
              <View style={styles.cardHead}>
                <View style={styles.cardHeadLeft}>
                  <Text style={styles.sectionEyebrow}>
                    {channel === "Services" ? "List Your Services" : "List Your Asset"}
                  </Text>
                  <Text style={styles.stepTextLeftInline}>Step 1 Of 3</Text>
                </View>
                <StepIndicator step={1} />
              </View>
              <View style={styles.cardDivider} />
              <Text style={[styles.sectionTitle, styles.sectionTitlePadded]}>
                {channel === "Services" ? "What Type Of Service Do You Provide?" : "What Are You Listing?"}
              </Text>
              {assets.map((asset, index) => {
                const selected = selectedAsset === asset.id;
                return (
                  <Pressable
                    key={asset.id}
                    style={[
                      styles.assetRow,
                      selected && styles.assetRowSelected,
                      index === assets.length - 1 && styles.assetRowLast
                    ]}
                    onPress={() => {
                      setSelectedAsset(asset.id);
                      setConditions({});
                    }}
                  >
                    <View style={styles.assetCopy}>
                      <Text style={[styles.assetTitle, selected && styles.assetTitleSelected]}>{asset.title}</Text>
                      <Text style={styles.assetSub}>{asset.subtitle}</Text>
                    </View>
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

        {step === 2 ? (
          <View style={styles.stepBody}>
            <View style={styles.stepPanel}>
              <View style={styles.cardHeadOutside}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionEyebrow}>
                    {isService ? "Service Details" : "Asset Details & Condition"}
                  </Text>
                  <Text style={styles.stepAssetLine}>
                    <Text style={styles.stepTextMuted}>Step 2 Of 3 | </Text>
                    {selectedAssetMeta?.title ?? "Farm Equipment"}
                  </Text>
                </View>
                <StepIndicator step={2} />
              </View>

              <View style={styles.panelDivider} />

              <View style={styles.detailsForm}>
              {isSoilTesting ? (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Service name <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={equipmentName}
                      onChangeText={setEquipmentName}
                      placeholder="E.g. Fast Soil NPK Testing"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      What farmers get <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={farmersGet}
                      onChangeText={setFarmersGet}
                      placeholder="E.g. Lab report + crop advice"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                  <SelectField
                    label="Test package"
                    required
                    placeholder="Select Test Package"
                    value={soilTestPackage}
                    options={SOIL_TEST_PACKAGES}
                    onSelect={setSoilTestPackage}
                  />
                  <SelectField
                    label="Testing location"
                    required
                    placeholder="Select Testing Location"
                    value={soilTestingLocation}
                    options={SOIL_TEST_LOCATIONS}
                    onSelect={setSoilTestingLocation}
                  />
                  <SelectField
                    label="Sample collection"
                    required
                    placeholder="Select Sample Collection"
                    value={soilSampleCollection}
                    options={SOIL_SAMPLE_COLLECTION}
                    onSelect={setSoilSampleCollection}
                  />
                  <SelectField
                    label="Samples per visit"
                    required
                    placeholder="Select Samples Per Visit"
                    value={soilSamplesPerVisit}
                    options={SOIL_SAMPLES_PER_VISIT}
                    onSelect={setSoilSamplesPerVisit}
                  />
                  <SelectField
                    label="Crops you support"
                    required
                    placeholder="Select Crops You Support"
                    value={soilCrops}
                    options={SOIL_CROPS}
                    onSelect={setSoilCrops}
                  />
                  <SelectField
                    label="Report format"
                    required
                    placeholder="Select Report Format"
                    value={soilReportFormat}
                    options={SOIL_REPORT_FORMATS}
                    onSelect={setSoilReportFormat}
                  />
                  <SelectField
                    label="Typical turnaround"
                    required
                    placeholder="Select Typical Turnaround"
                    value={soilTurnaround}
                    options={SOIL_TURNAROUND}
                    onSelect={setSoilTurnaround}
                  />
                  <SelectField
                    label="Area you support"
                    placeholder="Select Area You Support"
                    value={serviceSupportArea}
                    options={SERVICE_SUPPORT_AREAS}
                    onSelect={setServiceSupportArea}
                  />
                  <Pressable style={styles.addEquipmentBtn} onPress={onAddFarmEquipment}>
                    <Text style={styles.addEquipmentText}>Add Services</Text>
                  </Pressable>
                </>
              ) : isFarmConsultancy ? (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Service Name <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={equipmentName}
                      onChangeText={setEquipmentName}
                      placeholder="e.g. Complete Soil Health Test"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                  <SelectField
                    label="What farmers get"
                    required
                    placeholder="Select Category"
                    value={farmersGet}
                    options={CONSULTANCY_FARMERS_GET}
                    onSelect={setFarmersGet}
                  />
                  <SelectField
                    label="Advisory Focus"
                    required
                    placeholder="Select Advisory Focus"
                    value={consultancyAdvisoryFocus}
                    options={CONSULTANCY_ADVISORY_FOCUS}
                    onSelect={setConsultancyAdvisoryFocus}
                  />
                  <SelectField
                    label="How you deliver"
                    required
                    placeholder="Select Delivery method"
                    value={consultancyDelivery}
                    options={CONSULTANCY_DELIVERY}
                    onSelect={setConsultancyDelivery}
                  />
                  <SelectField
                    label="Years of experience"
                    required
                    placeholder="Select years of experience"
                    value={consultancyExperience}
                    options={CONSULTANCY_EXPERIENCE}
                    onSelect={setConsultancyExperience}
                  />
                  <SelectField
                    label="Background / qualification"
                    required
                    placeholder="Select Background / Qualification"
                    value={consultancyBackground}
                    options={CONSULTANCY_BACKGROUND}
                    onSelect={setConsultancyBackground}
                  />
                  <SelectField
                    label="Crops you support"
                    required
                    placeholder="Select Crops You Support"
                    value={soilCrops}
                    options={CONSULTANCY_CROPS}
                    onSelect={setSoilCrops}
                  />
                  <SelectField
                    label="Best seasons for your advice"
                    required
                    placeholder="Select Best Seasons For Your Advice"
                    value={consultancySeasons}
                    options={CONSULTANCY_SEASONS}
                    onSelect={setConsultancySeasons}
                  />
                  <SelectField
                    label="Languages you explain in"
                    required
                    placeholder="Select Languages You Explain In"
                    value={consultancyLanguages}
                    options={CONSULTANCY_LANGUAGES}
                    onSelect={setConsultancyLanguages}
                  />
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Briefly explain the service rendered"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                  <Pressable style={styles.addEquipmentBtn} onPress={onAddFarmEquipment}>
                    <Text style={styles.addEquipmentText}>Add Services</Text>
                  </Pressable>
                </>
              ) : isMechanic ? (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Service Name <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={equipmentName}
                      onChangeText={setEquipmentName}
                      placeholder="e.g. Tractor repair and maintenance"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                  <SelectField
                    label="Service Category"
                    required
                    placeholder="Select Service Category"
                    value={mechanicCategory}
                    options={MECHANIC_CATEGORIES}
                    onSelect={setMechanicCategory}
                  />
                  <SelectField
                    label="Machinery for service"
                    required
                    placeholder="Select Machinery For Service"
                    value={mechanicMachinery}
                    options={MECHANIC_MACHINERY}
                    onSelect={setMechanicMachinery}
                  />
                  <SelectField
                    label="Skills"
                    required
                    placeholder="Select Skills"
                    value={mechanicSkills}
                    options={MECHANIC_SKILLS}
                    onSelect={setMechanicSkills}
                  />
                  <SelectField
                    label="Where you work"
                    required
                    placeholder="Select Where You Work"
                    value={mechanicWhere}
                    options={MECHANIC_WHERE}
                    onSelect={setMechanicWhere}
                  />
                  <SelectField
                    label="Spare parts"
                    required
                    placeholder="Select Spare Parts"
                    value={mechanicSpareParts}
                    options={MECHANIC_SPARE_PARTS}
                    onSelect={setMechanicSpareParts}
                  />
                  <SelectField
                    label="Available for"
                    required
                    placeholder="Select Available For"
                    value={mechanicAvailableFor}
                    options={MECHANIC_AVAILABLE_FOR}
                    onSelect={setMechanicAvailableFor}
                  />
                  <SelectField
                    label="Tools you bring"
                    required
                    placeholder="Select Tools You Bring"
                    value={mechanicTools}
                    options={MECHANIC_TOOLS}
                    onSelect={setMechanicTools}
                  />
                  <SelectField
                    label="Emergency support"
                    required
                    placeholder="Select Emergency Support"
                    value={mechanicEmergency}
                    options={MECHANIC_EMERGENCY}
                    onSelect={setMechanicEmergency}
                  />
                  <SelectField
                    label="Years of experience"
                    required
                    placeholder="Select Years of Experience"
                    value={mechanicExperience}
                    options={MECHANIC_EXPERIENCE}
                    onSelect={setMechanicExperience}
                  />
                  <SelectField
                    label="Languages you speak in"
                    required
                    placeholder="Select Languages"
                    value={mechanicLanguages}
                    options={MECHANIC_LANGUAGES}
                    onSelect={setMechanicLanguages}
                  />
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Select to type additional information"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                  <Pressable style={styles.addEquipmentBtn} onPress={onAddFarmEquipment}>
                    <Text style={styles.addEquipmentText}>+Add Services</Text>
                  </Pressable>
                </>
              ) : isIrrigation ? (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Display name <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={equipmentName}
                      onChangeText={setEquipmentName}
                      placeholder="Eg: Professional irrigation setup"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Short description <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={farmersGet}
                      onChangeText={setFarmersGet}
                      placeholder="Eg: Fast irrigation..."
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                  <SelectField
                    label="Select Type"
                    required
                    placeholder="Select irrigation service type"
                    value={irrigationType}
                    options={IRRIGATION_TYPES}
                    onSelect={setIrrigationType}
                  />
                  <SelectField
                    label="Select Method"
                    required
                    placeholder="Select method"
                    value={irrigationMethod}
                    options={IRRIGATION_METHODS}
                    onSelect={setIrrigationMethod}
                  />
                  <SelectField
                    label="Job Size"
                    required
                    placeholder="Select service area/load"
                    value={irrigationJobSize}
                    options={IRRIGATION_JOB_SIZES}
                    onSelect={setIrrigationJobSize}
                  />
                  <SelectField
                    label="Tech used (tools)"
                    required
                    placeholder="Select equipment used"
                    value={irrigationTech}
                    options={IRRIGATION_TECH}
                    onSelect={setIrrigationTech}
                  />
                  <SelectField
                    label="Consultation level"
                    required
                    placeholder="Select level of consulting"
                    value={irrigationConsultation}
                    options={IRRIGATION_CONSULTATION}
                    onSelect={setIrrigationConsultation}
                  />
                  <SelectField
                    label="Duration to be completed"
                    required
                    placeholder="Select time duration for job"
                    value={irrigationDuration}
                    options={IRRIGATION_DURATION}
                    onSelect={setIrrigationDuration}
                  />
                  <SelectField
                    label="Base rate for work"
                    required
                    placeholder="Select currency & basic rate"
                    value={irrigationBaseRate}
                    options={IRRIGATION_BASE_RATES}
                    onSelect={setIrrigationBaseRate}
                  />
                  <SelectField
                    label="After sales / On support"
                    required
                    placeholder="Select how support is done"
                    value={irrigationSupport}
                    options={IRRIGATION_SUPPORT}
                    onSelect={setIrrigationSupport}
                  />
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Eg: Professional irrigation..."
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                  <Pressable style={styles.addEquipmentBtn} onPress={onAddFarmEquipment}>
                    <Text style={styles.addEquipmentText}>Add Service</Text>
                  </Pressable>
                </>
              ) : isDrone ? (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Service Name <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={equipmentName}
                      onChangeText={setEquipmentName}
                      placeholder="T-50 Drone Spray For Maize Farm"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                  <SelectField
                    label="Brand/Model"
                    required
                    placeholder="Select Brand/Model"
                    value={droneBrand}
                    options={DRONE_BRANDS}
                    onSelect={setDroneBrand}
                  />
                  <SelectField
                    label="Drone Service Type"
                    required
                    placeholder="Select Drone Service Type"
                    value={droneServiceType}
                    options={DRONE_SERVICE_TYPES}
                    onSelect={setDroneServiceType}
                  />
                  <SelectField
                    label="Minimum Area"
                    required
                    placeholder="Select Minimum Area"
                    value={droneMinArea}
                    options={DRONE_MIN_AREA}
                    onSelect={setDroneMinArea}
                  />
                  <SelectField
                    label="Maximum Area Per Day"
                    required
                    placeholder="Select Max Area Per Day"
                    value={droneMaxArea}
                    options={DRONE_MAX_AREA}
                    onSelect={setDroneMaxArea}
                  />
                  <SelectField
                    label="Experience level of operator"
                    required
                    placeholder="Select Experience Level"
                    value={droneExperience}
                    options={DRONE_EXPERIENCE}
                    onSelect={setDroneExperience}
                  />
                  <SelectField
                    label="Operator license"
                    required
                    placeholder="Select Operator License"
                    value={droneLicense}
                    options={DRONE_LICENSE}
                    onSelect={setDroneLicense}
                  />
                  <SelectField
                    label="Insurance status"
                    required
                    placeholder="Select Insurance Status"
                    value={droneInsurance}
                    options={DRONE_INSURANCE}
                    onSelect={setDroneInsurance}
                  />
                  <SelectField
                    label="Crop specialization"
                    required
                    placeholder="Select Crops to be sprayed"
                    value={droneCrops}
                    options={DRONE_CROPS}
                    onSelect={setDroneCrops}
                  />
                  <SelectField
                    label="Fluid type"
                    required
                    placeholder="Select Fluid Type"
                    value={droneFluid}
                    options={DRONE_FLUID}
                    onSelect={setDroneFluid}
                  />
                  <SelectField
                    label="Equipment"
                    required
                    placeholder="Select Equipment"
                    value={droneEquipment}
                    options={DRONE_EQUIPMENT}
                    onSelect={setDroneEquipment}
                  />
                  <SelectField
                    label="Coverage"
                    required
                    placeholder="Select Coverage"
                    value={droneCoverage}
                    options={DRONE_COVERAGE}
                    onSelect={setDroneCoverage}
                  />
                  <SelectField
                    label="Drone Capacity"
                    required
                    placeholder="Select Drone Tank Capacity"
                    value={droneCapacity}
                    options={DRONE_CAPACITY}
                    onSelect={setDroneCapacity}
                  />
                  <SelectField
                    label="Crop Phase / Drone Surveillance"
                    required
                    placeholder="Select Pilot / Drone Surveillance"
                    value={dronePhase}
                    options={DRONE_PHASE}
                    onSelect={setDronePhase}
                  />
                  <SelectField
                    label="Service Policy"
                    required
                    placeholder="Select Weather Policy"
                    value={dronePolicy}
                    options={DRONE_POLICY}
                    onSelect={setDronePolicy}
                  />
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Describe your drone spray service"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                  <Pressable style={styles.addEquipmentBtn} onPress={onAddFarmEquipment}>
                    <Text style={styles.addEquipmentText}>ADD SERVICE</Text>
                  </Pressable>
                </>
              ) : isCropInspection ? (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Service Name <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={equipmentName}
                      onChangeText={setEquipmentName}
                      placeholder="Input your service name"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Brief Description <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={farmersGet}
                      onChangeText={setFarmersGet}
                      placeholder="Write a short brief of your services"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                  <SelectField
                    label="Inspection focus"
                    required
                    placeholder="Select Inspection Focus"
                    value={inspectionFocus}
                    options={INSPECTION_FOCUS}
                    onSelect={setInspectionFocus}
                  />
                  <SelectField
                    label="Crops You Support"
                    required
                    placeholder="Select Crops You Support"
                    value={inspectionCrops}
                    options={INSPECTION_CROPS}
                    onSelect={setInspectionCrops}
                  />
                  <SelectField
                    label="Tools and equipment"
                    required
                    placeholder="Select Tools and Equipment"
                    value={inspectionTools}
                    options={INSPECTION_TOOLS}
                    onSelect={setInspectionTools}
                  />
                  <SelectField
                    label="Experience level"
                    required
                    placeholder="Select Experience Level"
                    value={inspectionExperience}
                    options={INSPECTION_EXPERIENCE}
                    onSelect={setInspectionExperience}
                  />
                  <SelectField
                    label="Inspection methods"
                    required
                    placeholder="Select Inspection Methods"
                    value={inspectionMethods}
                    options={INSPECTION_METHODS}
                    onSelect={setInspectionMethods}
                  />
                  <SelectField
                    label="Reporting and documentation"
                    required
                    placeholder="Select Reporting"
                    value={inspectionReporting}
                    options={INSPECTION_REPORTING}
                    onSelect={setInspectionReporting}
                  />
                  <SelectField
                    label="Follow up services"
                    required
                    placeholder="Select Follow Up"
                    value={inspectionFollowup}
                    options={INSPECTION_FOLLOWUP}
                    onSelect={setInspectionFollowup}
                  />
                  <SelectField
                    label="Lead time/Delivery"
                    required
                    placeholder="Select Lead Time"
                    value={inspectionLeadTime}
                    options={INSPECTION_LEAD_TIME}
                    onSelect={setInspectionLeadTime}
                  />
                  <SelectField
                    label="Soil health analysis"
                    required
                    placeholder="Select Soil Health Analysis"
                    value={inspectionSoilHealth}
                    options={INSPECTION_SOIL_HEALTH}
                    onSelect={setInspectionSoilHealth}
                  />
                  <Pressable style={styles.addEquipmentBtn} onPress={onAddFarmEquipment}>
                    <Text style={styles.addEquipmentText}>Add Service</Text>
                  </Pressable>
                </>
              ) : isEquipmentRepair ? (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Service Name <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={equipmentName}
                      onChangeText={setEquipmentName}
                      placeholder="e.g. Tractor repair workshop"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Short description <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={farmersGet}
                      onChangeText={setFarmersGet}
                      placeholder="Short description of your repair service"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                  <SelectField
                    label="Equipment category"
                    required
                    placeholder="Select Equipment Category"
                    value={repairEquipCategory}
                    options={REPAIR_EQUIPMENT_CATEGORIES}
                    onSelect={setRepairEquipCategory}
                  />
                  <SelectField
                    label="Select Brand"
                    required
                    placeholder="Select Brand/Company"
                    value={repairBrand}
                    options={REPAIR_BRANDS}
                    onSelect={setRepairBrand}
                  />
                  <SelectField
                    label="Service Category"
                    required
                    placeholder="Select Service Category"
                    value={repairServiceCategory}
                    options={REPAIR_SERVICE_CATEGORIES}
                    onSelect={setRepairServiceCategory}
                  />
                  <SelectField
                    label="Select type"
                    required
                    placeholder="Select Type"
                    value={repairType}
                    options={REPAIR_TYPES}
                    onSelect={setRepairType}
                  />
                  <SelectField
                    label="Model/Quality"
                    required
                    placeholder="Select Service Type"
                    value={repairServiceType}
                    options={REPAIR_SERVICE_TYPES}
                    onSelect={setRepairServiceType}
                  />
                  <SelectField
                    label="Drive and power by"
                    required
                    placeholder="Select Drive and Power"
                    value={repairDrivePower}
                    options={REPAIR_DRIVE_POWER}
                    onSelect={setRepairDrivePower}
                  />
                  <SelectField
                    label="Max Lift Capacity"
                    required
                    placeholder="Select Max Lift Capacity"
                    value={repairLiftCapacity}
                    options={REPAIR_LIFT_CAPACITY}
                    onSelect={setRepairLiftCapacity}
                  />
                  <SelectField
                    label="Minimum Order Quantity"
                    required
                    placeholder="Select Minimum Order"
                    value={repairMinOrder}
                    options={REPAIR_MIN_ORDER}
                    onSelect={setRepairMinOrder}
                  />
                  <SelectField
                    label="Warranty / Duration"
                    required
                    placeholder="Select Warranty/Duration"
                    value={repairWarranty}
                    options={REPAIR_WARRANTY}
                    onSelect={setRepairWarranty}
                  />
                  <SelectField
                    label="Language"
                    required
                    placeholder="Select Language"
                    value={repairLanguages}
                    options={REPAIR_LANGUAGES}
                    onSelect={setRepairLanguages}
                  />
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Describe the equipment repair service"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                  <Pressable style={styles.addEquipmentBtn} onPress={onAddFarmEquipment}>
                    <Text style={styles.addEquipmentText}>Add Services</Text>
                  </Pressable>
                </>
              ) : isService ? (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Service name <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={equipmentName}
                      onChangeText={setEquipmentName}
                      placeholder="Give your service a clear name"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      What farmers get <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={farmersGet}
                      onChangeText={setFarmersGet}
                      placeholder="Describe what is included in this service"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                  <SelectField
                    label="Area you support"
                    required
                    placeholder="Select Area You Support"
                    value={serviceSupportArea}
                    options={SERVICE_SUPPORT_AREAS}
                    onSelect={setServiceSupportArea}
                  />
                  <SelectField
                    label="Crops you support"
                    placeholder="Select Crops You Support"
                    value={soilCrops}
                    options={SOIL_CROPS}
                    onSelect={setSoilCrops}
                  />
                  <Pressable style={styles.addEquipmentBtn} onPress={onAddFarmEquipment}>
                    <Text style={styles.addEquipmentText}>Add Services</Text>
                  </Pressable>
                </>
              ) : isWarehouse ? (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Warehouse title <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={equipmentName}
                      onChangeText={setEquipmentName}
                      placeholder="Give it a catchy name"
                      placeholderTextColor={APP_TEXT_MUTED}
                    />
                  </View>
                  <SelectField
                    label="Storage type"
                    required
                    placeholder="Select Storage Type"
                    value={warehouseStorageType}
                    options={WAREHOUSE_STORAGE_TYPES}
                    onSelect={setWarehouseStorageType}
                  />
                  <SelectField
                    label="Capacity / Unit"
                    required
                    placeholder="Select Capacity/Unit"
                    value={warehouseCapacity}
                    options={WAREHOUSE_CAPACITY_UNITS}
                    onSelect={setWarehouseCapacity}
                  />
                  <SelectField
                    label="Coverage"
                    required
                    placeholder="Select Coverage"
                    value={warehouseCoverage}
                    options={WAREHOUSE_COVERAGE}
                    onSelect={setWarehouseCoverage}
                  />
                  <SelectField
                    label="Security features"
                    required
                    placeholder="Select Security Features"
                    value={warehouseSecurity}
                    options={WAREHOUSE_SECURITY}
                    onSelect={setWarehouseSecurity}
                  />
                  <SelectField
                    label="Loading access"
                    required
                    placeholder="Select Loading Access"
                    value={warehouseLoading}
                    options={WAREHOUSE_LOADING}
                    onSelect={setWarehouseLoading}
                  />
                  <SelectField
                    label="Power & water"
                    required
                    placeholder="Select Power & Water"
                    value={warehousePowerWater}
                    options={WAREHOUSE_POWER_WATER}
                    onSelect={setWarehousePowerWater}
                  />
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Storage description</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Write a brief about your warehouse"
                      placeholderTextColor={APP_TEXT_MUTED}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                  <Pressable style={styles.addEquipmentBtn} onPress={onAddFarmEquipment}>
                    <Text style={styles.addEquipmentText}>Add/Update Asset</Text>
                  </Pressable>
                </>
              ) : isLand ? (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      List name <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={equipmentName}
                      onChangeText={setEquipmentName}
                      placeholder="E.g. 5 Acre Irrigated Farmland"
                      placeholderTextColor={APP_TEXT_MUTED}
                    />
                  </View>
                  <SelectField
                    label="Category"
                    required
                    placeholder="Select Category"
                    value={landCategory}
                    options={LAND_CATEGORIES}
                    onSelect={setLandCategory}
                  />
                  <SelectField
                    label="Land type"
                    required
                    placeholder="Select Land Type"
                    value={landType}
                    options={LAND_TYPES}
                    onSelect={setLandType}
                  />
                  <SelectField
                    label="District"
                    required
                    placeholder="Select District"
                    value={landDistrict}
                    options={LAND_DISTRICTS}
                    onSelect={setLandDistrict}
                  />
                  <SelectField
                    label="Town / Location"
                    required
                    placeholder="Select Town / Location"
                    value={landTown}
                    options={LAND_TOWNS}
                    onSelect={setLandTown}
                  />
                  <SelectField
                    label="Unit of measurement"
                    required
                    placeholder="Select Unit"
                    value={landUnit}
                    options={LAND_UNITS}
                    onSelect={setLandUnit}
                  />
                  <SelectField
                    label="Select rental type"
                    required
                    placeholder="Select Rental Type"
                    value={landRentalType}
                    options={LAND_RENTAL_TYPES}
                    onSelect={setLandRentalType}
                  />
                  <SelectField
                    label="Access to water?"
                    placeholder="Select Water Access"
                    value={landWaterAccess}
                    options={LAND_WATER_ACCESS}
                    onSelect={setLandWaterAccess}
                  />
                  <Pressable style={styles.addEquipmentBtn} onPress={onAddFarmEquipment}>
                    <Text style={styles.addEquipmentText}>Add Listing</Text>
                  </Pressable>
                </>
              ) : isDriver ? (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Full name <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={equipmentName}
                      onChangeText={setEquipmentName}
                      placeholder="Enter driver name as per ID proof"
                      placeholderTextColor={APP_TEXT_MUTED}
                    />
                  </View>
                  <SelectField
                    label="Skill set"
                    required
                    placeholder="Select The Skill Set"
                    value={driverSkillSet}
                    options={DRIVER_SKILL_SETS}
                    onSelect={setDriverSkillSet}
                  />
                  <SelectField
                    label="Area of expertise"
                    required
                    placeholder="Select Area Of Expertise"
                    value={driverExpertise}
                    options={DRIVER_EXPERTISE}
                    onSelect={setDriverExpertise}
                  />
                  <SelectField
                    label="License type you have"
                    required
                    placeholder="Select License Category"
                    value={driverLicense}
                    options={DRIVER_LICENSE_TYPES}
                    onSelect={setDriverLicense}
                  />
                  <SelectField
                    label="Total working experience"
                    required
                    placeholder="Select Years Of Working Experience"
                    value={driverExperience}
                    options={DRIVER_EXPERIENCE_YEARS}
                    onSelect={setDriverExperience}
                  />
                  <SelectField
                    label="Available"
                    required
                    placeholder="Select Availability"
                    value={driverAvailability}
                    options={DRIVER_AVAILABILITY}
                    onSelect={setDriverAvailability}
                  />
                  <SelectField
                    label="Language known"
                    placeholder="Select Language You Know"
                    value={driverLanguage}
                    options={DRIVER_LANGUAGES}
                    onSelect={setDriverLanguage}
                  />
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Experience</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Describe driving experience and specialties"
                      placeholderTextColor={APP_TEXT_MUTED}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                  <Pressable style={styles.addEquipmentBtn} onPress={onAddFarmEquipment}>
                    <Text style={styles.addEquipmentText}>Add Details</Text>
                  </Pressable>
                </>
              ) : isLabor ? (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Enter item name <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={equipmentName}
                      onChangeText={setEquipmentName}
                      placeholder="E.g. Farm Harvest Helpers"
                      placeholderTextColor={APP_TEXT_MUTED}
                    />
                  </View>
                  <SelectField
                    label="Select category"
                    required
                    placeholder="Select Category"
                    value={laborCategory}
                    options={LABOR_CATEGORIES}
                    onSelect={setLaborCategory}
                  />
                  <SelectField
                    label="Labour type"
                    required
                    placeholder="Select Labour Type"
                    value={laborType}
                    options={LABOR_TYPES}
                    onSelect={setLaborType}
                  />
                  <SelectField
                    label="Labour count"
                    required
                    placeholder="Enter Number Of Persons"
                    value={laborTeamSize}
                    options={LABOR_TEAM_SIZE}
                    onSelect={setLaborTeamSize}
                  />
                  <SelectField
                    label="Labour gender"
                    required
                    placeholder="Select Gender"
                    value={laborGender}
                    options={LABOR_GENDER}
                    onSelect={setLaborGender}
                  />
                  <SelectField
                    label="Select shift"
                    required
                    placeholder="Select Shift"
                    value={laborShift}
                    options={LABOR_SHIFT}
                    onSelect={setLaborShift}
                  />
                  <SelectField
                    label="Labour availability"
                    required
                    placeholder="Select Daily Hours"
                    value={laborHours}
                    options={LABOR_HOURS}
                    onSelect={setLaborHours}
                  />
                  <SelectField
                    label="Language"
                    placeholder="Select Language"
                    value={laborLanguage}
                    options={LABOR_LANGUAGE}
                    onSelect={setLaborLanguage}
                  />
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Describe work type and experience"
                      placeholderTextColor={APP_TEXT_MUTED}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                  <Pressable style={styles.addEquipmentBtn} onPress={onAddFarmEquipment}>
                    <Text style={styles.addEquipmentText}>Add Section</Text>
                  </Pressable>
                </>
              ) : isMachinery ? (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Equipment name <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={equipmentName}
                      onChangeText={setEquipmentName}
                      placeholder="E.g. John Deere 5050 D | 50 HP"
                      placeholderTextColor={APP_TEXT_MUTED}
                    />
                  </View>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Price (hr) <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={priceHr}
                      onChangeText={setPriceHr}
                      placeholder="E.g. 800"
                      placeholderTextColor={APP_TEXT_MUTED}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <SelectField
                    label="Engine type"
                    required
                    placeholder="Select Engine Type"
                    value={engineType}
                    options={ENGINE_TYPES}
                    onSelect={setEngineType}
                  />
                  <SelectField
                    label="Fuel consumption"
                    required
                    placeholder="Select Fuel Consumption"
                    value={fuelConsumption}
                    options={FUEL_CONSUMPTION}
                    onSelect={setFuelConsumption}
                  />
                  <SelectField
                    label="Operator support"
                    required
                    placeholder="Select Operator Support"
                    value={operatorSupport}
                    options={OPERATOR_SUPPORT}
                    onSelect={setOperatorSupport}
                  />
                  <SelectField
                    label="Delivery available"
                    required
                    placeholder="Select Delivery Available"
                    value={deliveryAvailable}
                    options={DELIVERY_AVAILABLE}
                    onSelect={setDeliveryAvailable}
                  />
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Add model details and other information"
                      placeholderTextColor={APP_TEXT_MUTED}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                  <Pressable style={styles.addEquipmentBtn} onPress={onAddFarmEquipment}>
                    <Text style={styles.addEquipmentText}>Add Farm Equipment</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      Equipment name <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={equipmentName}
                      onChangeText={setEquipmentName}
                      placeholder="E.G, Johan Deere 39368 D Tractor"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                  </View>
                  <SelectField
                    label="Equipment type"
                    required
                    placeholder="Select Equipment Type"
                    value={equipmentType}
                    options={EQUIPMENT_TYPES}
                    onSelect={setEquipmentType}
                  />
                  <SelectField
                    label="Power (HP)"
                    required
                    placeholder="Select Power (HP)"
                    value={powerHp}
                    options={POWER_OPTIONS}
                    onSelect={setPowerHp}
                  />
                  <SelectField
                    label="Fuel"
                    placeholder="Select Fuel Type"
                    value={fuel}
                    options={FUEL_TYPES}
                    onSelect={setFuel}
                  />
                  <SelectField
                    label="Usage guidance available?"
                    required
                    placeholder="Select Usage Guidance Available?"
                    value={usageGuidance}
                    options={USAGE_GUIDANCE}
                    onSelect={setUsageGuidance}
                  />
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Describe condition, fuel tank, usage notes…"
                      placeholderTextColor={APP_TEXT_MUTED}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                  <Pressable style={styles.addEquipmentBtn} onPress={onAddFarmEquipment}>
                    <Text style={styles.addEquipmentText}>Add Farm Equipment</Text>
                  </Pressable>
                </>
              )}
              </View>
            </View>

            <View style={[styles.card, styles.cardPadded, styles.cardSpaced]}>
              <View style={styles.cardInnerPad}>
                <Text style={styles.cardTitle}>
                  {isCropInspection ? "Service Photos" : "Upload Photos"}
                </Text>
                {photos.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                    {photos.map((p) => (
                      <View key={p.uri} style={styles.photoItem}>
                        <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                        <Text style={styles.photoName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Pressable
                          style={styles.photoRemove}
                          onPress={() => setPhotos((prev) => prev.filter((x) => x.uri !== p.uri))}
                        >
                          <Ionicons name="close" size={12} color="#000" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}

                <Pressable style={styles.uploadZone} onPress={() => void pickPhotos()}>
                  <Text style={styles.uploadTitle}>Click to upload or drag and drop</Text>
                  <Text style={styles.uploadSub}>
                    {isCropInspection ? "Max size up to 10M each." : "PNG, JPG Up To 5MB Each"}
                  </Text>
                  <View style={styles.uploadBtn}>
                    <Text style={styles.uploadBtnText}>Upload</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            <View style={[styles.card, styles.cardPadded, styles.cardSpaced]}>
              <View style={styles.cardInnerPad}>
                <Text style={styles.cardTitle}>
                  {isIrrigation
                    ? "Irrigation verification"
                    : isCropInspection
                      ? "Condition notification"
                      : isEquipmentRepair
                        ? "Condition Verification"
                        : isDrone
                          ? "Condition verification"
                          : "Condition Verification"}
                </Text>
                <Text style={styles.cardSub}>
                  {isIrrigation
                    ? "Check the fields below — Build trust with buyers"
                    : isCropInspection
                      ? "Check items applicable to your work and service"
                      : isEquipmentRepair
                        ? "Check Only What Is True — Builds Trust With Customers"
                        : isDrone
                          ? "Select from below items"
                          : isFarmConsultancy || isMechanic
                            ? "Check Only What Is True — Builds Trust With Renters"
                            : isService
                              ? "Check Only Items That Apply And Are True For Your Service"
                              : isWarehouse
                                ? "Check Only Items That Apply And Are In Good Working Condition"
                                : isDriver
                                  ? "Check And Select From Below For Quick Verification"
                                  : "Check Only What Is True — Builds Trust With Renters"}
                </Text>
              </View>
              {conditionItems.map((item, index) => {
                const checked = !!conditions[item.id];
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.conditionRow, index === conditionItems.length - 1 && styles.conditionRowLast]}
                    onPress={() => toggleCondition(item.id)}
                  >
                    <Text style={styles.conditionLabel}>{item.label}</Text>
                    <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
                      {checked ? <Ionicons name="checkmark" size={14} color="#000" /> : null}
                    </View>
                  </Pressable>
                );
              })}

              <View style={styles.cardInnerPad}>
                <Pressable onPress={() => setWhyOpen((v) => !v)} style={styles.whyBtn}>
                  <Text style={styles.whyTitle}>
                    {isIrrigation
                      ? "Why Default Checkboxes?"
                      : isDrone
                        ? "Why Callout? Professional?"
                        : isCropInspection
                          ? "Why default Unchecked?"
                          : isEquipmentRepair
                            ? "Why Default List Unreviewed?"
                            : "Why Default Unchecked?"}
                  </Text>
                </Pressable>
                {whyOpen ? (
                  <Text style={styles.whyBody}>
                    {isIrrigation
                      ? "To better assist we select your best traits but keep them as pointers which allows for better listing view."
                      : isDrone
                        ? "Highlight verified safety and pilot credentials so farmers trust your drone spray listing."
                        : isCropInspection
                          ? "This section describes about your asset and what issues share/it has before. Unchecked reflects listing status."
                          : isEquipmentRepair
                            ? "Listings stay unreviewed until you confirm only what is true. Honest checklists build trust with customers."
                            : `You decide what's true about your ${isService ? "service" : "asset"}. Unchecked boxes show you're honest. ${
                                isService ? "Farmers" : "Renters"
                              } trust verified listings more.`}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={[styles.card, styles.cardPadded, styles.cardSpaced]}>
              <View style={styles.cardInnerPad}>
                <Text style={styles.cardTitle}>Terms & Conditions</Text>
                <Pressable style={styles.termsRow} onPress={() => setAgreedTerms((v) => !v)}>
                  <View style={[styles.checkBox, agreedTerms && styles.checkBoxOn]}>
                    {agreedTerms ? <Ionicons name="checkmark" size={14} color="#000" /> : null}
                  </View>
                  <Text style={styles.termsText}>
                    {isEquipmentRepair
                      ? "Agree to Service Agreement & Legalities services & more."
                      : isCropInspection
                        ? "Agree to Partner agreement & CropVibe services policies"
                        : isDrone
                          ? "Agree to Rental Agreement or CropVibe/Agrovibes Policies"
                          : isIrrigation
                            ? "I agree to Terms / Agreement & CropVibe service Policy."
                            : isFarmConsultancy || isMechanic || isService
                              ? "Agree to Rental Agreement & CropVibe services Policies"
                              : isWarehouse
                                ? "I agree to the Rental Agreement & Agrovibes terms & policies"
                                : isLand
                                  ? "Agree to Rental Agreement & Cropvibe Land Rental Policies"
                                  : isDriver || isMachinery
                                    ? "Agree to Rental Agreement & Cropvibe Rental Policies"
                                    : isLabor
                                      ? "Agree to Rental Agreement & Cropvibe Labour Policies"
                                      : "Agree to Rental Agreement & Cropvibe Rental Terms"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.stepBody}>
            <View style={styles.cardHeadOutside}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionEyebrow}>Pricing & Availability</Text>
                <Text style={styles.stepTextLeft}>
                  Step 3 Of 3 | <Text style={styles.stepAsset}>{selectedAssetMeta?.title}</Text>
                </Text>
              </View>
              <StepIndicator step={3} />
            </View>

            <View style={[styles.card, styles.cardPadded]}>
              <View style={styles.cardInnerPad}>
              {isSoilTesting || isService ? (
                <>
                  <View style={styles.rateRow}>
                    <View style={[styles.fieldBlock, styles.rateInputWrap]}>
                      <Text style={styles.fieldLabel}>
                        Total Price <Text style={styles.req}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={dailyRate}
                        onChangeText={setDailyRate}
                        placeholder="e.g. ₹ 800"
                        placeholderTextColor={APP_TEXT_MUTED}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.rateUnitWrap}>
                      <SelectField
                        label="Price unit"
                        required
                        placeholder="Select Unit"
                        value={rateUnit}
                        options={SERVICE_PRICE_UNITS}
                        onSelect={setRateUnit}
                      />
                    </View>
                  </View>
                  <SelectField
                    label="Service duration"
                    required
                    placeholder="e.g. 5 hours"
                    value={serviceDuration}
                    options={SERVICE_DURATIONS}
                    onSelect={setServiceDuration}
                  />
                  <SelectField
                    label="Availability"
                    required
                    placeholder="Select days"
                    value={serviceAvailability}
                    options={SERVICE_AVAILABILITY}
                    onSelect={setServiceAvailability}
                  />
                  <SelectField
                    label="Service Area Limit"
                    required
                    placeholder="e.g. 100 KM"
                    value={serviceArea}
                    options={SERVICE_AREA_LIMITS}
                    onSelect={setServiceArea}
                  />
                  <Text style={styles.pricingTipTitle}>Pricing Tip</Text>
                  <Text style={styles.pricingTip}>
                    Higher Rates = Fewer Bookings But Better Revenue. Lower Rates = Faster Bookings. You Can Adjust
                    Anytime After Publishing.
                  </Text>
                  {rateNum > 0 ? (
                    <View style={styles.feeBox}>
                      <Text style={styles.feeLine}>
                        Price: {formatInr(rateNum)} / {rateUnitShort}
                      </Text>
                      <Text style={styles.feeLine}>
                        Platform Fee: {formatInr(platformFee)} ({feePctLabel}%)
                      </Text>
                      <Text style={styles.feeEarn}>
                        Your Earnings: {formatInr(youReceive)} ({earnPctLabel}%)
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : isWarehouse ? (
                <>
                  <Text style={styles.pricingIntro}>Set prices for your warehouse</Text>
                  <View style={styles.rateRow}>
                    <View style={[styles.fieldBlock, styles.rateInputWrap]}>
                      <Text style={styles.fieldLabel}>
                        Hourly amount <Text style={styles.req}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={dailyRate}
                        onChangeText={setDailyRate}
                        placeholder="00"
                        placeholderTextColor={APP_TEXT_MUTED}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.rateUnitWrap}>
                      <SelectField
                        label="Duration"
                        required
                        placeholder="Select Duration"
                        value={warehouseDuration}
                        options={WAREHOUSE_DURATIONS}
                        onSelect={setWarehouseDuration}
                      />
                    </View>
                  </View>
                  <SelectField
                    label="Enter dimension"
                    required
                    placeholder="Select Dimension"
                    value={warehouseDimension}
                    options={WAREHOUSE_DIMENSIONS}
                    onSelect={setWarehouseDimension}
                  />
                  <SelectField
                    label="Select storage conditions"
                    required
                    placeholder="Select..."
                    value={warehouseStorageCondition}
                    options={WAREHOUSE_STORAGE_CONDITIONS}
                    onSelect={setWarehouseStorageCondition}
                  />
                  {rateNum > 0 && warehouseHours > 0 ? (
                    <View style={styles.feeBox}>
                      <Text style={styles.feeLine}>
                        Rate: {formatInr(rateNum)} / hour
                      </Text>
                      <Text style={styles.feeLine}>
                        Total: {formatInr(warehouseTotal)} / {warehouseDuration}
                      </Text>
                      <Text style={styles.feeLine}>
                        Platform fee: {formatInr(platformFee)} (5%)
                      </Text>
                      <Text style={styles.feeEarn}>
                        You receive: {formatInr(youReceive)}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.pricingTipTitle}>Pricing Tip</Text>
                  <Text style={styles.pricingTip}>
                    Higher Rates = Fewer Bookings But Better Revenue. Lower Rates = Faster Bookings. You Can Adjust
                    Anytime After Publishing.
                  </Text>
                </>
              ) : isLand ? (
                <>
                  <View style={styles.rateRow}>
                    <View style={[styles.fieldBlock, styles.rateInputWrap]}>
                      <Text style={styles.fieldLabel}>
                        Rate to charge <Text style={styles.req}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={dailyRate}
                        onChangeText={setDailyRate}
                        placeholder="100"
                        placeholderTextColor={APP_TEXT_MUTED}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.rateUnitWrap}>
                      <SelectField
                        label="Per"
                        placeholder="Select"
                        value={rateUnit}
                        options={RATE_UNITS}
                        onSelect={setRateUnit}
                      />
                    </View>
                  </View>
                  <SelectField
                    label="Available from"
                    required
                    placeholder="Select Date"
                    value={landAvailableFrom}
                    options={LAND_AVAILABLE_FROM}
                    onSelect={setLandAvailableFrom}
                  />
                  <SelectField
                    label="Provided / Owned by"
                    placeholder="Select Ownership"
                    value={landOwnedBy}
                    options={LAND_OWNED_BY}
                    onSelect={setLandOwnedBy}
                  />
                  <SelectField
                    label="Land category supported"
                    placeholder="Select Category"
                    value={landCategorySupported}
                    options={LAND_CATEGORY_SUPPORTED}
                    onSelect={setLandCategorySupported}
                  />
                  <SelectField
                    label="Soil type"
                    placeholder="Select Soil Type"
                    value={landSoilType}
                    options={LAND_SOIL_TYPES}
                    onSelect={setLandSoilType}
                  />
                  <SelectField
                    label="Service area (km)"
                    required
                    placeholder="Select Service Area (km)"
                    value={serviceArea}
                    options={LAND_SERVICE_AREAS}
                    onSelect={setServiceArea}
                  />
                  {rateNum > 0 ? (
                    <View style={styles.feeBox}>
                      <Text style={styles.feeLine}>
                        Rate: {formatInr(rateNum)}/{rateUnit}
                      </Text>
                      <Text style={styles.feeLine}>
                        Platform fee: {formatInr(platformFee)} (15%)
                      </Text>
                      <Text style={styles.feeEarn}>
                        You receive: {formatInr(youReceive)} (85%)
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.pricingTipTitle}>Pricing Tip</Text>
                  <Text style={styles.pricingTip}>
                    Higher Rates = Fewer Bookings But Better Revenue. Lower Rates = Faster Bookings. You Can Adjust
                    Anytime After Publishing.
                  </Text>
                </>
              ) : isLabor ? (
                <>
                  <View style={styles.rateRow}>
                    <View style={[styles.fieldBlock, styles.rateInputWrap]}>
                      <Text style={styles.fieldLabel}>
                        Price per hour <Text style={styles.req}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={dailyRate}
                        onChangeText={setDailyRate}
                        placeholder="250"
                        placeholderTextColor={APP_TEXT_MUTED}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.rateUnitWrap}>
                      <SelectField
                        label="Period"
                        placeholder="Select"
                        value={rateUnit}
                        options={LABOR_PERIOD}
                        onSelect={setRateUnit}
                      />
                    </View>
                  </View>
                  <SelectField
                    label="Minimum duration"
                    required
                    placeholder="Select Minimum Duration"
                    value={minDuration}
                    options={LABOR_MIN_DURATION}
                    onSelect={setMinDuration}
                  />
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>
                      No of persons required <Text style={styles.req}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={personsRequired}
                      onChangeText={setPersonsRequired}
                      placeholder="E.g. 10"
                      placeholderTextColor={APP_TEXT_MUTED}
                      keyboardType="number-pad"
                    />
                  </View>
                  {rateNum > 0 ? (
                    <View style={styles.feeBox}>
                      <Text style={styles.feeLine}>
                        Rate: {formatInr(rateNum)}/{rateUnit}
                      </Text>
                      <Text style={styles.feeLine}>
                        Platform fee: {formatInr(platformFee)} (15%)
                      </Text>
                      <Text style={styles.feeEarn}>
                        You receive: {formatInr(youReceive)} (85%)
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.pricingTipTitle}>Pricing Tip</Text>
                  <Text style={styles.pricingTip}>
                    Higher Rates = Fewer Bookings But Better Revenue. Lower Rates = Faster Bookings. You Can Adjust
                    Anytime After Publishing.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.rateRow}>
                    <View style={[styles.fieldBlock, styles.rateInputWrap]}>
                      <Text style={styles.fieldLabel}>
                        Daily rental rate <Text style={styles.req}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={dailyRate}
                        onChangeText={setDailyRate}
                        placeholder="0"
                        placeholderTextColor={APP_TEXT_MUTED}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.rateUnitWrap}>
                      <SelectField
                        label="Per"
                        placeholder="Select"
                        value={rateUnit}
                        options={RATE_UNITS}
                        onSelect={setRateUnit}
                      />
                    </View>
                  </View>

                  <SelectField
                    label="Service area (km)"
                    required
                    placeholder="Select Service Area (km)"
                    value={serviceArea}
                    options={SERVICE_AREAS}
                    onSelect={setServiceArea}
                  />

                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Security deposit (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={securityDeposit}
                      onChangeText={setSecurityDeposit}
                      placeholder="0"
                      placeholderTextColor={APP_TEXT_MUTED}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  {rateNum > 0 ? (
                    <View style={styles.feeBox}>
                      <Text style={styles.feeLine}>
                        Rate: {formatInr(rateNum)}/{rateUnit}
                      </Text>
                      <Text style={styles.feeLine}>
                        Platform fee: {formatInr(platformFee)} (15%)
                      </Text>
                      <Text style={styles.feeEarn}>
                        You receive: {formatInr(youReceive)} (85%)
                      </Text>
                    </View>
                  ) : null}

                  <Text style={styles.pricingTip}>
                    Higher Rates = Fewer Bookings But Better Revenue. Lower Rates = Faster Bookings. You Can Adjust
                    Anytime After Publishing.
                  </Text>
                </>
              )}
              </View>
            </View>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.reviewCard}>
            {photos[0]?.uri ? (
              <Image source={{ uri: photos[0].uri }} style={styles.reviewHero} />
            ) : (
              <View style={[styles.reviewHero, styles.reviewHeroEmpty]}>
                <Ionicons name="image-outline" size={36} color={APP_TEXT_MUTED} />
              </View>
            )}
            <Text style={styles.reviewTitle}>{equipmentName || "Untitled listing"}</Text>
            <Text style={styles.reviewCategory}>{selectedAssetMeta?.title ?? "Farm Equipment"}</Text>
            {(isService
              ? description.trim() || farmersGet.trim()
              : description.trim()
            ) ? (
              <Text style={styles.reviewDesc}>
                {(isService ? description.trim() || farmersGet.trim() : description.trim())}
              </Text>
            ) : (
              <Text style={styles.reviewDescMuted}>No description provided.</Text>
            )}

            <Pressable style={styles.viewDetailsBtn} onPress={() => setDetailsOpen((v) => !v)}>
              <Text style={styles.viewDetailsText}>View Listing Details</Text>
              <Ionicons name={detailsOpen ? "chevron-up" : "chevron-down"} size={16} color={APP_LIME} />
            </Pressable>

            {detailsOpen ? (
              <View style={styles.detailsBlock}>
                <Text style={styles.detailsSectionTitle}>
                  {isSoilTesting
                    ? "Soil Testing Details"
                    : isFarmConsultancy
                      ? "Farm Consultancy Details"
                      : isMechanic
                        ? "Mechanic Service Details"
                        : isIrrigation
                          ? "Irrigation Service Details"
                          : isDrone
                            ? "Drone Spray Details"
                            : isCropInspection
                              ? "Crop Inspection Details"
                              : isEquipmentRepair
                                ? "Equipment Repair Details"
                                : isService
                                  ? "Service Details"
                                  : isWarehouse
                                    ? "Warehouse Details"
                                    : isLand
                                      ? "Land Details"
                                      : isDriver
                                        ? "Driver Details"
                                        : isLabor
                                          ? "Labour Details"
                                          : "Equipment Details"}
                </Text>
                {isSoilTesting ? (
                  <>
                    <Text style={styles.detailLine}>
                      What Farmers Get: <Text style={styles.detailVal}>{farmersGet || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Test Package: <Text style={styles.detailVal}>{soilTestPackage || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Testing Location: <Text style={styles.detailVal}>{soilTestingLocation || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Sample Collection: <Text style={styles.detailVal}>{soilSampleCollection || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Samples Per Visit: <Text style={styles.detailVal}>{soilSamplesPerVisit || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Crops Supported: <Text style={styles.detailVal}>{soilCrops || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Report Format: <Text style={styles.detailVal}>{soilReportFormat || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Turnaround: <Text style={styles.detailVal}>{soilTurnaround || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Area Supported: <Text style={styles.detailVal}>{serviceSupportArea || "—"}</Text>
                    </Text>
                  </>
                ) : isFarmConsultancy ? (
                  <>
                    <Text style={styles.detailLine}>
                      What Farmers Get: <Text style={styles.detailVal}>{farmersGet || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Advisory Focus: <Text style={styles.detailVal}>{consultancyAdvisoryFocus || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      How You Deliver: <Text style={styles.detailVal}>{consultancyDelivery || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Experience: <Text style={styles.detailVal}>{consultancyExperience || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Background: <Text style={styles.detailVal}>{consultancyBackground || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Crops Supported: <Text style={styles.detailVal}>{soilCrops || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Best Seasons: <Text style={styles.detailVal}>{consultancySeasons || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Languages: <Text style={styles.detailVal}>{consultancyLanguages || "—"}</Text>
                    </Text>
                  </>
                ) : isMechanic ? (
                  <>
                    <Text style={styles.detailLine}>
                      Category: <Text style={styles.detailVal}>{mechanicCategory || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Machinery: <Text style={styles.detailVal}>{mechanicMachinery || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Skills: <Text style={styles.detailVal}>{mechanicSkills || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Where You Work: <Text style={styles.detailVal}>{mechanicWhere || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Spare Parts: <Text style={styles.detailVal}>{mechanicSpareParts || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Available For: <Text style={styles.detailVal}>{mechanicAvailableFor || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Tools: <Text style={styles.detailVal}>{mechanicTools || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Emergency Support: <Text style={styles.detailVal}>{mechanicEmergency || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Experience: <Text style={styles.detailVal}>{mechanicExperience || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Languages: <Text style={styles.detailVal}>{mechanicLanguages || "—"}</Text>
                    </Text>
                  </>
                ) : isIrrigation ? (
                  <>
                    <Text style={styles.detailLine}>
                      Short Description: <Text style={styles.detailVal}>{farmersGet || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Type: <Text style={styles.detailVal}>{irrigationType || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Method: <Text style={styles.detailVal}>{irrigationMethod || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Job Size: <Text style={styles.detailVal}>{irrigationJobSize || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Tech Used: <Text style={styles.detailVal}>{irrigationTech || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Consultation: <Text style={styles.detailVal}>{irrigationConsultation || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Duration: <Text style={styles.detailVal}>{irrigationDuration || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Base Rate: <Text style={styles.detailVal}>{irrigationBaseRate || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      After Sales Support: <Text style={styles.detailVal}>{irrigationSupport || "—"}</Text>
                    </Text>
                  </>
                ) : isDrone ? (
                  <>
                    <Text style={styles.detailLine}>
                      Brand/Model: <Text style={styles.detailVal}>{droneBrand || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Service Type: <Text style={styles.detailVal}>{droneServiceType || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Min Area: <Text style={styles.detailVal}>{droneMinArea || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Max Area / Day: <Text style={styles.detailVal}>{droneMaxArea || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Operator Experience: <Text style={styles.detailVal}>{droneExperience || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      License: <Text style={styles.detailVal}>{droneLicense || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Insurance: <Text style={styles.detailVal}>{droneInsurance || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Crops: <Text style={styles.detailVal}>{droneCrops || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Fluid Type: <Text style={styles.detailVal}>{droneFluid || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Equipment: <Text style={styles.detailVal}>{droneEquipment || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Coverage: <Text style={styles.detailVal}>{droneCoverage || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Capacity: <Text style={styles.detailVal}>{droneCapacity || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Crop Phase: <Text style={styles.detailVal}>{dronePhase || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Service Policy: <Text style={styles.detailVal}>{dronePolicy || "—"}</Text>
                    </Text>
                  </>
                ) : isCropInspection ? (
                  <>
                    <Text style={styles.detailLine}>
                      Brief Description: <Text style={styles.detailVal}>{farmersGet || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Inspection Focus: <Text style={styles.detailVal}>{inspectionFocus || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Crops Supported: <Text style={styles.detailVal}>{inspectionCrops || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Tools: <Text style={styles.detailVal}>{inspectionTools || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Experience: <Text style={styles.detailVal}>{inspectionExperience || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Methods: <Text style={styles.detailVal}>{inspectionMethods || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Reporting: <Text style={styles.detailVal}>{inspectionReporting || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Follow Up: <Text style={styles.detailVal}>{inspectionFollowup || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Lead Time: <Text style={styles.detailVal}>{inspectionLeadTime || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Soil Health Analysis: <Text style={styles.detailVal}>{inspectionSoilHealth || "—"}</Text>
                    </Text>
                  </>
                ) : isEquipmentRepair ? (
                  <>
                    <Text style={styles.detailLine}>
                      Short Description: <Text style={styles.detailVal}>{farmersGet || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Equipment Category: <Text style={styles.detailVal}>{repairEquipCategory || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Brand: <Text style={styles.detailVal}>{repairBrand || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Service Category: <Text style={styles.detailVal}>{repairServiceCategory || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Type: <Text style={styles.detailVal}>{repairType || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Model/Quality: <Text style={styles.detailVal}>{repairServiceType || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Drive / Power: <Text style={styles.detailVal}>{repairDrivePower || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Max Lift Capacity: <Text style={styles.detailVal}>{repairLiftCapacity || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Min Order: <Text style={styles.detailVal}>{repairMinOrder || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Warranty: <Text style={styles.detailVal}>{repairWarranty || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Language: <Text style={styles.detailVal}>{repairLanguages || "—"}</Text>
                    </Text>
                  </>
                ) : isService ? (
                  <>
                    <Text style={styles.detailLine}>
                      What Farmers Get: <Text style={styles.detailVal}>{farmersGet || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Area Supported: <Text style={styles.detailVal}>{serviceSupportArea || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Crops Supported: <Text style={styles.detailVal}>{soilCrops || "—"}</Text>
                    </Text>
                  </>
                ) : isWarehouse ? (
                  <>
                    <Text style={styles.detailLine}>
                      Storage Type: <Text style={styles.detailVal}>{warehouseStorageType || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Capacity / Unit: <Text style={styles.detailVal}>{warehouseCapacity || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Coverage: <Text style={styles.detailVal}>{warehouseCoverage || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Security: <Text style={styles.detailVal}>{warehouseSecurity || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Loading Access: <Text style={styles.detailVal}>{warehouseLoading || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Power & Water: <Text style={styles.detailVal}>{warehousePowerWater || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Dimension: <Text style={styles.detailVal}>{warehouseDimension || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Storage Condition:{" "}
                      <Text style={styles.detailVal}>{warehouseStorageCondition || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Duration: <Text style={styles.detailVal}>{warehouseDuration || "—"}</Text>
                    </Text>
                  </>
                ) : isLand ? (
                  <>
                    <Text style={styles.detailLine}>
                      Category: <Text style={styles.detailVal}>{landCategory || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Land Type: <Text style={styles.detailVal}>{landType || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      District: <Text style={styles.detailVal}>{landDistrict || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Town / Location: <Text style={styles.detailVal}>{landTown || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Unit: <Text style={styles.detailVal}>{landUnit || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Rental Type: <Text style={styles.detailVal}>{landRentalType || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Water Access: <Text style={styles.detailVal}>{landWaterAccess || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Soil Type: <Text style={styles.detailVal}>{landSoilType || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Available From: <Text style={styles.detailVal}>{landAvailableFrom || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Owned By: <Text style={styles.detailVal}>{landOwnedBy || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Land Category Supported:{" "}
                      <Text style={styles.detailVal}>{landCategorySupported || "—"}</Text>
                    </Text>
                  </>
                ) : isDriver ? (
                  <>
                    <Text style={styles.detailLine}>
                      Skill Set: <Text style={styles.detailVal}>{driverSkillSet || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Expertise: <Text style={styles.detailVal}>{driverExpertise || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      License: <Text style={styles.detailVal}>{driverLicense || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Experience: <Text style={styles.detailVal}>{driverExperience || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Availability: <Text style={styles.detailVal}>{driverAvailability || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Language: <Text style={styles.detailVal}>{driverLanguage || "—"}</Text>
                    </Text>
                  </>
                ) : isLabor ? (
                  <>
                    <Text style={styles.detailLine}>
                      Category: <Text style={styles.detailVal}>{laborCategory || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Labour Type: <Text style={styles.detailVal}>{laborType || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Team Size: <Text style={styles.detailVal}>{laborTeamSize || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Gender: <Text style={styles.detailVal}>{laborGender || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Shift: <Text style={styles.detailVal}>{laborShift || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Availability: <Text style={styles.detailVal}>{laborHours || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Language: <Text style={styles.detailVal}>{laborLanguage || "—"}</Text>
                    </Text>
                  </>
                ) : isMachinery ? (
                  <>
                    <Text style={styles.detailLine}>
                      Price (hr): <Text style={styles.detailVal}>{priceHr ? formatInr(Number(priceHr) || 0) : "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Engine Type: <Text style={styles.detailVal}>{engineType || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Fuel Consumption: <Text style={styles.detailVal}>{fuelConsumption || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Operator Support: <Text style={styles.detailVal}>{operatorSupport || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Delivery Available: <Text style={styles.detailVal}>{deliveryAvailable || "—"}</Text>
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.detailLine}>
                      Equipment Type: <Text style={styles.detailVal}>{equipmentType || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Fuel / Power Source: <Text style={styles.detailVal}>{fuel || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Power Output: <Text style={styles.detailVal}>{powerHp || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Usage Guidance Available:{" "}
                      <Text style={styles.detailVal}>{usageGuidance || "—"}</Text>
                    </Text>
                  </>
                )}

                {checkedConditions.length ? (
                  <>
                    <Text style={[styles.detailsSectionTitle, { marginTop: 14 }]}>Condition Verification</Text>
                    {checkedConditions.map((c) => (
                      <Text key={c.id} style={styles.conditionBullet}>
                        • {c.label}
                      </Text>
                    ))}
                  </>
                ) : null}

                <Text style={[styles.detailsSectionTitle, { marginTop: 14 }]}>Pricing & Reach</Text>
                <Text style={styles.detailLine}>
                  Rate:{" "}
                  <Text style={styles.detailVal}>
                    {isWarehouse
                      ? `${formatInr(rateNum)} / hour`
                      : isService
                        ? `${formatInr(rateNum)} / ${rateUnitShort}`
                        : `${formatInr(rateNum)}/${rateUnit}`}
                  </Text>
                </Text>
                {isSoilTesting || isService ? (
                  <>
                    <Text style={styles.detailLine}>
                      Service Duration: <Text style={styles.detailVal}>{serviceDuration || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Availability: <Text style={styles.detailVal}>{serviceAvailability || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Service Area Limit: <Text style={styles.detailVal}>{serviceArea || "—"}</Text>
                    </Text>
                  </>
                ) : isWarehouse ? (
                  <>
                    <Text style={styles.detailLine}>
                      Duration: <Text style={styles.detailVal}>{warehouseDuration || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Total:{" "}
                      <Text style={styles.detailVal}>
                        {formatInr(warehouseTotal)} / {warehouseDuration || "period"}
                      </Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Dimension: <Text style={styles.detailVal}>{warehouseDimension || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Storage Condition:{" "}
                      <Text style={styles.detailVal}>{warehouseStorageCondition || "—"}</Text>
                    </Text>
                  </>
                ) : isLabor ? (
                  <>
                    <Text style={styles.detailLine}>
                      Minimum Duration: <Text style={styles.detailVal}>{minDuration || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Persons Required: <Text style={styles.detailVal}>{personsRequired || "—"}</Text>
                    </Text>
                  </>
                ) : isLand ? (
                  <Text style={styles.detailLine}>
                    Service Area: <Text style={styles.detailVal}>{serviceArea || "—"}</Text>
                  </Text>
                ) : (
                  <>
                    <Text style={styles.detailLine}>
                      Service Area: <Text style={styles.detailVal}>{serviceArea || "—"}</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      {securityDeposit.trim() && Number(securityDeposit) > 0
                        ? `Security Deposit: ${formatInr(Number(securityDeposit))}`
                        : "No Security Deposit"}
                    </Text>
                  </>
                )}

                <View style={styles.earningsBox}>
                  <Text style={styles.feeLine}>
                    Platform Fee: {formatInr(platformFee)} ({feePctLabel}%)
                  </Text>
                  <Text style={styles.feeEarn}>
                    Your Earnings: {formatInr(youReceive)} ({earnPctLabel}%)
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {step === 1 ? (
          <Pressable
            style={[styles.primaryBtn, !selectedAsset && styles.btnDisabled]}
            onPress={() => selectedAsset && setStep(2)}
            disabled={!selectedAsset}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#000" />
          </Pressable>
        ) : null}

        {step === 2 ? (
          <View style={styles.footerRow}>
            <Pressable style={styles.secondaryBtn} onPress={() => setStep(1)}>
              <Text style={styles.secondaryBtnText}>Back</Text>
            </Pressable>
            <Pressable
              style={[styles.nextBtn, !canGoStep3 && styles.btnDisabled]}
              onPress={onAddFarmEquipment}
              disabled={!canGoStep3}
            >
              <Text style={[styles.nextBtnText, !canGoStep3 && styles.nextBtnTextDisabled]}>Next</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.footerRow}>
            <Pressable style={styles.secondaryBtn} onPress={() => setStep(2)}>
              <Text style={styles.secondaryBtnText}>Back</Text>
            </Pressable>
            <Pressable
              style={[styles.nextBtn, !canGoReview && styles.btnDisabled]}
              onPress={() => {
                if (!canGoReview) {
                  Alert.alert(
                    "Complete pricing",
                    isSoilTesting || isService
                      ? "Enter total price, unit, duration, availability, and service area limit."
                      : isWarehouse
                        ? "Enter hourly amount, duration, dimension, and storage conditions."
                        : isLand
                          ? "Enter a rate, available from, and service area."
                          : isLabor
                            ? "Enter a rate, period, minimum duration, and persons required."
                            : "Enter a rate and select a service area."
                  );
                  return;
                }
                setDetailsOpen(false);
                setStep(4);
              }}
              disabled={!canGoReview}
            >
              <Text style={[styles.nextBtnText, !canGoReview && styles.nextBtnTextDisabled]}>Next</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.footerRow}>
            <Pressable style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.nextBtn} onPress={onPublish}>
              <Text style={styles.nextBtnText}>Publish</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
    borderWidth: 0
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 0
  },
  sheet: {
    width: "100%",
    backgroundColor: SHEET_BG,
    borderRadius: 13.8,
    borderTopWidth: 0.86,
    borderTopColor: HAIRLINE,
    overflow: "hidden",
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 }
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
    marginTop: 10,
    marginBottom: 10
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 0,
    borderBottomWidth: 0.86,
    borderBottomColor: HAIRLINE,
    backgroundColor: SHEET_BG
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "600" },
  channelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 10,
    borderTopWidth: 0.86,
    borderBottomWidth: 0.86,
    borderTopColor: HAIRLINE,
    borderBottomColor: HAIRLINE,
    backgroundColor: SHEET_BG
  },
  channelItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10
  },
  channelItemActive: {
    backgroundColor: CHANNEL_PILL
  },
  channelIcon: {
    width: 18,
    height: 18
  },
  channelLabel: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  channelLabelActive: { color: APP_LIME },
  scroll: { flex: 1, backgroundColor: SHEET_BG },
  content: { paddingHorizontal: 0, paddingBottom: 28 },
  stepBody: {
    width: "100%",
    paddingBottom: 8,
    backgroundColor: SHEET_BG,
    paddingHorizontal: 15,
    paddingTop: 12
  },
  stepPanel: {
    width: "100%",
    maxWidth: 399,
    alignSelf: "center",
    backgroundColor: BG,
    borderRadius: 13.8,
    borderTopWidth: 0.86,
    borderTopColor: HAIRLINE,
    opacity: 1,
    overflow: "hidden",
    paddingTop: 16,
    paddingBottom: 12
  },
  panelDivider: {
    height: 0.86,
    backgroundColor: HAIRLINE,
    marginHorizontal: 16,
    marginBottom: 12
  },
  detailsForm: {
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 4
  },
  card: {
    backgroundColor: BG,
    borderRadius: 13.8,
    paddingHorizontal: 0,
    paddingTop: 18,
    paddingBottom: 0
  },
  step1Card: {
    alignSelf: "stretch",
    marginTop: 12,
    marginBottom: 12,
    marginHorizontal: 15,
    borderRadius: 13.8,
    borderTopLeftRadius: 13.8,
    borderTopRightRadius: 13.8,
    borderBottomLeftRadius: 13.8,
    borderBottomRightRadius: 13.8,
    borderWidth: 0.86,
    borderColor: HAIRLINE,
    backgroundColor: BG,
    overflow: "hidden"
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 16
  },
  cardHeadLeft: { flex: 1, paddingRight: 8 },
  cardDivider: {
    height: 0.86,
    backgroundColor: HAIRLINE,
    marginBottom: 14,
    alignSelf: "stretch",
    marginHorizontal: 0
  },
  cardHeadOutside: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 16
  },
  cardPadded: {
    marginHorizontal: 8,
    borderRadius: 13.8,
    overflow: "hidden",
    backgroundColor: BG,
    borderTopWidth: 0.86,
    borderTopColor: HAIRLINE
  },
  cardInnerPad: {
    paddingHorizontal: 16,
    paddingBottom: 14
  },
  cardSpaced: {
    marginTop: 12
  },
  stepAssetLine: {
    color: APP_LIME,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4
  },
  stepTextMuted: {
    color: "rgba(255,255,255,0.55)",
    fontWeight: "500"
  },
  whyBtn: { marginTop: 12 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  checkBoxOn: {
    backgroundColor: APP_LIME,
    borderColor: APP_LIME
  },
  stepMeta: { alignItems: "flex-end", gap: 6, flexShrink: 1 },
  stepText: { color: APP_TEXT_MUTED, fontSize: 11, fontWeight: "600", textAlign: "right" },
  stepTextLeft: { color: APP_TEXT_MUTED, fontSize: 12, fontWeight: "600", marginTop: 4 },
  stepTextLeftInline: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "500", marginTop: 4 },
  stepAsset: { color: APP_LIME, fontWeight: "700" },
  stepDots: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center"
  },
  dotActive: { borderColor: APP_LIME },
  dotDone: { borderColor: APP_LIME, backgroundColor: APP_LIME },
  dotCore: { width: 7, height: 7, borderRadius: 3.5 },
  dotCoreActive: { backgroundColor: APP_LIME },
  dotCoreMuted: { backgroundColor: "rgba(255,255,255,0.28)" },
  dotLine: { width: 22, height: 2, backgroundColor: "rgba(255,255,255,0.18)" },
  dotLineDone: { backgroundColor: APP_LIME },
  sectionEyebrow: { color: APP_TEXT, fontSize: 18, fontWeight: "700", lineHeight: 24 },
  sectionTitle: { color: APP_TEXT, fontSize: 15, fontWeight: "600", marginBottom: 10 },
  sectionTitlePadded: { paddingHorizontal: 16 },
  cardTitle: { color: APP_TEXT, fontSize: 16, fontWeight: "700", marginBottom: 6 },
  cardSub: { color: APP_TEXT_MUTED, fontSize: 12, marginBottom: 12, lineHeight: 17 },
  assetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.86,
    borderBottomColor: HAIRLINE,
    backgroundColor: "transparent"
  },
  assetRowSelected: {
    backgroundColor: "#262626"
  },
  assetRowLast: { borderBottomWidth: 0 },
  assetCopy: { flex: 1, paddingRight: 12 },
  assetTitle: { color: APP_TEXT, fontSize: 15, fontWeight: "700" },
  assetTitleSelected: { color: APP_LIME },
  assetSub: { color: APP_TEXT_MUTED, fontSize: 12, marginTop: 3, lineHeight: 16 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  radioSelected: { borderColor: APP_LIME },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: APP_LIME },
  fieldBlock: {
    backgroundColor: FIELD,
    borderRadius: 13.8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 10
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 6
  },
  req: { color: APP_LIME },
  input: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    color: APP_TEXT,
    fontSize: 14,
    fontWeight: "500"
  },
  textArea: { minHeight: 90, color: APP_TEXT, fontWeight: "400", marginTop: 2 },
  select: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  selectVal: { color: APP_TEXT, fontSize: 14, fontWeight: "500", flex: 1, paddingRight: 8 },
  selectPlaceholder: { color: "rgba(255,255,255,0.4)", fontSize: 14, flex: 1 },
  selectList: {
    marginTop: 8,
    backgroundColor: "#151515",
    borderRadius: 13.8,
    borderWidth: 0.86,
    borderColor: HAIRLINE,
    overflow: "hidden"
  },
  selectListTitle: {
    color: APP_LIME,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8
  },
  selectItem: {
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  selectItemSelected: {
    backgroundColor: "#262626"
  },
  selectItemDivider: {
    height: 0.86,
    backgroundColor: HAIRLINE,
    marginHorizontal: 14
  },
  selectItemText: { color: APP_TEXT, fontSize: 14 },
  selectItemTextSelected: { color: APP_LIME, fontWeight: "600" },
  addEquipmentBtn: {
    marginTop: 4,
    backgroundColor: "#000",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.35)"
  },
  addEquipmentText: { color: APP_LIME, fontSize: 14, fontWeight: "800" },
  photoRow: { marginBottom: 12 },
  photoItem: { width: 120, marginRight: 10 },
  photoThumb: { width: 120, height: 80, borderRadius: 8, backgroundColor: "#111" },
  photoName: { color: APP_LIME, fontSize: 10, marginTop: 4 },
  photoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center"
  },
  uploadZone: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 14,
    alignItems: "center",
    gap: 6,
    backgroundColor: "#222"
  },
  uploadTitle: { color: APP_TEXT, fontSize: 13, fontWeight: "600" },
  uploadSub: { color: APP_TEXT_MUTED, fontSize: 11 },
  uploadBtn: {
    marginTop: 10,
    backgroundColor: "#000",
    borderRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.4)"
  },
  uploadBtnText: { color: APP_LIME, fontSize: 12, fontWeight: "800" },
  conditionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.86,
    borderBottomColor: HAIRLINE
  },
  conditionRowLast: { borderBottomWidth: 0 },
  conditionLabel: { flex: 1, color: APP_TEXT, fontSize: 13, paddingRight: 10 },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  checkCircleOn: { backgroundColor: APP_LIME, borderColor: APP_LIME },
  whyTitle: { color: APP_LIME, fontSize: 13, fontWeight: "700" },
  whyBody: { color: APP_TEXT_MUTED, fontSize: 12, lineHeight: 17, marginTop: 6 },
  termsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  termsBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  termsBoxOn: { backgroundColor: APP_LIME, borderColor: APP_LIME },
  termsText: { color: APP_TEXT, fontSize: 13, flex: 1, lineHeight: 18 },
  reviewLine: { color: APP_TEXT, fontSize: 14, marginBottom: 8 },
  reviewLabel: { color: APP_TEXT_MUTED, fontWeight: "600" },
  reviewHint: { color: APP_TEXT_MUTED, fontSize: 12, marginTop: 10, lineHeight: 17 },
  rateRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  rateInputWrap: { flex: 1.2 },
  rateUnitWrap: { flex: 0.9 },
  feeBox: {
    marginTop: 10,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.45)",
    backgroundColor: "rgba(0,0,0,0.35)",
    gap: 4
  },
  feeLine: { color: APP_TEXT, fontSize: 13, lineHeight: 18 },
  feeEarn: { color: APP_LIME, fontSize: 14, fontWeight: "800", marginTop: 2 },
  pricingTipTitle: {
    color: APP_LIME,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4
  },
  pricingIntro: {
    color: APP_TEXT_MUTED,
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18
  },
  pricingTip: {
    color: APP_LIME,
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.9,
    marginTop: 4
  },
  reviewCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)"
  },
  reviewHero: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: "#1a1a1a",
    marginBottom: 14
  },
  reviewHeroEmpty: { alignItems: "center", justifyContent: "center" },
  reviewTitle: { color: APP_TEXT, fontSize: 18, fontWeight: "800", marginBottom: 4 },
  reviewCategory: { color: APP_LIME, fontSize: 13, fontWeight: "700", marginBottom: 10 },
  reviewDesc: { color: APP_TEXT_MUTED, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  reviewDescMuted: { color: APP_TEXT_MUTED, fontSize: 13, fontStyle: "italic", marginBottom: 12 },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10
  },
  viewDetailsText: { color: APP_LIME, fontSize: 14, fontWeight: "700" },
  detailsBlock: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)"
  },
  detailsSectionTitle: {
    color: APP_TEXT,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8
  },
  detailLine: { color: APP_TEXT_MUTED, fontSize: 13, lineHeight: 20, marginBottom: 2 },
  detailVal: { color: APP_TEXT, fontWeight: "600" },
  conditionBullet: { color: APP_TEXT, fontSize: 13, lineHeight: 20, marginBottom: 2 },
  earningsBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "#000",
    gap: 4
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    backgroundColor: SHEET_BG,
    borderTopWidth: 0.86,
    borderTopColor: HAIRLINE
  },
  footerRow: { flexDirection: "row", gap: 10 },
  primaryBtn: {
    backgroundColor: APP_LIME,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primaryBtnFlex: {
    flex: 1,
    backgroundColor: APP_LIME,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryBtnText: { color: "#000", fontSize: 15, fontWeight: "800" },
  secondaryBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)"
  },
  secondaryBtnText: { color: APP_TEXT, fontSize: 15, fontWeight: "700" },
  nextBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: APP_LIME
  },
  nextBtnText: { color: APP_LIME, fontSize: 15, fontWeight: "800" },
  nextBtnTextDisabled: { color: "#666" },
  btnDisabled: { opacity: 0.45 }
});
