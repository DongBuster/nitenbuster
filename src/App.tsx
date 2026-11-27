import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, Boxes, Home } from 'lucide-react';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { Game3DScreen } from './screens/Game3DScreen';
import { Showcase3D } from './screens/Showcase3D';
import { OnlineLobbyScreen } from './screens/OnlineLobbyScreen';
import { OnlineGame3DScreen } from './screens/OnlineGame3DScreen';
import { ModeSelectScreen } from './screens/ModeSelectScreen';
import { normalizeRoomCode } from './online/sanitize';
import { useOnlineRoom } from './online/useOnlineRoom';

const LazyBrawlScreen = lazy(() => import('./screens/BrawlScreen'));
const LazyBlockBlastScreen = lazy(() => import('./screens/BlockBlastScreen'));
const LazyBlockBlastRoomContainer = lazy(
  () => import('./blockblast/ui/BlockBlastRoomContainer'),
);
const LazyGlassCarryScreen = lazy(() => import('./screens/GlassCarryScreen'));
const LazyEventRoomScreen = lazy(() => import('./screens/EventRoomScreen'));

type AppScreen =
  | 'modeSelect'
  | 'menu'
  | 'game'
  | 'online'
  | 'studio3d'
  | 'brawl'
  | 'blockblast'
  | 'blockblastRoom'
  | 'glassCarry'
  | 'event';

function OnlineModeContainer({
  initialRoomCode,
  onBackToMenu,
}: {
  initialRoomCode?: string;
  onBackToMenu: () => void;
}) {
  const room = useOnlineRoom();

  if (room.phase === 'playing' && room.gameState) {
    return <OnlineGame3DScreen room={room} onBackToMenu={onBackToMenu} />;
  }

  return (
    <OnlineLobbyScreen
      room={room}
      initialRoomCode={initialRoomCode}
      onBackToMenu={onBackToMenu}
    />
  );
}

interface ModeBoundaryProps {
  title: string;
  fallbackMessage: string;
  bgClass?: string;
  onBack: () => void;
  children: ReactNode;
}

interface ModeBoundaryState {
  hasError: boolean;
  message: string;
}

/**
 * Shared error boundary for lazy-loaded game modes so initialization failures
 * always present a styled recovery action back to the mode hub.
 */
