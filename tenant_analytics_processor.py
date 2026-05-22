import json
import time
from collections import defaultdict, deque
from confluent_kafka import Consumer

TOPIC = 'user-activity'
WINDOW_SECONDS = 5 * 60


def create_consumer() -> Consumer:
  return Consumer({
      'bootstrap.servers': 'localhost:9092',
      'group.id': 'tenant-analytics-processor',
      'auto.offset.reset': 'earliest',
  })


def evict_old_events(action_windows: dict[str, dict[str, deque[float]]], now: float) -> None:
  for actions in action_windows.values():
    for timestamps in actions.values():
      while timestamps and now - timestamps[0] > WINDOW_SECONDS:
        timestamps.popleft()


def aggregate_counts(action_windows: dict[str, dict[str, deque[float]]]) -> dict[str, dict[str, int]]:
  aggregates: dict[str, dict[str, int]] = {}
  for tenant_id, actions in action_windows.items():
    counts = {action: len(timestamps) for action, timestamps in actions.items() if timestamps}
    if counts:
      aggregates[tenant_id] = counts
  return aggregates


def main() -> None:
  consumer = create_consumer()
  consumer.subscribe([TOPIC])

  action_windows: dict[str, dict[str, deque[float]]] = defaultdict(lambda: defaultdict(deque))
  last_flush = time.time()

  try:
    while True:
      msg = consumer.poll(timeout=1.0)
      now = time.time()

      if msg is None:
        evict_old_events(action_windows, now)
      elif msg.error():
        print(f'Kafka error: {msg.error()}')
      else:
        event = json.loads(msg.value().decode('utf-8'))
        tenant_id = str(event.get('tenant_id', '')).strip()
        action = str(event.get('action', '')).strip()

        if tenant_id and action:
          action_windows[tenant_id][action].append(now)
          evict_old_events(action_windows, now)

      if now - last_flush >= 5:
        aggregated = aggregate_counts(action_windows)
        if aggregated:
          print(json.dumps({
              'window_seconds': WINDOW_SECONDS,
              'generated_at_epoch': int(now),
              'aggregates': aggregated,
          }))
        last_flush = now
  except KeyboardInterrupt:
    pass
  finally:
    consumer.close()


if __name__ == '__main__':
  main()
