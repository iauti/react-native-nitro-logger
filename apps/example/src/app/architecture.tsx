import { Text } from "react-native";
import { Card, Heading, Page, styles } from "../components/ui";

export default function Architecture() {
  return (
    <Page>
      <Heading
        eyebrow="SMALL CORE / OPEN PLUGINS"
        title="Compose what you need."
      >
        The app owns the logger. Features derive children. Plugins own delivery.
      </Heading>
      {[
        [
          "01 · Filter early",
          "The logger threshold runs before snapshots and processors. Each destination also has an independent threshold.",
        ],
        [
          "02 · Snapshot & redact",
          "Context and attributes become bounded, immutable values. Sensitive keys are redacted recursively after processors. Keep secrets out of free-text messages.",
        ],
        [
          "03 · Independent queues",
          "Each transport gets a bounded queue and serial batches. Overflow drops newest. Timeouts quarantine the affected transport.",
        ],
        [
          "04 · Native where useful",
          "A Nitro factory creates a configured system handle. Swift writes to OSLog; Kotlin writes to Logcat. Payloads cross the boundary in batches.",
        ],
        [
          "05 · Explicit lifecycle",
          "Flush waits for earlier records and SDK flush if available. Close drains and releases owned resources for the complete child family. Background flushing is best effort.",
        ],
      ].map(([title, body]) => (
        <Card key={title}>
          <Text style={styles.label}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </Card>
      ))}
    </Page>
  );
}
