import React from 'react';
import { View, Text } from 'react-native';

export const Camera = React.forwardRef((props: any, ref: any) => {
  return React.createElement(View, {
    style: [{ backgroundColor: '#1a1a2e', flex: 1, alignItems: 'center', justifyContent: 'center' }, props.style],
  }, React.createElement(Text, { style: { color: '#8888AA', fontSize: 14 } }, '📹 Camera Preview (Web Mock)'));
});

export const useCameraDevice = (position: string) => ({ id: 'mock', position });
export const useCameraPermission = () => ({ hasPermission: true, requestPermission: async () => 'granted' });
export const useCameraFormat = () => null;
export const useFrameProcessor = () => null;
