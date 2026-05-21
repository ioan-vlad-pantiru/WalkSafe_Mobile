import React from "react";
import { View, TouchableOpacity, Text, StyleSheet, useColorScheme, Platform } from "react-native";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../../app/";
import Colors from "@/constants/Colors";
import FooterItem from "./FooterItem";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

type NavigationProp = StackNavigationProp<RootStackParamList>;

const Footer: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const theme = useColorScheme() || "light";
  const currentRoute = useNavigationState((state) => state.routes[state.index].name);
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={80}
      tint={theme === "dark" ? "dark" : "light"}
      style={[
        styles.footer,
        {
          bottom: -insets.bottom,
          paddingBottom: insets.bottom - 20,
        },
      ]}
    >
      <View style={[styles.footerContent, { backgroundColor: theme === "dark" ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)' }]}>
        <FooterItem label="Home" onPress={() => navigation.navigate("Home")} theme={theme} isActive = {currentRoute === "Home" || currentRoute === "Search"} iconSource={require('../../assets/icons/home-icon.png')}/>
        <FooterItem label="Explore" onPress={() => navigation.navigate("Explore")} theme={theme} isActive = {currentRoute === "Explore"} iconSource={require('../../assets/icons/explore-icon.png')} />
        <FooterItem label="Profile" onPress={() => navigation.navigate("User")} theme={theme} isActive = {currentRoute === "User"} iconSource={require('../../assets/icons/user.png')} />
      </View>
    </BlurView>
  );
};

const styles = StyleSheet.create({
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  footerContent: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 8,
  },
  footerButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
});

export default Footer;
