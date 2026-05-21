import React, { useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Modal,
  Alert,
  TouchableWithoutFeedback,
  useColorScheme,
  Platform,
} from "react-native";
import { useUserContext } from "@/context/UserProvider";
import * as SecureStore from "expo-secure-store";
import { API_URL, refreshAccessToken, uploadFile } from "@/utils/apiHelper";
import FetchableImage from "@/components/FetchableImage";
import { launchImageLibrary, launchCamera, ImageLibraryOptions, CameraOptions, MediaType } from 'react-native-image-picker';
import Colors from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useConnectivity } from "@/context/ConnectivityProvider";

const ProfilePictureHeader = ({ navigation }: { navigation: any }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const { userData, setUserData } = useUserContext();
  const [modalVisible, setModalVisible] = useState(false);
  const theme = useColorScheme() || 'light';
  const { isConnected, forceOffline, forceOnline, resetToActual } = useConnectivity();

  useEffect(() => {
    const fetchAccessToken = async () => {
      try {
        let token = await SecureStore.getItemAsync("accessToken");
        if (!token) {
          token = await refreshAccessToken();
        }
        setAccessToken(token);
      } catch (error) {
        console.error("Failed to fetch access token:", error);
        setAccessToken(null);
      }
    };

    fetchAccessToken();
  }, []);


  const handleSelectPhoto = async () => {
    const options: ImageLibraryOptions = {
      mediaType: "photo" as MediaType,
      maxWidth: 3000,
      maxHeight: 3000,
      quality: 1,
    };

    launchImageLibrary(options, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert("Error", response.errorMessage || "An error occurred.");
        return;
      }
      if (response.assets && response.assets.length > 0 && response.assets[0].uri) {
        await uploadPhotoToServer(response.assets[0].uri);
        setModalVisible(false);
      }
    });
  };

  const handleCapturePhoto = async () => {

    const options: CameraOptions = {
      mediaType: "photo" as MediaType,
      saveToPhotos: true,
      maxWidth: 3000,
      maxHeight: 3000,
      quality: 1,
    };

    launchCamera(options, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert("Error", response.errorMessage || "An error occurred.");
        return;
      }
      if (response.assets && response.assets.length > 0 && response.assets[0].uri) {
        await uploadPhotoToServer(response.assets[0].uri);
        setModalVisible(false);
      }
    });
  };

  const uploadPhotoToServer = async (photoUri: string) => {
    if (!photoUri) return;
    const formData = new FormData();
    const photoName = photoUri.split("/").pop() || "profile.jpg";
    formData.append("photo", {
      uri: photoUri,
      name: photoName,
      type: "image/jpeg",
    } as any);

    try {
      const response = await uploadFile(`${API_URL}api/auth/user/`, formData);
      Alert.alert("Success", "Photo uploaded successfully!");
      setUserData({ ...userData, photo: response.photo });
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "An error occurred.");
    }
  };

  const handleLogout = async () => {
    setModalVisible(false); // Close modal before logout
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
    setUserData(null);
    Alert.alert("Success", "Logged out.");
    navigation.navigate("Login");
  };

  const handleChangePassword = () => {
    navigation.navigate("ChangePassword");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: async () => {
            setModalVisible(false); // Close modal before deletion
            try {
              const response = await fetch(`${API_URL}api/auth/user/`, {
                method: "DELETE", 
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              if (response.ok) {
                await SecureStore.deleteItemAsync("accessToken");
                setUserData(null);
                Alert.alert("Success", "Account deleted.");
                navigation.navigate("Login");
              } else {
                Alert.alert("Error", "Failed to delete account.");
              }
            } catch (error) {
              console.error("Delete Account Error:", error);
              Alert.alert("Error", "An error occurred.");
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={styles.profilePictureContainer}
      >
        <FetchableImage
          imageUrl={userData?.photo || null}
          defaultImage={require("@/assets/default-user.png")}
          accessToken={accessToken}
          style={styles.profilePicture}
          resizeMode="cover"
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalContent, { backgroundColor: theme === "dark" ? "#1c1c1e" : "#fff" }]}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: Colors[theme].text }]}>Settings</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close-circle" size={28} color={Colors[theme].text} />
                  </TouchableOpacity>
                </View>

                {/* Photo Options */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: Colors[theme].text, opacity: 0.6 }]}>
                    Profile Photo
                  </Text>
                  <TouchableOpacity style={[styles.modernButton, { backgroundColor: Colors[theme].primary }]} onPress={handleSelectPhoto}>
                    <Ionicons name="images-outline" size={22} color={Colors[theme].buttonText} />
                    <Text style={[styles.buttonText, { color: Colors[theme].buttonText }]}>Select from Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modernButton, { backgroundColor: Colors[theme].primary }]} onPress={handleCapturePhoto}>
                    <Ionicons name="camera-outline" size={22} color={Colors[theme].buttonText} />
                    <Text style={[styles.buttonText, { color: Colors[theme].buttonText }]}>Take Photo</Text>
                  </TouchableOpacity>
                </View>

                {/* Debug Options */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: Colors[theme].text, opacity: 0.6 }]}>
                    Developer Options
                  </Text>
                  <View style={styles.debugContainer}>
                    <View style={styles.debugHeader}>
                      <Ionicons name="bug-outline" size={20} color={Colors[theme].text} />
                      <Text style={[styles.debugTitle, { color: Colors[theme].text }]}>
                        Offline Mode Test
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: isConnected ? '#34C759' : '#FF3B30' }]}>
                        <Text style={styles.statusText}>{isConnected ? 'Online' : 'Offline'}</Text>
                      </View>
                    </View>
                    <Text style={[styles.debugDescription, { color: Colors[theme].text, opacity: 0.6 }]}>
                      Simulate offline mode without disconnecting from Expo
                    </Text>
                    <View style={styles.debugButtons}>
                      <TouchableOpacity 
                        style={[styles.debugButton, styles.offlineDebugButton]} 
                        onPress={forceOffline}
                      >
                        <Ionicons name="cloud-offline-outline" size={18} color="#fff" />
                        <Text style={styles.debugButtonText}>Force Offline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.debugButton, styles.onlineDebugButton]} 
                        onPress={forceOnline}
                      >
                        <Ionicons name="cloud-done-outline" size={18} color="#fff" />
                        <Text style={styles.debugButtonText}>Force Online</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.debugButton, styles.resetDebugButton]} 
                        onPress={resetToActual}
                      >
                        <Ionicons name="refresh-outline" size={18} color="#fff" />
                        <Text style={styles.debugButtonText}>Reset</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Account Options */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: Colors[theme].text, opacity: 0.6 }]}>
                    Account
                  </Text>
                  <TouchableOpacity style={[styles.modernButton, { backgroundColor: Colors[theme].primary }]} onPress={handleChangePassword}>
                    <Ionicons name="key-outline" size={22} color={Colors[theme].buttonText} />
                    <Text style={[styles.buttonText, { color: Colors[theme].buttonText }]}>Change Password</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modernButton, styles.logoutButton]} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={22} color="#fff" />
                    <Text style={[styles.buttonText, { color: "#fff" }]}>Logout</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modernButton, styles.deleteButton]} onPress={handleDeleteAccount}>
                    <Ionicons name="trash-outline" size={22} color="#fff" />
                    <Text style={[styles.buttonText, { color: "#fff" }]}>Delete Account</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  profilePictureContainer: {
    marginLeft: 10,
    width: 35,
    height: 35,
    borderRadius: 17.5,
    overflow: "hidden",
  },
  profilePicture: {
    width: "100%",
    height: "100%",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
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
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "700",
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 5,
  },
  modernButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 15,
    marginBottom: 10,
    gap: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  logoutButton: {
    backgroundColor: "#FF9500",
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
  },
  cancelButton: {
    backgroundColor: Colors.light.secondary,
  },
  // Debug styles
  debugContainer: {
    backgroundColor: 'rgba(100, 100, 100, 0.1)',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(100, 100, 100, 0.2)',
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  debugDescription: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  debugButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  debugButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  offlineDebugButton: {
    backgroundColor: '#FF3B30',
  },
  onlineDebugButton: {
    backgroundColor: '#34C759',
  },
  resetDebugButton: {
    backgroundColor: '#007AFF',
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ProfilePictureHeader;
