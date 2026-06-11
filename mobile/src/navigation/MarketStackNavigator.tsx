import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MarketCategoryListingScreen } from "../screens/MarketCategoryListingScreen";
import { MarketHomeScreen } from "../screens/MarketHomeScreen";
import { MarketplaceScreen } from "../screens/MarketplaceScreen";
import { CartScreen } from "../screens/CartScreen";
import { CheckoutScreen } from "../screens/CheckoutScreen";

export type CheckoutBill = {
  subtotal: number;
  discount: number;
  afterCoupon: number;
  delivery: number;
  platformFee: number;
  gstOnFee: number;
  walletApplied: number;
  total: number;
};

export type MarketStackParamList = {
  MarketplaceHome: undefined;
  MarketCategory: { categoryId: string };
  MarketListings: undefined;
  Cart: undefined;
  Checkout: {
    amountPaise: number;
    receipt: string;
    bill: CheckoutBill;
    appliedCouponLabel: string;
  };
};

const Stack = createNativeStackNavigator<MarketStackParamList>();

export function MarketStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MarketplaceHome" component={MarketHomeScreen} />
      <Stack.Screen name="MarketCategory" component={MarketCategoryListingScreen} />
      <Stack.Screen name="MarketListings" component={MarketplaceScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
    </Stack.Navigator>
  );
}
