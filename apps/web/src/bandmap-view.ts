import { BANDMAP_40M, type BandmapEngine, type BandmapStation, type DxStationActivity, type VirtualVfo } from "@gadx/runner-core";

export interface BandmapViewActions {
  select(stationId: string, fillCallsign: boolean): void;
}

const PLOT_HEIGHT = 680;
const SCALE_X = 48;
const LABEL_X = 74;
const LABEL_GAP = 27;

export class BandmapView {
  constructor(
    private readonly root: HTMLElement,
    private readonly engine: BandmapEngine,
    private readonly vfo: VirtualVfo,
    private readonly actions: BandmapViewActions,
    private readonly activityFor?: (stationId: string) => DxStationActivity | undefined,
  ) {}

  render(now = Date.now()): void {
    const plot = this.root.querySelector<HTMLElement>("#bandmap-plot");
    const frequency = this.root.querySelector<HTMLOutputElement>("#bandmap-frequency");
    const spotCount = this.root.querySelector<HTMLOutputElement>("#bandmap-spot-count");
    if (!plot || !frequency || !spotCount) return;
    const stations = this.engine.stations;
    frequency.value = `${this.vfo.frequencyKhz.toFixed(2)} kHz`;
    spotCount.value = String(stations.length);
    plot.replaceChildren();

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 260 ${PLOT_HEIGHT}`);
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("bandmap-scale");
    for (let khz = BANDMAP_40M.lowerKhz; khz <= BANDMAP_40M.upperKhz; khz += 1) {
      const y = this.position(khz);
      const major = khz % 5 === 0;
      const line = document.createElementNS(svg.namespaceURI, "line");
      line.setAttribute("x1", String(major ? 9 : 27));
      line.setAttribute("x2", String(SCALE_X));
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
      line.classList.add(major ? "major-tick" : "minor-tick");
      svg.append(line);
      if (major) {
        const label = document.createElementNS(svg.namespaceURI, "text");
        label.setAttribute("x", "5");
        label.setAttribute("y", String(y - 4));
        label.textContent = String(khz);
        svg.append(label);
      }
    }

    const labelPositions = this.labelPositions(stations);
    stations.forEach((station, index) => {
      const anchorY = this.position(station.frequencyKhz);
      const labelY = labelPositions[index]!;
      const connector = document.createElementNS(svg.namespaceURI, "line");
      connector.setAttribute("x1", String(SCALE_X));
      connector.setAttribute("x2", String(LABEL_X - 5));
      connector.setAttribute("y1", String(anchorY));
      connector.setAttribute("y2", String(labelY + 11));
      connector.classList.add("spot-connector", station.status);
      svg.append(connector);

      const button = document.createElement("button");
      button.type = "button";
      const activity = this.activityFor?.(station.id);
      button.className = `bandmap-spot ${station.status}${activity ? ` ${activity}` : ""}`;
      button.style.top = `${labelY}px`;
      button.textContent = activity === "qsy" ? `${station.callsign} QSY` : station.callsign;
      button.title = this.tooltip(station, now);
      button.setAttribute("aria-label", this.tooltip(station, now));
      button.disabled = activity === "worked" || activity === "qsy";
      button.addEventListener("click", () => this.actions.select(station.id, true));
      plot.append(button);
    });

    const arrowY = this.position(this.vfo.frequencyKhz);
    const arrow = document.createElementNS(svg.namespaceURI, "polygon");
    arrow.setAttribute("points", `50,${arrowY} 64,${arrowY - 7} 64,${arrowY + 7}`);
    arrow.classList.add("vfo-arrow");
    svg.append(arrow);
    plot.prepend(svg);
  }

  private position(frequencyKhz: number): number {
    return ((frequencyKhz - BANDMAP_40M.lowerKhz) / (BANDMAP_40M.upperKhz - BANDMAP_40M.lowerKhz)) * PLOT_HEIGHT;
  }

  private labelPositions(stations: readonly BandmapStation[]): number[] {
    const maximum = PLOT_HEIGHT - 25;
    const positions: number[] = [];
    for (const station of stations) {
      const desired = Math.max(0, Math.min(maximum, this.position(station.frequencyKhz) - 11));
      positions.push(Math.max(desired, (positions.at(-1) ?? -LABEL_GAP) + LABEL_GAP));
    }
    const overflow = Math.max(0, (positions.at(-1) ?? 0) - maximum);
    return positions.map((position) => Math.max(0, position - overflow));
  }

  private tooltip(station: BandmapStation, now: number): string {
    const ageMinutes = Math.max(0, Math.floor((now - station.spottedAt) / 60_000));
    return `${station.callsign} · ${station.frequencyKhz.toFixed(2)} kHz · ${station.wpm} WPM · ${station.signalDb} dB · spot há ${ageMinutes} min`;
  }
}
