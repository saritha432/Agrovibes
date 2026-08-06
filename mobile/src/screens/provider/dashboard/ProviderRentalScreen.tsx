import React, { useEffect, useState } from "react";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ProviderChromeHeader } from "./ProviderChrome";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../../../theme/appColors";
import { getProviderBookings, processAdminApprovals } from "../../../services/providerWorkflow";

const BG = "#303132";
const CARD = "#373838";
const HAIRLINE = "rgba(255,255,255,0.1)";

type RentalTab = "inventory" | "bookings" | "payments" | "reports";
type InventoryFilterKey = "listingType" | "status" | "location";
type BookingFilterKey = "bookingType" | "status" | "location";

type FilterConfigItem<K extends string> = {
  key: K;
  label: string;
  options: readonly string[];
};

const RENTAL_TABS: Array<{
  id: RentalTab;
  label: string;
  icon: ImageSourcePropType;
}> = [
  { id: "inventory", label: "Inventory", icon: require("../../../../assets/provider/rental/inventory.png") },
  { id: "bookings", label: "Bookings", icon: require("../../../../assets/provider/rental/bookings.png") },
  { id: "payments", label: "Payments", icon: require("../../../../assets/provider/rental/payments.png") },
  { id: "reports", label: "Reports", icon: require("../../../../assets/provider/rental/reports.png") }
];

const LISTING_TYPE_OPTIONS = ["All", "Equipment", "Machinery", "Drivers", "Labors", "Land", "Warehouse"] as const;
const STATUS_OPTIONS = ["All", "Available", "Booked", "Under Maintenance", "Inactive"] as const;
const LOCATION_OPTIONS = ["All", "Hyderabad", "Vijayawada", "Guntur", "Warangal"] as const;

const INVENTORY_FILTER_CONFIG: Array<FilterConfigItem<InventoryFilterKey>> = [
  { key: "listingType", label: "Listing Type", options: LISTING_TYPE_OPTIONS },
  { key: "status", label: "Status", options: STATUS_OPTIONS },
  { key: "location", label: "Location", options: LOCATION_OPTIONS }
];

const BOOKING_TYPE_OPTIONS = ["All", "Equipment", "Machinery", "Drivers", "Labors", "Land", "Warehouse"] as const;
const BOOKING_STATUS_OPTIONS = ["All", "Pending", "Approved", "Rejected", "Completed"] as const;

const BOOKING_FILTER_CONFIG: Array<FilterConfigItem<BookingFilterKey>> = [
  { key: "bookingType", label: "Booking Type", options: BOOKING_TYPE_OPTIONS },
  { key: "status", label: "Status", options: BOOKING_STATUS_OPTIONS },
  { key: "location", label: "Location", options: LOCATION_OPTIONS }
];

const RENTAL_BOOKINGS = [
  {
    id: "b1",
    title: "AquaVeer 5HP Turbo Submersible Pump",
    category: "Tools & Hand Equipment",
    location: "Location Name",
    bookingType: "Equipment",
    status: "Pending",
    badge: "Available",
    customerName: "Ravi Kumar",
    customerPhone: "+91 98765 43210",
    bookingDate: "12 Aug 2026",
    startTime: "09:00 AM",
    endTime: "05:00 PM",
    duration: "1 Day",
    pickupLocation: "Village Road, Guntur District",
    requestedOn: "10 Aug 2026, 6:42 PM",
    notes: "Need pump for irrigation on 2-acre paddy field. Please confirm delivery timing."
  },
  {
    id: "b2",
    title: "AquaVeer 5HP Turbo Submersible Pump",
    category: "Tools & Hand Equipment",
    location: "Hyderabad",
    bookingType: "Equipment",
    status: "Pending",
    badge: "Available",
    customerName: "Srinivas Reddy",
    customerPhone: "+91 91234 56789",
    bookingDate: "14 Aug 2026",
    startTime: "07:30 AM",
    endTime: "12:30 PM",
    duration: "Half Day",
    pickupLocation: "Shamshabad, Hyderabad",
    requestedOn: "11 Aug 2026, 10:15 AM",
    notes: "Pickup preferred before 8 AM if possible."
  }
] as const;

