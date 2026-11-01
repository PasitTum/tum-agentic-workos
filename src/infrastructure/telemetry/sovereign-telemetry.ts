export interface SovereignTelemetryEvent {
  eventId: string;
  sourceModule: 'tum-agentic-workos';
  category: 'AUDIT' | 'SECURITY' | 'PROCUREMENT' | 'WORKFORCE' | 'CREDENTIAL';
  action: string;
  actorId: string;
  actorType: 'HUMAN' | 'AGENT' | 'SYSTEM';
  details: Record<string, unknown>;
  timestamp: string;
}

export class SovereignTelemetryBus {
  private static events: SovereignTelemetryEvent[] = [];

  static emit(
    category: SovereignTelemetryEvent['category'],
    action: string,
    actorId: string,
    actorType: SovereignTelemetryEvent['actorType'],
    details: Record<string, unknown>
  ): SovereignTelemetryEvent {
    const event: SovereignTelemetryEvent = {
      eventId: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sourceModule: 'tum-agentic-workos',
      category,
      action,
      actorId,
      actorType,
      details,
      timestamp: new Date().toISOString()
    };

    this.events.push(event);
    return event;
  }

  static getRecentEvents(limit = 50): SovereignTelemetryEvent[] {
    return this.events.slice(-limit).reverse();
  }

  static clear(): void {
    this.events = [];
  }
}
