import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

export type RootStackParamList = {
  Home: undefined;
  CCTV: undefined;
  Settings: undefined;
  MovementLog: undefined;
  Gallery: undefined;
};

export type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;
export type CCTVScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CCTV'>;
export type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;
export type MovementLogScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MovementLog'>;
export type GalleryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Gallery'>;

export type HomeScreenRouteProp = RouteProp<RootStackParamList, 'Home'>;
export type CCTVScreenRouteProp = RouteProp<RootStackParamList, 'CCTV'>;
export type SettingsScreenRouteProp = RouteProp<RootStackParamList, 'Settings'>;
export type MovementLogScreenRouteProp = RouteProp<RootStackParamList, 'MovementLog'>;
export type GalleryScreenRouteProp = RouteProp<RootStackParamList, 'Gallery'>;

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type CCTVScreenProps = NativeStackScreenProps<RootStackParamList, 'CCTV'>;
export type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export type MovementLogScreenProps = NativeStackScreenProps<RootStackParamList, 'MovementLog'>;
export type GalleryScreenProps = NativeStackScreenProps<RootStackParamList, 'Gallery'>;
