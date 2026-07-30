import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

const BG = "#0a0a0a";
const PLACEHOLDER = "#2b2b2b";
const CARD_BORDER = "rgba(201, 255, 53, 0.55)";
const TEXT = APP_TEXT;
const MUTED = APP_TEXT_MUTED;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const REVEAL_OFFSET = 56;

type ProviderTab = "machinery" | "logistics" | "agents";

type ProviderTabConfig = {
  id: ProviderTab;
  label: string;
  category: string;
  title: string;
  body: string;
};

const PROVIDER_TABS: ProviderTabConfig[] = [
  {
    id: "machinery",
    label: "Machinery owners",
    category: "Equipment",
    title: "Rent out your tractors, harvesters, and farm machinery",
    body: "Your idle machinery is a wasted asset. List it on Cropvibe and let local farmers book it by the day or season."
  },
  {
    id: "logistics",
    label: "Logistics providers",
    category: "Transport",
    title: "Move produce and inputs across districts with steady demand",
    body: "Connect with farmers and buyers who need reliable transport. Set your routes, rates, and availability on Cropvibe."
  },
  {
    id: "agents",
    label: "Agents",
    category: "Services",
    title: "Offer expert advice, soil testing, and on-farm services",
    body: "Share your expertise with growers who need guidance. Build a trusted profile and get booked for consultations and field visits."
  }
];

const TRUST_FEATURES = [
  {
    icon: "checkmark-circle-outline" as const,
    title: "Verified network",
    body: "Every farmer on Cropvibe passes the same strict checks you do. Work with people you can trust."
  },
  {
    icon: "time-outline" as const,
    title: "Flexible schedule",
    body: "You decide when your equipment is available. Block off planting season or open up next week."
  },
  {
    icon: "cash-outline" as const,
    title: "Secure payments",
    body: "Money moves directly to your bank after a job is confirmed. No chasing invoices or late payers."
  },
  {
    icon: "grid-outline" as const,
    title: "Growth tools",
    body: "A clean dashboard shows your earnings, bookings, and availability. Run your operation from one screen."
  }
];

const PROCESS_STEPS = [
  {
    icon: "cube-outline" as const,
    title: "Sign up",
    body: "A quick form — name, phone, and what you offer. Takes less time than a cup of coffee."
  },
  {
    icon: "shield-checkmark-outline" as const,
    title: "Verify",
    body: "Upload ID, bank details, and any business registration or certifications you hold."
  },
  {
    icon: "document-text-outline" as const,
    title: "List",
    body: "Add photos, set daily rates, and mark available dates. Farmers respect honest listings."
  },
  {
    icon: "notifications-outline" as const,
    title: "Get booked",
    body: "You get a notification for every booking request. Review, accept, or decline — your call."
  }
];

const VERIFY_CARDS = [
  {
    icon: "grid-outline" as const,
    title: "Machinery owners need government ID and equipment proof",
    body: "Individuals submit government ID and bank details. Businesses add registration certificates. Photos of your equipment help farmers trust the listing."
  },
  {
    icon: "shield-checkmark-outline" as const,
    title: "Logistics and transport providers need business registration and vehicle papers",
    body: "Submit your business registration, driver IDs, and vehicle registration documents. Every truck on the platform must be verified."
  },
  {
    icon: "leaf-outline" as const,
    title: "Agriculture experts must show professional certifications and credentials",
    body: "Upload your degrees, extension certificates, or professional body memberships. Farmers pay for proven knowledge, not guesswork."
  }
];

const PRICING_POINTS = ["You make, you earn", "No listing fees, ever", "Paid when the job is done"];

const DASHBOARD_FEATURES = [
  {
    title: "Booking management",
    body: "See every request, message the farmer, and keep a calendar of upcoming jobs."
  },
  {
    title: "Earnings tracking",
    body: "Weekly and monthly income reports. Commission breakdowns. Payout history."
  },
  {
    title: "Availability settings",
    body: "Block off weeks. Toggle a listing on or off. Update rates without calling support."
  }
];

