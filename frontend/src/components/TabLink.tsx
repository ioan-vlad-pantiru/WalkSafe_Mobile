import React from "react";
import { View, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useColorScheme } from "react-native";
import { ThemedText } from "@/components/ThemedComponents/ThemedText";
import Colors from "@/constants/Colors";

type TabLinkProps = {
  tabs: string[];
  activeTabIndex: number;
  onTabPress: (index: number) => void;
};

const TabLink: React.FC<TabLinkProps> = ({ tabs, activeTabIndex, onTabPress }) => {
  const theme = useColorScheme() || "light";

  return (
    <View style={[styles.tabsContainer, { backgroundColor: Colors[theme].background }]}>
      <View style={[styles.tabsInner, { backgroundColor: Colors[theme].surface }]}>
        {tabs.map((tab, index) => {
          const isActive = activeTabIndex === index;
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.tabButton,
                isActive && [
                  styles.tabButtonActive,
                  { backgroundColor: Colors[theme].primary }
                ],
              ]}
              onPress={() => onTabPress(index)}
              activeOpacity={0.7}
            >
              <ThemedText
                style={[
                  styles.tabButtonText,
                  {
                    color: isActive ? "#FFFFFF" : Colors[theme].textLight,
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
              >
                {tab}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabsInner: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  tabButtonText: {
    fontSize: 14,
  },
});

export default TabLink;
