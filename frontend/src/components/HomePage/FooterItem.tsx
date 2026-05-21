import React from "react";
import { TouchableOpacity, Text, StyleSheet, Image, View } from "react-native";
import Colors from "@/constants/Colors";

type FooterItemProps = {
  label: string;
  onPress: () => void;
  isActive?: boolean;
  theme?: "light" | "dark";
  iconSource?: any;
};

const FooterItem: React.FC<FooterItemProps> = ({
  label,
  onPress,
  theme = "light",
  isActive = false,
  iconSource,
}) => {
  return (
    <TouchableOpacity 
      style={styles.navButton} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.contentContainer,
          isActive && {
            backgroundColor: Colors[theme].primary,
            borderRadius: 20,
            paddingHorizontal: 20,
            paddingVertical: 8,
          },
        ]}
      >
        <Image
          source={iconSource}
          style={[
            styles.icon,
            { tintColor: isActive ? Colors[theme].buttonText : Colors[theme].text },
          ]}
          resizeMode="contain"
        />
        <Text 
          style={[
            styles.navButtonText, 
            { 
              color: isActive ? Colors[theme].buttonText : Colors[theme].text,
              fontWeight: isActive ? "600" : "400",
            }
          ]}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  navButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  contentContainer: {
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.3s ease",
  },
  navButtonText: {
    fontSize: 12,
    marginTop: 4,
  },
  icon: {
    width: 24,
    height: 24,
  },
});

export default FooterItem;