const PROVIDER_STORIES = [
  {
    quote:
      "My tractor sat idle half the year. Now I make more than I do during planting season. The farmers are serious and the platform just works.",
    name: "Amanu Skonkwos",
    role: "Machinery owner, Kaduna"
  },
  {
    quote:
      "I listed two trucks and filled empty return trips within a week. Payments land on time — that alone made the switch worth it.",
    name: "Ravi Reddy",
    role: "Logistics provider, Guntur"
  },
  {
    quote:
      "Soil testing bookings used to come through WhatsApp chaos. Cropvibe keeps my schedule clean and farmers know I am verified.",
    name: "Dr. Meera Iyer",
    role: "Agri expert, Coimbatore"
  },
  {
    quote:
      "Listing my harvester took minutes. The first season alone covered maintenance costs I used to eat myself.",
    name: "Suresh Patil",
    role: "Machinery owner, Nashik"
  }
];

const FOOTER_LINKS = [
  "Machinery owners",
  "Logistics providers",
  "Agri experts",
  "Pricing",
  "Dashboard"
];

function GhostButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.ghostBtn} onPress={onPress} accessibilityRole="button">
      <Text style={styles.ghostBtnText}>{label}</Text>
    </Pressable>
  );
}

function LearnLink({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable style={styles.learnLink} onPress={onPress} accessibilityRole="button">
      <Text style={styles.learnLinkText}>Learn</Text>
      <Ionicons name="chevron-forward" size={16} color={TEXT} />
    </Pressable>
  );
}

function MediaPlaceholder({ height = 220 }: { height?: number }) {
  return (
    <View style={[styles.mediaPlaceholder, { height }]}>
      <Ionicons name="image-outline" size={36} color="rgba(255,255,255,0.28)" />
    </View>
  );
}

type RevealBlockProps = {
  children: React.ReactNode;
  scrollY: Animated.Value;
  viewportHeight: number;
  style?: object;
  delay?: number;
};

