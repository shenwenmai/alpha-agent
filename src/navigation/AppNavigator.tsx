import React, { useState, lazy, Suspense } from 'react';
import DashboardHomePage from '../screens/DashboardHomePage';
import type { FMView } from '../screens/FundManagerScreen';
import { theme } from '../theme';

// 懒加载非首屏页面
const HomeScreen = lazy(() => import('../screens/HomeScreen'));
const CreateRoomScreen = lazy(() => import('../screens/CreateRoomScreen'));
const RoomScreen = lazy(() => import('../screens/RoomScreen'));
const SettingsScreen = lazy(() => import('../screens/SettingsScreen'));
const CharacterProfileScreen = lazy(() => import('../screens/CharacterProfileScreen'));
const FundManagerScreen = lazy(() => import('../screens/FundManagerScreen'));
const AssistantScreen = lazy(() => import('../screens/AssistantScreen'));
const EmotionScreen = lazy(() => import('../screens/EmotionScreen'));
import { Home, MessageCircle, User, Shield, Zap } from 'lucide-react';
import SyncStatusIndicator from '../components/SyncStatusIndicator';
import ErrorBoundary from '../components/ErrorBoundary';
import OnboardingGuide from '../components/OnboardingGuide';
import { getActiveRoom, setActiveRoom, createRoom } from '../services/roomService';
import { canAffordRoom, payForRoom } from '../services/creditsService';
import type { CharacterId } from '../types/room';

type Screen =
  | 'dashboard'          // 新首页
  | 'home'               // 圆桌（原首页 → 话题feed）
  | 'create_room'
  | 'room'
  | 'profile'
  | 'character_profile'
  | 'fund_manager'
  | 'assistant'
  | 'emotion';

const tabs = [
  { name: '首页', screen: 'dashboard' as const, icon: Home },
  { name: '圆桌', screen: 'home' as const, icon: MessageCircle },
  { name: '管家', screen: 'fund_manager' as const, icon: Shield },
  { name: '教练', screen: 'assistant' as const, icon: Zap },
  { name: '我的', screen: 'profile' as const, icon: User },
];

