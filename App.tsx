import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from './src/screens/HomeScreen';
import { CCTVScreen } from './src/screens/CCTVScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { MovementLogScreen } from './src/screens/MovementLogScreen';
import { GalleryScreen } from './src/screens/GalleryScreen';
import { RootStackParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const guardCamTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#00FF88',
    background: '#0A0A0F',
    card: '#12121A',
    text: '#FFFFFF',
    border: 'rgba(255,255,255,0.08)',
    notification: '#FF3366',
  },
};

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />
      <NavigationContainer theme={guardCamTheme}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="CCTV" component={CCTVScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="MovementLog" component={MovementLogScreen} />
          <Stack.Screen name="Gallery" component={GalleryScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
