import * as React from 'react'
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import Photo from "./Photo";
import Devices from "./Devices";

const Stack = createNativeStackNavigator();

export default function App() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<NavigationContainer>
				<Stack.Navigator initialRouteName="Photo" screenOptions={{ headerShown: false }}>
					<Stack.Screen name="Photo" component={Photo} />
					<Stack.Screen name="Devices" component={Devices} />
				</Stack.Navigator>
			</NavigationContainer>
		</GestureHandlerRootView>
	);
}