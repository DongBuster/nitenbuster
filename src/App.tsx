import { Component, Suspense, lazy, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, Boxes, Home } from 'lucide-react';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { Game3DScreen } from './screens/Game3DScreen';
import { Showcase3D } from './screens/Showcase3D';
import { OnlineLobbyScreen } from './screens/OnlineLobbyScreen';
import { OnlineGame3DScreen } from './screens/OnlineGame3DScreen';
import { ModeSelectScreen } from './screens/ModeSelectScreen';
import { useOnlineRoom } from './online/useOnlineRoom';

const LazyBrawlScreen = lazy(() => import('./screens/BrawlScreen'));

type AppScreen =
  | 'modeSelect'
  | 'menu'
  | 'game'
  | 'online'
  | 'studio3d'
  | 'brawl';

function OnlineModeContainer({ onBackToMenu }: { onBackToMenu: () => void }) {
  const room = useOnlineRoom();

  if (room.phase === 'playing' && room.gameState) {
    return <OnlineGame3DScreen room={room} onBackToMenu={onBackToMenu} />;
  }

  return <OnlineLobbyScreen room={room} onBackToMenu={onBackToMenu} />;
}

interface BrawlBoundaryState {
  hasError: boolean;
  message: string;
}

class BrawlErrorBoundary extends Component<
  { onBack: () => void; children: ReactNode },
  BrawlBoundaryState
> {
  state: BrawlBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): BrawlBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Không thể khởi tạo engine vật lý 3D.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0F1B2D] p-6 text-center text-white">
          <div className="max-w-md rounded-3xl border border-rose-300/40 bg-slate-900 p-6 shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="mt-3 font-display text-xl font-black text-rose-200">
              Không thể mở Brawl Arena 3D
            </h2>
            <p className="mt-2 text-xs text-slate-300">{this.state.message}</p>
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

export function App() {
  const [screen, setScreen] = useState<AppScreen>('modeSelect');

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
        <OnlineModeContainer onBackToMenu={() => setScreen('menu')} />
      )}
      {screen === 'studio3d' && <Showcase3D />}

      {screen === 'brawl' && (
        <BrawlErrorBoundary onBack={() => setScreen('modeSelect')}>
          <Suspense
            fallback={
              <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#14243A] text-white">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-400 border-t-transparent" />
                <div className="text-sm font-black tracking-wide text-sky-200">
                  Đang tải đấu trường Brawl Arena 3D...
                </div>
              </div>
            }
          >
            <LazyBrawlScreen
              onBackToModeSelect={() => setScreen('modeSelect')}
            />
          </Suspense>
        </BrawlErrorBoundary>
      )}
    </div>
  );
}

export default App;
