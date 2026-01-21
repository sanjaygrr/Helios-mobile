import React from 'react';
import { View, Text } from 'react-native';

const MapView = (props) => (
    <View style={[{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }, props.style]}>
        <Text>Maps are not supported on Web</Text>
    </View>
);

export const Marker = () => null;
export const Callout = () => null;
export const PROVIDER_DEFAULT = 'default';
export const PROVIDER_GOOGLE = 'google';

export default MapView;
