import { useState, useEffect, useCallback } from 'react';
import { supabase, getCurrentUserId } from '../services/supabaseClient';

// VAPID 公钥（构建时注入）
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

interface PushState {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  loading: boolean;
}

/** 将 base64 VAPID key 转换为 Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  const [state, setState] = useState<PushState>({
    isSupported: false,
    permission: 'unsupported',
    isSubscribed: false,
    loading: true,
  });

  // 检查当前状态
  useEffect(() => {
    const check = async () => {
      const supported = 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator;
      if (!supported) {
        setState({ isSupported: false, permission: 'unsupported', isSubscribed: false, loading: false });
        return;
      }

      const permission = Notification.permission;
      let isSubscribed = false;

      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        isSubscribed = !!sub;
      } catch {
        // SW 未就绪
      }

      setState({ isSupported: true, permission, isSubscribed, loading: false });
    };
    check();
  }, []);

  /** 请求权限并订阅推送 */
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported || !VAPID_PUBLIC_KEY) return false;

    setState(s => ({ ...s, loading: true }));

    try {
      // 1. 请求通知权限
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(s => ({ ...s, permission, loading: false }));
        return false;
      }

      // 2. 通过 Push API 订阅
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // 3. 保存到 Supabase
      const subJson = subscription.toJSON();
      const userId = getCurrentUserId();
      if (userId && subJson.endpoint) {
        const { error } = await supabase.from('push_subscriptions').upsert(
          {
            user_id: userId,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys?.p256dh || '',
            auth: subJson.keys?.auth || '',
            user_agent: navigator.userAgent,
          },
          { onConflict: 'user_id,endpoint' },
        );
        if (error) {
          console.error('[Push] 保存订阅失败:', error.message);
        }
      }

      setState({ isSupported: true, permission: 'granted', isSubscribed: true, loading: false });
      return true;
    } catch (e) {
      console.error('[Push] 订阅失败:', e);
      setState(s => ({ ...s, loading: false }));
      return false;
    }
  }, [state.isSupported]);

  /** 取消订阅 */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setState(s => ({ ...s, loading: true }));
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        // 从 Supabase 删除
        const userId = getCurrentUserId();
        if (userId) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('endpoint', sub.endpoint);
        }
        await sub.unsubscribe();
      }
      setState(s => ({ ...s, isSubscribed: false, loading: false }));
      return true;
    } catch (e) {
      console.error('[Push] 取消订阅失败:', e);
      setState(s => ({ ...s, loading: false }));
      return false;
    }
  }, []);

  return { ...state, subscribe, unsubscribe };
}
