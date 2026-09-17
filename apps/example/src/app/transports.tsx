import { useState } from "react";
import { Text } from "react-native";
import { createLogger } from "react-native-nitro-loggerkit";
import { createMemoryTransport } from "react-native-nitro-loggerkit/memory";
import { Action, Card, Heading, Page, styles } from "../components/ui";
import { logger } from "../logging/logger";

export default function Transports() {
  const [status, setStatus] = useState(logger.getStatus());
  const [result, setResult] = useState("");
  async function isolation() {
    const memory = createMemoryTransport();
    const isolated = createLogger({
      transports: [
        { transport: memory },
        {
          transport: {
            name: "failing-demo",
            write() {
              throw new Error("Simulated unavailable service");
            },
          },
        },
      ],
    });
    isolated.info("Healthy destination still receives this");
    const reports = await isolated.close();
    setResult(
      `${memory.getRecords().length} record reached memory.\n${JSON.stringify(reports, null, 2)}`,
    );
  }
  return (
    <Page>
      <Heading eyebrow="INDEPENDENT BY DESIGN" title="Observe the pipeline.">
        Counters expose overload and failures. Delivered means the plugin
        completed its write; remote ingestion is owned by the SDK.
      </Heading>
      <Action
        label="Flush & refresh"
        onPress={() => void logger.flush().then(setStatus)}
      />
      {status.map((item) => (
        <Card key={item.name}>
          <Text style={styles.label}>
            {item.name} · {item.state}
          </Text>
          <Text
            style={styles.code}
          >{`delivered  ${item.delivered}\npending    ${item.pending}\ndropped    ${item.dropped}\nfailed     ${item.failed}\nfailures   ${item.failures}`}</Text>
        </Card>
      ))}
      <Card>
        <Text style={styles.label}>Failure isolation</Text>
        <Text style={styles.body}>
          Run an isolated logger with one healthy and one throwing transport.
        </Text>
        <Action label="Run failure demo" onPress={() => void isolation()} />
        {result !== "" && (
          <Text selectable style={styles.code}>
            {result}
          </Text>
        )}
      </Card>
      <Card>
        <Text style={styles.label}>Sentry & Datadog</Text>
        <Text style={styles.body}>
          Optional adapters use your initialized SDK. This app contains no
          credentials and sends no remote telemetry. See the README for
          integration examples.
        </Text>
      </Card>
    </Page>
  );
}
