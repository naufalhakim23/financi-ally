import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getHealth } from "../src/lib/api";

// Home — M0 smoke screen. Pings backend /healthz every 10s so the moment the
// Go service + Postgres are up, the tile flips green. Replaced by the real
// dashboard (net worth, budget, recent) in M3.
export default function Home() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 10_000,
  });

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Text style={{ fontSize: 30, fontWeight: "700", marginBottom: 4 }}>
        FinanciAlly
      </Text>
      <Text style={{ color: "#6b7280", marginBottom: 28 }}>M0 scaffold</Text>

      {isLoading && <ActivityIndicator testID="health-loading" />}
      {isError && (
        <Text style={{ color: "#dc2626" }} testID="health-error">
          backend unreachable: {(error as Error).message}
        </Text>
      )}
      {data && (
        <View
          testID="health-ok"
          style={{
            padding: 18,
            borderRadius: 12,
            backgroundColor: "#f3f4f6",
            gap: 4,
          }}
        >
          <Text>status: {data.status}</Text>
          <Text
            style={{
              color: data.db === "up" ? "#16a34a" : "#dc2626",
              fontWeight: "600",
            }}
          >
            db: {data.db}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
