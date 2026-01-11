type NotificationPermission = 'default' | 'granted' | 'denied';

interface NotificationOptions {
  body?: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  onClick?: () => void;
}

class BrowserNotificationService {
  private permission: NotificationPermission = 'default';
  private isSupported: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.isSupported = true;
      this.permission = Notification.permission;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return 'denied';
    }

    try {
      this.permission = await Notification.requestPermission();
      return this.permission;
    } catch {
      return 'denied';
    }
  }

  getPermission(): NotificationPermission {
    return this.permission;
  }

  isEnabled(): boolean {
    return this.isSupported && this.permission === 'granted';
  }

  show(title: string, options?: NotificationOptions): Notification | null {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const notification = new Notification(title, {
        body: options?.body,
        icon: options?.icon || '/favicon.ico',
        tag: options?.tag,
        requireInteraction: options?.requireInteraction,
        silent: options?.silent,
      });

      if (options?.onClick) {
        notification.onclick = () => {
          window.focus();
          options.onClick?.();
          notification.close();
        };
      }

      return notification;
    } catch {
      return null;
    }
  }

  showSessionComplete(sessionTitle: string, onClick?: () => void): Notification | null {
    return this.show('Session Complete', {
      body: `"${sessionTitle}" has finished`,
      tag: 'session-complete',
      onClick,
    });
  }

  showSessionError(sessionTitle: string, error?: string, onClick?: () => void): Notification | null {
    return this.show('Session Error', {
      body: error ? `${sessionTitle}: ${error}` : `"${sessionTitle}" encountered an error`,
      tag: 'session-error',
      onClick,
    });
  }

  showApprovalNeeded(sessionTitle: string, onClick?: () => void): Notification | null {
    return this.show('Approval Needed', {
      body: `"${sessionTitle}" is waiting for approval`,
      tag: 'approval-needed',
      requireInteraction: true,
      onClick,
    });
  }

  showDebateComplete(topic: string, onClick?: () => void): Notification | null {
    return this.show('Debate Complete', {
      body: `Debate on "${topic}" has concluded`,
      tag: 'debate-complete',
      onClick,
    });
  }
}

export const notificationService = new BrowserNotificationService();

export function useNotifications() {
  const requestPermission = async () => {
    return notificationService.requestPermission();
  };

  const isEnabled = () => {
    return notificationService.isEnabled();
  };

  const getPermission = () => {
    return notificationService.getPermission();
  };

  return {
    requestPermission,
    isEnabled,
    getPermission,
    show: notificationService.show.bind(notificationService),
    showSessionComplete: notificationService.showSessionComplete.bind(notificationService),
    showSessionError: notificationService.showSessionError.bind(notificationService),
    showApprovalNeeded: notificationService.showApprovalNeeded.bind(notificationService),
    showDebateComplete: notificationService.showDebateComplete.bind(notificationService),
  };
}