export default function AppNavigator() {
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('onboarding_done')
  );
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [activeRoomId, setActiveRoomIdState] = useState<string | null>(
    () => getActiveRoom()?.id || null
  );
  const [profileCharId, setProfileCharId] = useState<CharacterId | null>(null);
  const prevScreenRef = React.useRef<Screen>('home');

  // ── 首页 → 管家 跳转桥接 ──
  const [fmTargetView, setFmTargetView] = useState<FMView | null>(null);
  const [fmReviewSessionId, setFmReviewSessionId] = useState<string | null>(null);

  const navigateToFM = (view: FMView, reviewId?: string) => {
    setFmTargetView(view);
    if (reviewId) setFmReviewSessionId(reviewId);
    setScreen('fund_manager');
  };

  const handleOpenRoom = (id: string) => {
    setActiveRoom(id);
    setActiveRoomIdState(id);
    setScreen('room');
  };

  const handleCreateRoom = () => {
    setScreen('create_room');
  };

  const handleRoomCreated = (roomId: string) => {
    setActiveRoomIdState(roomId);
    setScreen('room');
  };

  const handleBackToHome = () => {
    setScreen('home');
  };

  // 角色档案页
  const handleCharacterTap = (charId: CharacterId) => {
    prevScreenRef.current = screen;
    setProfileCharId(charId);
    setScreen('character_profile');
  };

  // 从角色档案快速创建房间
  const handleCreateRoomWithCharacter = (charId: CharacterId) => {
    const characters: CharacterId[] = charId === 'junshi'
      ? ['junshi', 'aqiang']
      : ['junshi', charId];

    if (!canAffordRoom('hourly')) {
      alert('积分不足，无法创建房间');
      return;
    }

    const roomName = `和${charId === 'junshi' ? '军师' : charId}聊聊`;
    const { success } = payForRoom('hourly', roomName);
    if (!success) {
      alert('扣费失败，请重试');
      return;
    }

    const room = createRoom({
      name: roomName,
      characters,
      atmosphere: 'mixed',
      topic: '自由讨论',
      plan: 'hourly',
    });

    setActiveRoomIdState(room.id);
    setScreen('room');
  };

  const handleTabClick = (tabScreen: Screen) => {
    // 圆桌 tab：如有活跃房间则进房间，否则显示 feed
    if (tabScreen === 'home') {
      if (activeRoomId) {
        setScreen('room');
      } else {
        setScreen('home');
      }
    } else {
      // 切换 tab 时清除 FM 跳转状态，防止残留
      if (tabScreen !== 'fund_manager') {
        setFmTargetView(null);
        setFmReviewSessionId(null);
      } else {
        // 直接点管家 tab（非首页跳转），强制回到管家首页
        setFmTargetView('home');
      }
      setScreen(tabScreen);
    }
    // 切 tab 时滚回顶部
    window.scrollTo(0, 0);
  };

  const showTabBar = screen !== 'room' && screen !== 'create_room' && screen !== 'character_profile';

  const renderContent = () => {
    switch (screen) {
      case 'dashboard':
        return (
          <DashboardHomePage
            onStartPlan={() => navigateToFM('new_plan')}
            onResume={() => navigateToFM('recording')}
            onReview={(id) => navigateToFM('review', id)}
            onHistory={() => navigateToFM('history')}
            onTemplates={() => navigateToFM('templates')}
            onGlossary={() => navigateToFM('glossary')}
            onGoToRoundtable={() => setScreen('home')}
            onGrowth={() => navigateToFM('growth')}
            onKeyMoment={() => navigateToFM('key_moment')}
            onFindAdvisor={() => handleCreateRoomWithCharacter('junshi' as CharacterId)}
            onCreateRoom={handleCreateRoom}
            onCharacterTap={(charId) => handleCharacterTap(charId as CharacterId)}
          />
        );
      case 'home':
        return (
          <HomeScreen
            onCreateRoom={handleCreateRoom}
            onOpenRoom={handleOpenRoom}
            onCharacterTap={handleCharacterTap}
          />
        );
      case 'create_room':
        return (
          <CreateRoomScreen
            onCreated={handleRoomCreated}
            onBack={handleBackToHome}
            onCharacterTap={handleCharacterTap}
          />
        );
      case 'room':
        return (
          <RoomScreen
            roomId={activeRoomId}
            onBack={handleBackToHome}
            onCharacterTap={handleCharacterTap}
          />
        );
      case 'character_profile':
        return profileCharId ? (
          <CharacterProfileScreen
            characterId={profileCharId}
            onBack={() => setScreen(prevScreenRef.current)}
            onCreateRoom={handleCreateRoomWithCharacter}
          />
        ) : (
          <HomeScreen
            onCreateRoom={handleCreateRoom}
            onOpenRoom={handleOpenRoom}
            onCharacterTap={handleCharacterTap}
          />
        );
      case 'fund_manager':
        return (
          <FundManagerScreen
            targetView={fmTargetView}
            targetReviewSessionId={fmReviewSessionId}
            onTargetConsumed={() => { setFmTargetView(null); setFmReviewSessionId(null); }}
          />
        );
      case 'assistant':
        return (
          <AssistantScreen
            onStartPlan={() => navigateToFM('new_plan')}
            onEmotion={() => setScreen('emotion')}
          />
        );
      case 'emotion':
        return <EmotionScreen onBack={() => setScreen('assistant')} />;
      case 'profile':
        return <SettingsScreen />;
      default:
        return (
          <DashboardHomePage
            onStartPlan={() => navigateToFM('new_plan')}
            onResume={() => navigateToFM('recording')}
            onReview={(id) => navigateToFM('review', id)}
            onHistory={() => navigateToFM('history')}
            onTemplates={() => navigateToFM('templates')}
            onGlossary={() => navigateToFM('glossary')}
            onGoToRoundtable={() => setScreen('home')}
            onGrowth={() => navigateToFM('growth')}
            onKeyMoment={() => navigateToFM('key_moment')}
            onFindAdvisor={() => handleCreateRoomWithCharacter('junshi' as CharacterId)}
            onCreateRoom={handleCreateRoom}
            onCharacterTap={(charId) => handleCharacterTap(charId as CharacterId)}
          />
        );
    }
  };

  // 判断当前 tab 是否激活
  const isTabActive = (tabScreen: string) => {
    if (tabScreen === 'dashboard') return screen === 'dashboard';
    if (tabScreen === 'home') return screen === 'home' || screen === 'create_room' || screen === 'room';
    if (tabScreen === 'fund_manager') return screen === 'fund_manager';
    if (tabScreen === 'assistant') return screen === 'assistant' || screen === 'emotion';
    if (tabScreen === 'profile') return screen === 'profile';
    return false;
  };

  if (showOnboarding) {
    return <OnboardingGuide onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <div style={{
      backgroundColor: '#0A0A0A',
      color: '#fff',
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <SyncStatusIndicator />
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: screen === 'room' ? 'hidden' : 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingTop: screen === 'room' ? '0' : 'env(safe-area-inset-top, 0px)',
        paddingBottom: showTabBar ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : '0',
      }}>
        <ErrorBoundary>
          <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>加载中...</div>}>
            {renderContent()}
          </Suspense>
        </ErrorBoundary>
      </div>

      {showTabBar && (
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: '#141414',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '8px 16px calc(8px + env(safe-area-inset-bottom, 0px))',
          alignItems: 'center',
          justifyContent: 'space-around',
          gap: '8px',
          zIndex: 50,
        }}>
          {tabs.map((tab) => {
            const active = isTabActive(tab.screen);
            const Icon = tab.icon;

            return (
              <button
                key={tab.name}
                className="clickable"
                onClick={() => handleTabClick(tab.screen)}
                style={{
                  flex: 1,
                  maxWidth: '80px',
                  padding: '6px 4px',
                  backgroundColor: 'transparent',
                  borderRadius: '14px',
                  border: 'none',
                  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  cursor: 'pointer',
                  transition: 'all 0.2s var(--ease-spring)',
                }}
              >
                <Icon size={20} strokeWidth={2} />
                <span style={{ fontSize: '10px', fontWeight: 700 }}>
                  {tab.name}
                </span>
                <div style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: active ? '#00C896' : 'transparent',
                  transition: 'all 0.2s var(--ease-spring)',
                }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
