import type { EventRoundConfig } from '../protocol';
import type { EventRoomController } from '../useEventRoom';

export interface EventAdapterProps {
  room: EventRoomController;
  round: EventRoundConfig;
  onStatusTextChange?: (text: string | null) => void;
}