const INVENTORY_LISTINGS = [
  {
    id: "1",
    title: "AquaVeer 5HP Turbo Submersible Pump",
    category: "Tools & Hand Equipment",
    location: "Location Name",
    status: "Available",
    listingType: "Equipment",
    description:
      "This equipment is in good condition and ready for immediate use. It has been regularly serviced and is suitable for daily operations. Ideal for farmers and contractors looking for reliable performance.",
    expandedIntro:
      "Here's a full specification sheet for aquaVeer 5hp turbo submersible pump, filled out against the crop vibe 'add equipment' listing fields from the doc:",
    equipmentDetails: [
      "Equipment Type: Pump",
      "Fuel / Power Source: Petrol",
      "Tank/Reservoir Capacity: 20 Liters",
      "Power Output: 50 HP",
      "Usage Guidance Available: Yes! Instructional Material Included"
    ],
    conditions: ["All Functions Work Smoothly", "complete with all accessories"],
    pricing: ["Rate: ₹ 2,323/Day", "Service Area: 25 Km"]
  },
  {
    id: "2",
    title: "AquaVeer 5HP Turbo Submersible Pump",
    category: "Tools & Hand Equipment",
    location: "Hyderabad",
    status: "Available",
    listingType: "Equipment",
    description:
      "This equipment is in good condition and ready for immediate use. It has been regularly serviced and is suitable for daily operations. Ideal for farmers and contractors looking for reliable performance.",
    expandedIntro:
      "Here's a full specification sheet for aquaVeer 5hp turbo submersible pump, filled out against the crop vibe 'add equipment' listing fields from the doc:",
    equipmentDetails: [
      "Equipment Type: Pump",
      "Fuel / Power Source: Petrol",
      "Tank/Reservoir Capacity: 20 Liters",
      "Power Output: 50 HP",
      "Usage Guidance Available: Yes! Instructional Material Included"
    ],
    conditions: ["All Functions Work Smoothly", "complete with all accessories"],
    pricing: ["Rate: ₹ 2,323/Day", "Service Area: 25 Km"]
  }
] as const;

type Listing = (typeof INVENTORY_LISTINGS)[number];
type Booking = (typeof RENTAL_BOOKINGS)[number];
type InventoryFilters = Record<InventoryFilterKey, string>;
type BookingFilters = Record<BookingFilterKey, string>;

