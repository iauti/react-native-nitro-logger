import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, Text } from "react-native";
import { colors } from "../components/ui";
import { logger } from "../logging/logger";

export default function Layout() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void logger.flush();
    });
    return () => subscription.remove();
  }, []);
  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          tabBarStyle: {
            backgroundColor: colors.panel,
            borderTopColor: colors.line,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Playground",
            tabBarIcon: ({ color }) => <Text style={{ color }}>◉</Text>,
          }}
        />
        <Tabs.Screen
          name="transports"
          options={{
            title: "Transports",
            tabBarIcon: ({ color }) => <Text style={{ color }}>⇄</Text>,
          }}
        />
        <Tabs.Screen
          name="architecture"
          options={{
            title: "Architecture",
            tabBarIcon: ({ color }) => <Text style={{ color }}>◇</Text>,
          }}
        />
      </Tabs>
    </>
  );
}