class ModeErrorBoundary extends Component<ModeBoundaryProps, ModeBoundaryState> {
  state: ModeBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ModeBoundaryState {
    return {
      hasError: true,
      message: error?.message || '',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={`flex min-h-screen flex-col items-center justify-center p-6 text-center text-white ${this.props.bgClass ?? 'bg-[#0F1B2D]'}`}
        >
          <div className="max-w-md rounded-3xl border border-rose-300/40 bg-slate-900 p-6 shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="mt-3 font-display text-xl font-black text-rose-200">
              {this.props.title}
            </h2>
            <p className="mt-2 text-xs text-slate-300">
              {this.state.message || this.props.fallbackMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                this.props.onBack();
              }}
              className="btn-tactile-amber mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-black text-[#1B110B]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Quay Lại Chọn Chế Độ</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Shared Suspense loading state for lazy-loaded game modes.
 */
function ModeLoadingFallback({
  label,
  bgClass,
  spinnerClass,
  textClass,
}: {
  label: string;
  bgClass: string;
  spinnerClass: string;
  textClass: string;
}) {
  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center gap-3 text-white ${bgClass}`}
    >
      <div
        className={`h-10 w-10 animate-spin rounded-full border-4 border-t-transparent ${spinnerClass}`}
      />
      <div className={`text-sm font-black tracking-wide ${textClass}`}>
        {label}
      </div>
    </div>
  );
}

function readInitialRoomCodeParam(paramName: string): string {
  if (typeof window === 'undefined') return '';
  const raw = new URLSearchParams(window.location.search).get(paramName) ?? '';
  const clean = normalizeRoomCode(raw);
  return clean.length >= 4 ? clean : '';
}

export function App() {
  const [initialBbRoomCode] = useState<string>(() =>
    readInitialRoomCodeParam('bbRoom'),
  );
  const [initialGlassRoomCode] = useState<string>(
    () =>
      readInitialRoomCodeParam('coopRoom') ||
      readInitialRoomCodeParam('glassRoom'),
  );
  const [initialEventRoomCode] = useState<string>(() =>
    readInitialRoomCodeParam('eventRoom'),
  );
  const [initialCardsRoomCode] = useState<string>(() =>
    readInitialRoomCodeParam('cardsRoom'),
  );
  const [screen, setScreen] = useState<AppScreen>(() => {
    if (initialEventRoomCode) return 'event';
    if (initialCardsRoomCode) return 'online';
    if (initialBbRoomCode) return 'blockblastRoom';
    if (initialGlassRoomCode) return 'glassCarry';
    return 'modeSelect';
  });

  useEffect(() => {
    if (
      (!initialBbRoomCode &&
        !initialGlassRoomCode &&
        !initialEventRoomCode &&
        !initialCardsRoomCode) ||
      typeof window === 'undefined'
    ) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    let changed = false;
    for (const key of ['bbRoom', 'coopRoom', 'glassRoom', 'eventRoom', 'cardsRoom']) {
      if (params.has(key)) {
        params.delete(key);
        changed = true;
      }
    }
    if (changed) {
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);
    }
  }, [
    initialBbRoomCode,
    initialCardsRoomCode,
    initialEventRoomCode,
    initialGlassRoomCode,
  ]);

  return (
    <div className="relative min-h-screen">
      {/* Compact top-right navigation switcher on 3D Studio only */}
      {screen === 'studio3d' && (
        <nav
          aria-label="Điều hướng ứng dụng"
          className="fixed right-4 top-4 z-50 inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-[#2C1B11]/90 p-1 shadow-xl backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setScreen('modeSelect')}
            aria-pressed={false}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black text-amber-100/90 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <Home className="h-3.5 w-3.5 text-amber-300" />
            <span>Chế Độ</span>
          </button>
          <button
            type="button"
            onClick={() => setScreen('studio3d')}
            aria-pressed={true}
            className="btn-tactile-amber inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black text-[#2C1B11] shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <Boxes className="h-3.5 w-3.5" />
            <span>3D Studio</span>
          </button>
        </nav>
      )}

      {screen === 'modeSelect' && (
        <ModeSelectScreen
          onSelectPawsCards={() => setScreen('menu')}
          onSelectBrawlArena={() => setScreen('brawl')}
          onSelectBlockBlast={() => setScreen('blockblast')}
          onSelectGlassCarry={() => setScreen('glassCarry')}
          onSelectEventCup={() => setScreen('event')}
          onOpenStudio3D={() => setScreen('studio3d')}
        />
      )}

      {screen === 'menu' && (
        <MainMenuScreen
          onStartGame={() => setScreen('game')}
          onOpenOnline={() => setScreen('online')}
          onOpenStudio3D={() => setScreen('studio3d')}
          onBackToModeSelect={() => setScreen('modeSelect')}
        />
      )}
      {screen === 'game' && (
        <Game3DScreen onBackToMenu={() => setScreen('menu')} />
      )}
      {screen === 'online' && (
        <OnlineModeContainer
          initialRoomCode={initialCardsRoomCode}
          onBackToMenu={() => setScreen('menu')}
        />
      )}
      {screen === 'studio3d' && <Showcase3D />}

      {screen === 'brawl' && (
        <ModeErrorBoundary
          title="Không thể mở Brawl Arena 3D"
          fallbackMessage="Không thể khởi tạo engine vật lý 3D."
          bgClass="bg-[#0F1B2D]"
          onBack={() => setScreen('modeSelect')}
        >
          <Suspense
            fallback={
              <ModeLoadingFallback
                label="Đang tải đấu trường Brawl Arena 3D..."
                bgClass="bg-[#14243A]"
                spinnerClass="border-sky-400"
                textClass="text-sky-200"
              />
            }
          >
            <LazyBrawlScreen
              onBackToModeSelect={() => setScreen('modeSelect')}
            />
          </Suspense>
        </ModeErrorBoundary>
      )}

      {screen === 'blockblast' && (
        <ModeErrorBoundary
          title="Không thể mở Block Blast PAWS"
          fallbackMessage="Không thể khởi tạo bảng xếp khối Block Blast PAWS."
          bgClass="bg-[#1a100b]"
          onBack={() => setScreen('modeSelect')}
        >
          <Suspense
            fallback={
              <ModeLoadingFallback
                label="Đang tải Block Blast PAWS..."
                bgClass="bg-[#1a100b]"
                spinnerClass="border-emerald-400"
                textClass="text-emerald-200"
              />
            }
          >
            <LazyBlockBlastScreen
              onBackToModeSelect={() => setScreen('modeSelect')}
              onOpenRoomMode={() => setScreen('blockblastRoom')}
            />
          </Suspense>
        </ModeErrorBoundary>
      )}

      {screen === 'blockblastRoom' && (
        <ModeErrorBoundary
          title="Không thể mở Phòng Đấu Block Blast"
          fallbackMessage="Không thể khởi tạo phòng đấu trực tuyến Block Blast PAWS."
          bgClass="bg-[#1a100b]"
          onBack={() => setScreen('modeSelect')}
        >
          <Suspense
            fallback={
              <ModeLoadingFallback
                label="Đang tải Phòng Đấu Block Blast..."
                bgClass="bg-[#1a100b]"
                spinnerClass="border-emerald-400"
                textClass="text-emerald-200"
              />
            }
          >
            <LazyBlockBlastRoomContainer
              initialRoomCode={initialBbRoomCode}
              onSwitchToSolo={() => setScreen('blockblast')}
              onBackToModeSelect={() => setScreen('modeSelect')}
            />
          </Suspense>
        </ModeErrorBoundary>
      )}

      {screen === 'glassCarry' && (
        <ModeErrorBoundary
          title="Không thể mở PAWS Duo Co-op 3D"
          fallbackMessage="Không thể khởi tạo màn chơi 3D PAWS Duo Co-op."
          bgClass="bg-[#0d1b2e]"
          onBack={() => setScreen('modeSelect')}
        >
          <Suspense
            fallback={
              <ModeLoadingFallback
                label="Đang tải sảnh PAWS Duo Co-op 3D..."
                bgClass="bg-[#0d1b2e]"
                spinnerClass="border-cyan-400"
                textClass="text-cyan-200"
              />
            }
          >
            <LazyGlassCarryScreen
              initialRoomCode={initialGlassRoomCode}
              onBackToModeSelect={() => setScreen('modeSelect')}
            />
          </Suspense>
        </ModeErrorBoundary>
      )}

      {screen === 'event' && (
        <ModeErrorBoundary
          title="Không thể mở PAWS Event Cup"
          fallbackMessage="Không thể khởi tạo phòng thi đấu liên hoàn PAWS Event Cup."
          bgClass="bg-[#1a100b]"
          onBack={() => setScreen('modeSelect')}
        >
          <Suspense
            fallback={
              <ModeLoadingFallback
                label="Đang tải phòng giải đấu PAWS Event Cup..."
                bgClass="bg-[#1a100b]"
                spinnerClass="border-amber-400"
                textClass="text-amber-200"
              />
            }
          >
            <LazyEventRoomScreen
              initialRoomCode={initialEventRoomCode}
              onBackToModeSelect={() => setScreen('modeSelect')}
            />
          </Suspense>
        </ModeErrorBoundary>
      )}
    </div>
  );
}

export default App;
