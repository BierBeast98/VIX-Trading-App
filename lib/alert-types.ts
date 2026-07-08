// Zentrale Metadaten für alle Alert-Typen — einzige Quelle für Labels/Farben
// (ersetzt die duplizierten Maps in app/alerts/page.tsx und app/dashboard/page.tsx)

export type AlertType =
  | "entry"
  | "stddev"
  | "spike"
  | "vxSpike"
  | "profitTarget"
  | "trailingStop"
  | "event";

export type AlertUrgency = "low" | "medium" | "high";

export interface AlertTypeMeta {
  label: string;
  emailLabel: string;
  color: string;
  description: string;
}

export const ALERT_TYPE_META: Record<AlertType, AlertTypeMeta> = {
  entry: {
    label: "Entry",
    emailLabel: "Einstiegs-Alert",
    color: "#B8E15A",
    description: "VIX fällt in die Low-Fear-Einstiegszone",
  },
  stddev: {
    label: "Std-Dev",
    emailLabel: "Statistischer Alert",
    color: "#F59E0B",
    description: "VIX weicht statistisch signifikant vom Mittelwert ab",
  },
  spike: {
    label: "Spike (Spot)",
    emailLabel: "VIX-Spike-Alert",
    color: "#FF4D4D",
    description: "VIX Spot bewegt sich stark an einem Tag",
  },
  vxSpike: {
    label: "Spike (Future)",
    emailLabel: "VIX-Future-Spike-Alert",
    color: "#FB923C",
    description: "VIX Future bewegt sich stark an einem Tag",
  },
  profitTarget: {
    label: "Gewinnziel",
    emailLabel: "Gewinnziel erreicht",
    color: "#22C55E",
    description: "Offene Position erreicht das Gewinnziel",
  },
  trailingStop: {
    label: "Trailing Stop",
    emailLabel: "Trailing Stop Alert",
    color: "#3B82F6",
    description: "Trailing-Stop aktiviert, angehoben oder unterschritten",
  },
  event: {
    label: "Event",
    emailLabel: "Event-Alert",
    color: "#8B5CF6",
    description: "Wirtschaftstermin mit hoher Marktrelevanz steht an",
  },
};

export const ALERT_TYPES = Object.keys(ALERT_TYPE_META) as AlertType[];
