import { useState } from "react";
import { Text, View } from "react-native";
import type { LogRecord } from "react-native-nitro-loggerkit";
import { Action, Card, Heading, Page, styles, colors } from "../components/ui";
import { checkout, logger, memory, systemDescription } from "../logging/logger";

export default function Playground() {
  const [records, setRecords] = useState<readonly LogRecord[]>(
    memory.getRecords(),
  );
  const [busy, setBusy] = useState(false);
  async function run(action: () => void) {
    setBusy(true);
    try {
      action();
      await logger.flush();
      setRecords(memory.getRecords());
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading
        eyebrow="NITRO / LOGGER LAB"
        title="One event. Every destination."
      >
        Structured logs with shared context, independent transports, and native
        system output.
      </Heading>
      <Card>
        <Text style={styles.label}>Send a signal</Text>
        <View style={styles.row}>
          <Action
            disabled={busy}
            label="Info"
            onPress={() =>
              void run(() => {
                logger.info("Application ready", { build: 1 });
              })
            }
          />
          <Action
            disabled={busy}
            label="Child context"
            onPress={() =>
              void run(() => {
                checkout.info("Payment started", {
                  amount: 42,
                  currency: "EUR",
                });
              })
            }
          />
          <Action
            disabled={busy}
            label="Redact secrets"
            onPress={() =>
              void run(() => {
                checkout.warn("Credential sample", {
                  user: { id: "demo", password: "never-visible" },
                  authorization: "Bearer demo-secret",
                });
              })
            }
          />
          <Action
            disabled={busy}
            label="Error"
            onPress={() =>
              void run(() => {
                checkout.error("Payment unavailable", {
                  error: new Error("Demo network timeout"),
                  retryable: true,
                });
              })
            }
          />
          <Action
            disabled={busy}
            label="Burst × 1,000"
            onPress={() =>
              void run(() => {
                for (let i = 0; i < 1000; i++)
                  logger.debug("Burst event", { index: i });
              })
            }
          />
        </View>
        <Text style={styles.body}>{systemDescription}</Text>
      </Card>
      <View
        style={[
          styles.row,
          { justifyContent: "space-between", alignItems: "center" },
        ]}
      >
        <Text style={styles.label}>Recent records · {records.length}</Text>
        <Action
          label="Clear"
          onPress={() => {
            memory.clear();
            setRecords([]);
          }}
        />
      </View>
      {records.length === 0 && (
        <Card>
          <Text style={styles.body}>
            Emit a log above to inspect its context and redacted attributes.
          </Text>
        </Card>
      )}
      {[...records].reverse().map((record) => (
        <Card key={record.sequence}>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Text
              style={{
                color:
                  record.level === "error" ? colors.warning : colors.accent,
                fontWeight: "700",
              }}
            >
              {record.level.toUpperCase()} · #{record.sequence}
            </Text>
            <Text style={styles.code}>
              {new Date(record.timestampMs).toLocaleTimeString()}
            </Text>
          </View>
          <Text style={styles.label}>{record.message}</Text>
          <Text selectable style={styles.code}>
            {JSON.stringify(record.attributes, null, 2)}
          </Text>
        </Card>
      ))}
    </Page>
  );
}