function RevealBlock({ children, scrollY, viewportHeight, style, delay = 0 }: RevealBlockProps) {
  const viewRef = useRef<View>(null);
  const revealed = useRef(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(REVEAL_OFFSET)).current;

  const runReveal = useCallback(() => {
    if (revealed.current) return;
    revealed.current = true;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 520,
        delay,
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 520,
        delay,
        useNativeDriver: true
      })
    ]).start();
  }, [delay, opacity, translateY]);

  const checkReveal = useCallback(() => {
    if (revealed.current) return;
    viewRef.current?.measureInWindow((_x, y, _w, h) => {
      // Reveal once the block enters ~lower 90% of the visible area.
      if (y < viewportHeight * 0.9 && y + h > 0) {
        runReveal();
      }
    });
  }, [runReveal, viewportHeight]);

  useEffect(() => {
    const id = scrollY.addListener(() => checkReveal());
    const boot = requestAnimationFrame(() => checkReveal());
    return () => {
      scrollY.removeListener(id);
      cancelAnimationFrame(boot);
    };
  }, [checkReveal, scrollY]);

  return (
    <Animated.View
      ref={viewRef}
      onLayout={checkReveal}
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }]
        }
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function ProviderOnboardingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const sectionYs = useRef<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<ProviderTab>("machinery");
  const [storyIndex, setStoryIndex] = useState(0);
  const [email, setEmail] = useState("");
  const [viewportHeight, setViewportHeight] = useState(SCREEN_HEIGHT);

  const activeConfig = PROVIDER_TABS.find((tab) => tab.id === activeTab) ?? PROVIDER_TABS[0];
  const activeStory = PROVIDER_STORIES[storyIndex] ?? PROVIDER_STORIES[0];

  const scrollToKey = (key: string) => {
    const y = sectionYs.current[key];
    if (typeof y === "number") {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }
  };

  const rememberSection = (key: string) => (event: LayoutChangeEvent) => {
    sectionYs.current[key] = event.nativeEvent.layout.y;
  };

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false
  });

  const nextStory = () => setStoryIndex((i) => (i + 1) % PROVIDER_STORIES.length);
  const prevStory = () => setStoryIndex((i) => (i - 1 + PROVIDER_STORIES.length) % PROVIDER_STORIES.length);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={APP_LIME} />
        </Pressable>
        <Text style={styles.topTitle}>Join As Provider</Text>
        <View style={styles.backBtn} />
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
      >
        <RevealBlock scrollY={scrollY} viewportHeight={viewportHeight} style={styles.heroSection}>
          <Text style={styles.heroTitle}>Rent it. Service it. Earn on Cropvibe.</Text>
          <Text style={styles.heroBody}>
            Turn your machinery, transport, or expertise into income. Cropvibe connects you with farmers and buyers
            who need what you offer — right in your region.
          </Text>
          <View style={styles.heroActions}>
            <GhostButton label="Register" />
            <GhostButton label="Learn more" onPress={() => scrollToKey("providers")} />
          </View>
          <MediaPlaceholder height={240} />
        </RevealBlock>

        <RevealBlock
          scrollY={scrollY}
          viewportHeight={viewportHeight}
          style={styles.providersSection}
          delay={40}
        >
          <View onLayout={rememberSection("providers")}>
            <Text style={styles.sectionTag}>Providers</Text>
            <Text style={styles.sectionTitle}>Choose your path to earning</Text>
            <Text style={styles.sectionBody}>
              Cropvibe welcomes three kinds of providers. Select the one that fits your tools and see how the platform
              works for you.
            </Text>
            <View style={styles.sectionActions}>
              <GhostButton label="Register" />
              <LearnLink onPress={() => scrollToKey("process")} />
            </View>
          </View>
        </RevealBlock>

        <RevealBlock scrollY={scrollY} viewportHeight={viewportHeight} delay={60}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
            style={styles.tabScroll}
          >
            {PROVIDER_TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <Pressable
                  key={tab.id}
                  style={styles.tabItem}
                  onPress={() => setActiveTab(tab.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
                  {isActive ? <View style={styles.tabUnderline} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.tabPanel}>
            <Text style={styles.panelCategory}>{activeConfig.category}</Text>
            <Text style={styles.panelTitle}>{activeConfig.title}</Text>
            <Text style={styles.panelBody}>{activeConfig.body}</Text>
            <View style={styles.sectionActions}>
              <GhostButton label="Register" />
              <LearnLink onPress={() => scrollToKey("process")} />
            </View>
            <MediaPlaceholder height={260} />
          </View>
        </RevealBlock>

        <RevealBlock
          scrollY={scrollY}
          viewportHeight={viewportHeight}
          style={styles.trustSection}
          delay={40}
        >
          <View onLayout={rememberSection("trust")}>
            <Text style={styles.leftTag}>Trust</Text>
            <Text style={styles.leftTitle}>Connect with serious farmers who are ready to book</Text>
            <Text style={styles.leftBody}>
              You get a network of farmers who have passed the same strict checks you have. Flexible scheduling,
              secure payments, and a clean dashboard let you run your operation without the usual headaches.
            </Text>
            <View style={[styles.sectionActions, styles.sectionActionsLeft]}>
              <GhostButton label="Register" />
              <LearnLink onPress={() => scrollToKey("process")} />
            </View>
          </View>
        </RevealBlock>

        {TRUST_FEATURES.map((item, index) => (
          <RevealBlock
            key={item.title}
            scrollY={scrollY}
            viewportHeight={viewportHeight}
            style={styles.featureBlock}
            delay={index * 50}
          >
            <Ionicons name={item.icon} size={28} color={TEXT} />
            <Text style={styles.featureTitle}>{item.title}</Text>
            <Text style={styles.featureBody}>{item.body}</Text>
          </RevealBlock>
        ))}

        <RevealBlock
          scrollY={scrollY}
          viewportHeight={viewportHeight}
          style={styles.processSection}
          delay={40}
        >
          <View onLayout={rememberSection("process")}>
            <Text style={styles.sectionTag}>Process</Text>
            <Text style={styles.sectionTitle}>How it works</Text>
            <View style={styles.sectionActions}>
              <GhostButton label="Register" />
              <LearnLink onPress={() => scrollToKey("verification")} />
            </View>
          </View>
        </RevealBlock>

        <View style={styles.timeline}>
          {PROCESS_STEPS.map((step, index) => (
            <RevealBlock
              key={step.title}
              scrollY={scrollY}
              viewportHeight={viewportHeight}
              style={styles.timelineRow}
              delay={index * 60}
            >
              <View style={styles.timelineRail}>
                <View style={styles.timelineIcon}>
                  <Ionicons name={step.icon} size={18} color={TEXT} />
                </View>
                {index < PROCESS_STEPS.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={styles.timelineBody}>
                <Text style={styles.featureTitle}>{step.title}</Text>
                <Text style={styles.featureBody}>{step.body}</Text>
              </View>
            </RevealBlock>
          ))}
        </View>

        <RevealBlock
          scrollY={scrollY}
          viewportHeight={viewportHeight}
          style={styles.verifyHeader}
          delay={40}
        >
          <View onLayout={rememberSection("verification")}>
            <Text style={styles.sectionTag}>Verification</Text>
            <Text style={styles.sectionTitle}>Trust built on proof</Text>
            <Text style={styles.sectionBody}>Every provider earns a verified badge. Here is what you need.</Text>
          </View>
        </RevealBlock>

        {VERIFY_CARDS.map((card, index) => (
          <RevealBlock
            key={card.title}
            scrollY={scrollY}
            viewportHeight={viewportHeight}
            style={styles.verifyCard}
            delay={index * 70}
          >
            <Ionicons name={card.icon} size={26} color={TEXT} />
            <Text style={styles.verifyCardTitle}>{card.title}</Text>
            <Text style={styles.verifyCardBody}>{card.body}</Text>
            <View style={[styles.sectionActions, styles.sectionActionsLeft]}>
              {index === 0 ? <GhostButton label="Register" /> : null}
              <LearnLink />
            </View>
          </RevealBlock>
        ))}

        <RevealBlock
          scrollY={scrollY}
          viewportHeight={viewportHeight}
          style={styles.pricingSection}
          delay={40}
        >
          <View onLayout={rememberSection("pricing")}>
            <Text style={styles.sectionTag}>Pricing</Text>
            <Text style={styles.sectionTitle}>A simple commission. No surprises. No hidden fees</Text>
            <Text style={styles.sectionBody}>
              Cropvibe only earns when you do. Keep more of what you make with transparent fees and payouts after
              every completed job.
            </Text>
            <View style={styles.bulletList}>
              {PRICING_POINTS.map((point) => (
                <View key={point} style={styles.bulletRow}>
                  <Ionicons name="arrow-forward-circle-outline" size={18} color={TEXT} />
                  <Text style={styles.bulletText}>{point}</Text>
                </View>
              ))}
            </View>
            <View style={styles.sectionActions}>
              <GhostButton label="Register" />
              <LearnLink onPress={() => scrollToKey("dashboard")} />
            </View>
            <MediaPlaceholder height={220} />
          </View>
        </RevealBlock>

        <RevealBlock
          scrollY={scrollY}
          viewportHeight={viewportHeight}
          style={styles.dashboardSection}
          delay={40}
        >
          <View onLayout={rememberSection("dashboard")}>
            <Text style={styles.leftTag}>Dashboard</Text>
            <Text style={styles.leftTitle}>Your entire business, run from one clean dashboard</Text>
            <Text style={styles.leftBody}>
              With Cropvibe, you get a command center built for the field. Manage bookings, track earnings, and set
              your availability with a few taps.
            </Text>
            <View style={[styles.sectionActions, styles.sectionActionsLeft]}>
              <GhostButton label="Register" />
              <LearnLink onPress={() => scrollToKey("stories")} />
            </View>
          </View>
        </RevealBlock>

        {DASHBOARD_FEATURES.map((item, index) => (
          <RevealBlock
            key={item.title}
            scrollY={scrollY}
            viewportHeight={viewportHeight}
            style={styles.dashFeature}
            delay={index * 50}
          >
            {index > 0 ? <View style={styles.dashDivider} /> : null}
            <Text style={styles.featureTitle}>{item.title}</Text>
            <Text style={styles.featureBody}>{item.body}</Text>
          </RevealBlock>
        ))}

        <RevealBlock scrollY={scrollY} viewportHeight={viewportHeight} style={styles.mediaWrap}>
          <MediaPlaceholder height={280} />
        </RevealBlock>

        <RevealBlock
          scrollY={scrollY}
          viewportHeight={viewportHeight}
          style={styles.storiesSection}
          delay={40}
        >
          <View onLayout={rememberSection("stories")}>
            <Text style={styles.leftTitle}>Provider stories</Text>
            <Text style={styles.leftBody}>Hear from the people already earning with Cropvibe.</Text>

            <View style={styles.storyCard}>
              <View style={styles.starsRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons key={i} name="star" size={16} color={TEXT} />
                ))}
              </View>
              <Text style={styles.storyQuote}>"{activeStory.quote}"</Text>
              <View style={styles.storyPerson}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{activeStory.name.charAt(0)}</Text>
                </View>
                <Text style={styles.storyMeta}>
                  {activeStory.name}, {activeStory.role}
                </Text>
              </View>
            </View>

            <View style={styles.storyControls}>
              <View style={styles.dotsRow}>
                {PROVIDER_STORIES.map((_, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setStoryIndex(i)}
                    style={[styles.dot, i === storyIndex && styles.dotActive]}
                  />
                ))}
              </View>
              <View style={styles.arrowRow}>
                <Pressable style={styles.arrowBtn} onPress={prevStory} accessibilityLabel="Previous story">
                  <Ionicons name="arrow-back" size={18} color={TEXT} />
                </Pressable>
                <Pressable style={styles.arrowBtn} onPress={nextStory} accessibilityLabel="Next story">
                  <Ionicons name="arrow-forward" size={18} color={TEXT} />
                </Pressable>
              </View>
            </View>
          </View>
        </RevealBlock>

        <RevealBlock
          scrollY={scrollY}
          viewportHeight={viewportHeight}
          style={styles.ctaHero}
          delay={40}
        >
          <Text style={styles.ctaHeroTitle}>Your equipment should be working</Text>
          <Text style={styles.sectionBody}>
            The sign up takes minutes. The verification is straightforward. The earning potential is vast and waiting
            for you.
          </Text>
          <View style={styles.sectionActions}>
            <GhostButton label="Register" />
            <GhostButton label="Learn" onPress={() => scrollToKey("providers")} />
          </View>
        </RevealBlock>

        <RevealBlock scrollY={scrollY} viewportHeight={viewportHeight} style={styles.logoGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.logoCell}>
              <Text style={styles.logoCellText}>{i % 2 === 0 ? "Cropvibe" : "Partner"}</Text>
            </View>
          ))}
        </RevealBlock>

        <RevealBlock scrollY={scrollY} viewportHeight={viewportHeight} style={styles.footer}>
          <Text style={styles.footerBrand}>Cropvibe</Text>
          {FOOTER_LINKS.map((link) => (
            <Pressable
              key={link}
              onPress={() => {
                if (link === "Pricing") scrollToKey("pricing");
                else if (link === "Dashboard") scrollToKey("dashboard");
                else scrollToKey("providers");
              }}
            >
              <Text style={styles.footerLink}>{link}</Text>
            </Pressable>
          ))}

          <Text style={styles.subscribeTitle}>For providers</Text>
          <TextInput
            style={styles.emailInput}
            placeholder="Enter your email"
            placeholderTextColor={MUTED}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Pressable style={styles.subscribeBtn} accessibilityRole="button">
            <Text style={styles.subscribeBtnText}>Subscribe</Text>
          </Pressable>
          <Text style={styles.disclaimer}>
            By subscribing you agree to our Privacy Policy and consent to receive updates about becoming a provider.
          </Text>

          <View style={styles.legalRow}>
            <Text style={styles.legalLink}>Privacy policy</Text>
            <Text style={styles.legalLink}>Terms of service</Text>
            <Text style={styles.legalLink}>Cookies settings</Text>
          </View>
          <Text style={styles.copyright}>© {new Date().getFullYear()} Cropvibe. All rights reserved.</Text>
        </RevealBlock>

        <View style={{ height: 88 }} />
      </Animated.ScrollView>

      <View style={styles.stickyCtaWrap}>
        <Pressable
          style={styles.stickyCta}
          accessibilityRole="button"
          accessibilityLabel="Become A Provider"
          onPress={() => navigation.navigate("ProviderTerms")}
        >
          <Text style={styles.stickyCtaText}>Become A Provider</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)"
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  topTitle: {
    flex: 1,
    color: TEXT,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center"
  },
  scroll: {
    flex: 1
  },
  content: {
    paddingBottom: 24
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 36,
    gap: 20
  },
  heroTitle: {
    color: TEXT,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 42,
    letterSpacing: -0.5,
    maxWidth: SCREEN_WIDTH - 40
  },
  heroBody: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 24
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  ghostBtn: {
    borderWidth: 1,
    borderColor: TEXT,
    paddingHorizontal: 22,
    paddingVertical: 11,
    minWidth: 112,
    alignItems: "center"
  },
  ghostBtnText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "600"
  },
  learnLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 11,
    paddingHorizontal: 4
  },
  learnLinkText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "600"
  },
  mediaPlaceholder: {
    width: "100%",
    backgroundColor: PLACEHOLDER,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  providersSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 16
  },
  sectionTag: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 38,
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 12
  },
  sectionBody: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 16
  },
  sectionActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 8
  },
  sectionActionsLeft: {
    justifyContent: "flex-start"
  },
  tabScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)"
  },
  tabRow: {
    paddingHorizontal: 12,
    gap: 8
  },
  tabItem: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    minWidth: 120,
    alignItems: "center"
  },
  tabLabel: {
    color: MUTED,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center"
  },
  tabLabelActive: {
    color: TEXT,
    fontWeight: "600"
  },
  tabUnderline: {
    marginTop: 10,
    height: 2,
    width: "100%",
    backgroundColor: TEXT
  },
  tabPanel: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
    gap: 16
  },
  panelCategory: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center"
  },
  panelTitle: {
    color: TEXT,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 36,
    textAlign: "center",
    letterSpacing: -0.3
  },
  panelBody: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center"
  },
  trustSection: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
    gap: 16
  },
  leftTag: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12
  },
  leftTitle: {
    color: TEXT,
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 38,
    letterSpacing: -0.3,
    marginBottom: 12
  },
  leftBody: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16
  },
  featureBlock: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 10
  },
  featureTitle: {
    color: TEXT,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28
  },
  featureBody: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 24
  },
  processSection: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 20
  },
  timeline: {
    paddingHorizontal: 20,
    paddingBottom: 12
  },
  timelineRow: {
    flexDirection: "row",
    gap: 14,
    minHeight: 96
  },
  timelineRail: {
    width: 36,
    alignItems: "center"
  },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#121212"
  },
  timelineLine: {
    flex: 1,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.28)",
    marginTop: 6,
    marginBottom: 6
  },
  timelineBody: {
    flex: 1,
    paddingBottom: 22,
    gap: 6
  },
  verifyHeader: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 12
  },
  verifyCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 18,
    gap: 12
  },
  verifyCardTitle: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 30
  },
  verifyCardBody: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 24
  },
  pricingSection: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 20,
    gap: 16
  },
  bulletList: {
    gap: 12,
    marginBottom: 8
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  bulletText: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "500"
  },
  dashboardSection: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 12
  },
  dashFeature: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 8
  },
  dashDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginBottom: 10
  },
  mediaWrap: {
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  storiesSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20
  },
  storyCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "#161616",
    padding: 18,
    gap: 14
  },
  starsRow: {
    flexDirection: "row",
    gap: 4
  },
  storyQuote: {
    color: TEXT,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "500"
  },
  storyPerson: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: TEXT,
    fontWeight: "700"
  },
  storyMeta: {
    flex: 1,
    color: MUTED,
    fontSize: 13,
    lineHeight: 18
  },
  storyControls: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.28)"
  },
  dotActive: {
    backgroundColor: TEXT
  },
  arrowRow: {
    flexDirection: "row",
    gap: 10
  },
  arrowBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  ctaHero: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 24,
    gap: 16,
    alignItems: "center"
  },
  ctaHeroTitle: {
    color: TEXT,
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 40,
    textAlign: "center",
    letterSpacing: -0.4
  },
  logoGrid: {
    paddingHorizontal: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  logoCell: {
    width: "50%",
    height: 72,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  logoCellText: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "600",
    opacity: 0.85
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 20,
    gap: 14
  },
  footerBrand: {
    color: TEXT,
    fontSize: 28,
    fontWeight: "700",
    fontStyle: "italic",
    marginBottom: 8
  },
  footerLink: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "500",
    paddingVertical: 4
  },
  subscribeTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 16
  },
  emailInput: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: TEXT,
    fontSize: 14
  },
  subscribeBtn: {
    borderWidth: 1,
    borderColor: TEXT,
    paddingVertical: 12,
    alignItems: "center"
  },
  subscribeBtnText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "700"
  },
  disclaimer: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18
  },
  legalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)"
  },
  legalLink: {
    color: TEXT,
    fontSize: 12,
    textDecorationLine: "underline"
  },
  copyright: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4
  },
  stickyCtaWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18
  },
  stickyCta: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "rgba(201, 255, 53, 0.35)",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8
  },
  stickyCtaText: {
    color: APP_LIME,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2
  }
});