function RentalTabBar({
  active,
  onChange
}: {
  active: RentalTab;
  onChange: (tab: RentalTab) => void;
}) {
  return (
    <View style={styles.tabBar}>
      {RENTAL_TABS.map((tab) => {
        const selected = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            style={styles.tabItem}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Image
              source={tab.icon}
              style={[styles.tabIcon, { tintColor: selected ? APP_LIME : APP_TEXT }]}
              resizeMode="contain"
            />
            <Text style={[styles.tabLabel, selected && styles.tabLabelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
            {selected ? <View style={styles.tabIndicator} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  open,
  onToggle,
  onSelect
}: {
  label: string;
  value: string;
  options: readonly string[];
  open: boolean;
  onToggle: () => void;
  onSelect: (val: string) => void;
}) {
  const display = value === "All" ? label : value;

  return (
    <View style={styles.filterWrap}>
      <Pressable style={[styles.filterChip, open && styles.filterChipOpen]} onPress={onToggle}>
        <Text style={[styles.filterText, open && styles.filterTextOpen]} numberOfLines={1}>
          {display}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={open ? APP_LIME : APP_TEXT_MUTED} />
      </Pressable>
      {open ? (
        <View style={styles.filterMenu}>
          {options.map((opt, index) => {
            const selected = value === opt;
            return (
              <Pressable
                key={opt}
                style={[styles.filterOption, index === options.length - 1 && styles.filterOptionLast]}
                onPress={() => onSelect(opt)}
              >
                <Text style={styles.filterOptionText}>{opt}</Text>
                <View style={[styles.radio, selected && styles.radioOn]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function FilterRow<K extends string>({
  config,
  filters,
  openFilter,
  onToggle,
  onSelect
}: {
  config: Array<FilterConfigItem<K>>;
  filters: Record<K, string>;
  openFilter: K | null;
  onToggle: (key: K) => void;
  onSelect: (key: K, value: string) => void;
}) {
  return (
    <View style={styles.filterRow}>
      {config.map((filter) => (
        <FilterDropdown
          key={filter.key}
          label={filter.label}
          value={filters[filter.key]}
          options={filter.options}
          open={openFilter === filter.key}
          onToggle={() => onToggle(filter.key)}
          onSelect={(val) => onSelect(filter.key, val)}
        />
      ))}
    </View>
  );
}

function CustomerDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function DetailSection({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <View style={styles.detailSection}>
      <Text style={styles.detailSectionTitle}>{title}</Text>
      {items.map((item) => (
        <Text key={item} style={styles.detailBullet}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

function InventoryListingCard({ listing }: { listing: Listing }) {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const onEditListing = () => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate("ProviderNewListing");
      return;
    }
    navigation.navigate("ProviderNewListing");
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHero}>
        <View style={styles.cardHeroPlaceholder} />
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{listing.status}</Text>
        </View>
      </View>

      <Text style={styles.cardTitle}>{listing.title}</Text>
      <Text style={styles.cardMeta}>
        <Text style={styles.cardMetaAccent}>{listing.category}</Text>
        <Text style={styles.cardMetaMuted}> | {listing.location}</Text>
      </Text>

      {detailsOpen ? (
        <>
          <Text style={styles.cardDesc}>{listing.expandedIntro}</Text>
          <DetailSection title="Equipment Details" items={listing.equipmentDetails} />
          <DetailSection title="Condition Verification" items={listing.conditions} />
          <DetailSection title="Pricing & Reach" items={listing.pricing} />
        </>
      ) : (
        <Text style={styles.cardDesc} numberOfLines={4}>
          {listing.description}
        </Text>
      )}

      <Pressable style={styles.detailsToggle} onPress={() => setDetailsOpen((v) => !v)}>
        <Text style={styles.detailsToggleText}>View Listing Details</Text>
        <Ionicons name={detailsOpen ? "chevron-up" : "chevron-down"} size={16} color={APP_LIME} />
      </Pressable>

      <View style={styles.cardActions}>
        <Pressable style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>Delete</Text>
        </Pressable>
        <Pressable style={styles.editBtn} onPress={onEditListing}>
          <Text style={styles.editBtnText}>Edit Listing</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHero}>
        <View style={styles.cardHeroPlaceholder} />
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{booking.badge}</Text>
        </View>
      </View>

      <Text style={styles.cardTitle}>{booking.title}</Text>
      <Text style={styles.cardMeta}>
        <Text style={styles.cardMetaAccent}>{booking.category}</Text>
        <Text style={styles.cardMetaMuted}> | {booking.location}</Text>
      </Text>

      <View style={styles.customerBlock}>
        <Text style={styles.customerBlockTitle}>Customer Details</Text>
        <CustomerDetailRow label="Name" value={booking.customerName} />
        <CustomerDetailRow label="Phone" value={booking.customerPhone} />
        <CustomerDetailRow label="Booking Date" value={booking.bookingDate} />
        <CustomerDetailRow label="Timing" value={`${booking.startTime} – ${booking.endTime}`} />
        <CustomerDetailRow label="Duration" value={booking.duration} />
        <CustomerDetailRow label="Pickup / Site" value={booking.pickupLocation} />
        <CustomerDetailRow label="Requested On" value={booking.requestedOn} />
        {booking.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Customer Note</Text>
            <Text style={styles.notesText}>{booking.notes}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardActions}>
        <Pressable style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>Reject</Text>
        </Pressable>
        <Pressable style={styles.editBtn}>
          <Text style={styles.editBtnText}>Approve</Text>
        </Pressable>
      </View>
    </View>
  );
}

function matchesInventoryFilters(listing: Listing, filters: InventoryFilters) {
  if (filters.listingType !== "All" && listing.listingType !== filters.listingType) return false;
  if (filters.status !== "All" && listing.status !== filters.status) return false;
  if (filters.location !== "All" && listing.location !== filters.location) return false;
  return true;
}

function matchesBookingFilters(booking: Booking, filters: BookingFilters) {
  if (filters.bookingType !== "All" && booking.bookingType !== filters.bookingType) return false;
  if (filters.status !== "All" && booking.status !== filters.status) return false;
  if (filters.location !== "All" && booking.location !== filters.location) return false;
  return true;
}

function InventoryTab() {
  const [filters, setFilters] = useState<InventoryFilters>({
    listingType: "All",
    status: "All",
    location: "All"
  });
  const [openFilter, setOpenFilter] = useState<InventoryFilterKey | null>(null);

  const visibleListings = INVENTORY_LISTINGS.filter((listing) => matchesInventoryFilters(listing, filters));

  return (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <FilterRow
        config={INVENTORY_FILTER_CONFIG}
        filters={filters}
        openFilter={openFilter}
        onToggle={(key) => setOpenFilter((current) => (current === key ? null : key))}
        onSelect={(key, value) => {
          setFilters((prev) => ({ ...prev, [key]: value }));
          setOpenFilter(null);
        }}
      />
      {visibleListings.map((listing) => (
        <InventoryListingCard key={listing.id} listing={listing} />
      ))}
    </ScrollView>
  );
}

function BookingsTab({ bookings }: { bookings: Booking[] }) {
  const [filters, setFilters] = useState<BookingFilters>({
    bookingType: "All",
    status: "All",
    location: "All"
  });
  const [openFilter, setOpenFilter] = useState<BookingFilterKey | null>(null);

  const visibleBookings = bookings.filter((booking) => matchesBookingFilters(booking, filters));

  return (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <FilterRow
        config={BOOKING_FILTER_CONFIG}
        filters={filters}
        openFilter={openFilter}
        onToggle={(key) => setOpenFilter((current) => (current === key ? null : key))}
        onSelect={(key, value) => {
          setFilters((prev) => ({ ...prev, [key]: value }));
          setOpenFilter(null);
        }}
      />
      {visibleBookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} />
      ))}
    </ScrollView>
  );
}

function RentalPlaceholderTab({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.placeholderTab}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderSub}>{subtitle}</Text>
    </View>
  );
}

export function ProviderRentalScreen() {
  const [activeTab, setActiveTab] = useState<RentalTab>("inventory");
  const [liveBookings, setLiveBookings] = useState<Booking[]>(RENTAL_BOOKINGS as unknown as Booking[]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      await processAdminApprovals();
      const storedBookings = await getProviderBookings();
      if (!mounted || storedBookings.length === 0) return;
      setLiveBookings(storedBookings as unknown as Booking[]);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <ProviderChromeHeader />
      <RentalTabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === "inventory" ? <InventoryTab /> : null}
      {activeTab === "bookings" ? <BookingsTab bookings={liveBookings} /> : null}
      {activeTab === "payments" ? (
        <RentalPlaceholderTab title="Payments" subtitle="Earnings and payout history will appear here." />
      ) : null}
      {activeTab === "reports" ? (
        <RentalPlaceholderTab title="Reports" subtitle="Performance and rental reports will appear here." />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  tabBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 0,
    borderBottomWidth: 0.86,
    borderBottomColor: HAIRLINE,
    backgroundColor: BG
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 10,
    gap: 4,
    minWidth: 0
  },
  tabIcon: {
    width: 20,
    height: 20
  },
  tabLabel: {
    color: APP_TEXT,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    includeFontPadding: false
  },
  tabLabelActive: {
    color: APP_LIME
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: "12%",
    right: "12%",
    height: 2,
    borderRadius: 1,
    backgroundColor: APP_LIME
  },
  tabScroll: { flex: 1 },
  tabContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 120,
    gap: 14
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    zIndex: 10
  },
  filterWrap: {
    flex: 1,
    position: "relative"
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: HAIRLINE,
    gap: 4
  },
  filterChipOpen: {
    borderColor: "rgba(201,255,53,0.45)"
  },
  filterText: {
    color: APP_TEXT_MUTED,
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
    includeFontPadding: false
  },
  filterTextOpen: {
    color: APP_LIME
  },
  filterMenu: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: "#333435",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HAIRLINE,
    overflow: "hidden",
    zIndex: 20,
    elevation: 8
  },
  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE
  },
  filterOptionLast: {
    borderBottomWidth: 0
  },
  filterOptionText: {
    color: APP_TEXT,
    fontSize: 13,
    flex: 1,
    paddingRight: 8
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  radioOn: {
    borderColor: APP_LIME
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: APP_LIME
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: HAIRLINE
  },
  cardHero: {
    position: "relative",
    marginBottom: 12
  },
  cardHeroPlaceholder: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    backgroundColor: "#2a2a2a"
  },
  statusBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.35)"
  },
  statusText: {
    color: APP_LIME,
    fontSize: 11,
    fontWeight: "700"
  },
  cardTitle: {
    color: APP_TEXT,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
    includeFontPadding: false
  },
  cardMeta: {
    fontSize: 12,
    marginBottom: 8
  },
  cardMetaAccent: {
    color: APP_LIME,
    fontWeight: "700"
  },
  cardMetaMuted: {
    color: APP_TEXT_MUTED
  },
  cardDesc: {
    color: APP_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4
  },
  detailSection: {
    marginTop: 10
  },
  detailSectionTitle: {
    color: APP_TEXT,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6
  },
  detailBullet: {
    color: APP_TEXT,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 2
  },
  customerBlock: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
    gap: 8
  },
  customerBlockTitle: {
    color: APP_TEXT,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  detailLabel: {
    width: 98,
    color: APP_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600"
  },
  detailValue: {
    flex: 1,
    color: APP_TEXT,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600"
  },
  notesBox: {
    marginTop: 4,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: HAIRLINE
  },
  notesLabel: {
    color: APP_LIME,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4
  },
  notesText: {
    color: APP_TEXT_MUTED,
    fontSize: 12,
    lineHeight: 18
  },
  detailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12
  },
  detailsToggleText: {
    color: APP_LIME,
    fontSize: 13,
    fontWeight: "700"
  },
  cardActions: {
    flexDirection: "row",
    gap: 10
  },
  deleteBtn: {
    flex: 0.42,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)"
  },
  deleteBtnText: {
    color: APP_TEXT,
    fontSize: 13,
    fontWeight: "700"
  },
  editBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "rgba(201,255,53,0.35)"
  },
  editBtnText: {
    color: APP_LIME,
    fontSize: 13,
    fontWeight: "800"
  },
  placeholderTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 100
  },
  placeholderTitle: {
    color: APP_LIME,
    fontSize: 18,
    fontWeight: "700"
  },
  placeholderSub: {
    marginTop: 8,
    color: APP_TEXT_MUTED,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18
  }
});
