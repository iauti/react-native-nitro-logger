import type { PropsWithChildren } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export const colors = {
  background: "#0a1018",
  panel: "#131e2a",
  line: "#273445",
  text: "#edf4fc",
  muted: "#9badc3",
  accent: "#77edba",
  warning: "#ffca80",
};
export function Page({ children }: PropsWithChildren) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}
export function Heading({
  eyebrow,
  title,
  children,
}: PropsWithChildren<{ eyebrow: string; title: string }>) {
  return (
    <View style={{ gap: 10, marginBottom: 12 }}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}
export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}
export function Action({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { opacity: disabled ? 0.4 : pressed ? 0.65 : 1 },
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 22,
    paddingBottom: 50,
    gap: 16,
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1,
  },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  label: { color: colors.text, fontSize: 18, fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  buttonText: { color: "#10281e", fontWeight: "700", fontSize: 13 },
  code: {
    fontFamily: "monospace",
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
});
